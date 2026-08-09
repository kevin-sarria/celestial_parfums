import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatPrice } from '../helpers';
import { calcularDesgloseCosto } from '../../../application/costeoCotizacion';
import type { FormulaVolumen, Insumo } from '../../../domain/entities/cotizacion.types';

interface Props {
  formula: FormulaVolumen;
  insumos: Insumo[];
  /** Si se pasa, se pueden marcar los accesorios que incluye el tamaño. */
  onAccesorios?: (insumoIds: number[]) => void;
  abiertoPorDefecto?: boolean;
  /**
   * Costo por ml de la esencia con la que costear. Como la receta ya NO elige
   * fragancia (eso lo dice el perfume), este número viene del PROMEDIO DE LA
   * GAMA que se esté mirando: un 30 ml cuesta muy distinto con esencia clásica
   * ($245/ml) que con premium ($1.500/ml), y un solo número no sirve.
   */
  esenciaPrecio?: number | null;
  /** Nombre de esa gama, para que el desglose diga con qué se calculó. */
  esenciaEtiqueta?: string;
}

/**
 * Cuánto cuesta producir UNA unidad de este tamaño, con el desglose de cada
 * insumo y la ganancia que deja cada rango de precio mayorista.
 *
 * Es información INTERNA (nunca sale en el PDF del cliente) y la base sobre la
 * que se apoyará el módulo de inventario: al subir el precio de una materia
 * prima, estos números se recalculan solos porque salen del motor de costeo.
 */
export default function CostoDeProduccion({
  formula, insumos, onAccesorios, abiertoPorDefecto, esenciaPrecio, esenciaEtiqueta,
}: Props) {
  const [abierto, setAbierto] = useState(!!abiertoPorDefecto);

  // Accesorios que este tamaño incluye por defecto: SÍ son parte del costo real
  // de entregar el producto, así que entran en el cálculo.
  const incluidos = formula.accesorios_default ?? [];
  const d = calcularDesgloseCosto(formula, insumos, incluidos, esenciaPrecio);
  /** Accesorios disponibles que se cobran por perfume (no los de pedido). */
  const accesoriosPorUnidad = insumos.filter((i) => i.tipo === 'accesorio' && i.alcance !== 'pedido');

  const toggle = (id: number) => {
    if (!onAccesorios) return;
    const ids = incluidos.map((a) => a.insumo_id);
    onAccesorios(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  };

  const precioMl = (clave: string) => {
    const i = insumos.find(
      (x) => x.tipo === 'materia_prima'
        && x.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(clave),
    );
    return i?.precio ?? 0;
  };

  const filas = [
    {
      etiqueta: esenciaEtiqueta ? `Esencia ${esenciaEtiqueta.toLowerCase()}` : 'Esencia',
      ml: formula.esencia_ml,
      unitario: esenciaPrecio ?? formula.esencia_precio ?? precioMl('esencia'),
      total: d.esencia,
    },
    { etiqueta: 'Diluyente', ml: formula.diluyente_ml, unitario: precioMl('diluyente'), total: d.diluyente },
    { etiqueta: 'Sellador', ml: formula.sellador_ml, unitario: precioMl('sellador'), total: d.sellador },
    { etiqueta: 'Feromonas', ml: formula.feromonas_ml, unitario: precioMl('feromonas'), total: d.feromonas },
  ].filter((f) => f.ml > 0);

  return (
    <div className="mt-3 rounded-xl border border-border bg-secondary/40 p-3.5">
      <button type="button" onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left">
        <span className="text-[13.5px] text-foreground">
          Producir uno te cuesta{' '}
          <strong className="font-semibold text-primary">{formatPrice(d.costo_unitario)}</strong>
        </span>
        <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
          {abierto ? 'Ocultar' : 'Ver desglose'}
          {abierto ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </span>
      </button>

      {abierto && (
        <div className="mt-3 space-y-3">
          <ul className="space-y-1 text-[12.5px]">
            {filas.map((f) => (
              <li key={f.etiqueta} className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">
                  {f.etiqueta} · {f.ml} ml × {formatPrice(f.unitario)}
                  {f.unitario === 0 && <span className="ml-1 font-medium text-amber-700">(sin costo registrado)</span>}
                </span>
                <span className="tabular-nums text-foreground">{formatPrice(f.total)}</span>
              </li>
            ))}
            {formula.envase_nombre && (
              <li className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">Envase · {formula.envase_nombre}</span>
                <span className="tabular-nums text-foreground">{formatPrice(d.envase)}</span>
              </li>
            )}
            {incluidos.map((a) => (
              <li key={a.insumo_id} className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">Accesorio · {a.nombre}</span>
                <span className="tabular-nums text-foreground">{formatPrice(a.precio)}</span>
              </li>
            ))}
            <li className="flex items-baseline justify-between gap-3 border-t border-border/70 pt-1.5 text-[13.5px] font-semibold">
              <span className="text-foreground">Costo por unidad</span>
              <span className="tabular-nums text-primary">{formatPrice(d.costo_unitario)}</span>
            </li>
          </ul>

          {/* Qué acompaña al perfume: marcar cambia el costo al instante */}
          {onAccesorios && accesoriosPorUnidad.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                ¿Qué incluye cada perfume?
              </p>
              <div className="flex flex-wrap gap-1.5">
                {accesoriosPorUnidad.map((a) => {
                  const activo = incluidos.some((x) => x.insumo_id === a.id);
                  return (
                    <button key={a.id} type="button" onClick={() => toggle(a.id)}
                      className={`rounded-full border px-2.5 py-1 text-[11.5px] transition-colors ${
                        activo ? 'border-primary bg-brand-soft font-medium text-primary'
                          : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                      }`}>
                      {activo ? '✓ ' : '+ '}{a.nombre} ({formatPrice(a.precio)})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ganancia real de cada rango: lo que de verdad importa al fijar precios */}
          {formula.escalas.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Ganancia por rango
              </p>
              <ul className="space-y-1 text-[12.5px]">
                {formula.escalas.map((e) => {
                  const utilidad = e.precio - d.costo_unitario;
                  const margen = e.precio > 0 ? Math.round((utilidad / e.precio) * 1000) / 10 : 0;
                  return (
                    <li key={e.id} className="flex items-baseline justify-between gap-3">
                      <span className="text-muted-foreground">
                        {e.cantidad_max ? `${e.cantidad_min} a ${e.cantidad_max}` : `${e.cantidad_min}+`} u ·
                        vendes a {formatPrice(e.precio)}
                      </span>
                      <span className={`tabular-nums font-medium ${utilidad >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                        {utilidad >= 0 ? '+' : ''}{formatPrice(utilidad)} ({margen}%)
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Al cotizar, estos accesorios vienen marcados y se pueden ajustar para ese cliente.
            No incluye los costos por pedido (caja de envío…), que se cargan una sola vez.
            Información interna: nunca aparece en el PDF del cliente.
          </p>
        </div>
      )}
    </div>
  );
}
