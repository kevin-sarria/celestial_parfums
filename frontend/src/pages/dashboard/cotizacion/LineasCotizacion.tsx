import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import BuscadorSelect from '../../../components/BuscadorSelect';
import { formatPrice } from '../helpers';
import { Field } from '../ui';
import { calcularDesgloseCosto, rentabilidadLinea, sugerirPrecio } from '../../../application/costeoCotizacion';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import type {
  AccesorioSeleccionado, CotizacionItem, FormulaVolumen, Insumo,
} from '../../../domain/entities/cotizacion.types';

interface Props {
  lineas: CotizacionItem[];
  perfumes: Perfume[];
  formulas: FormulaVolumen[];
  insumos: Insumo[];
  /** Qué línea tiene abierto el panel de costo interno. */
  costoAbierto: number | null;
  onCostoAbierto: (i: number | null) => void;
  onChange: (lineas: CotizacionItem[]) => void;
}

/**
 * Líneas de la cotización: producto del catálogo + tamaño + cantidad +
 * accesorios. Recalcula costo y precio sugerido en vivo con el motor puro
 * (`costeoCotizacion.ts`). El bloque de costo es plegable y SOLO interno.
 */
export default function LineasCotizacion({
  lineas, perfumes, formulas, insumos, costoAbierto, onCostoAbierto, onChange,
}: Props) {
  // Solo los que van por perfume: los de "pedido" se cargan a la cotización entera
  const accesorios = insumos.filter((i) => i.tipo === 'accesorio' && i.alcance !== 'pedido');

  /** Recalcula desglose y precio sugerido de una línea al cambiar algo. */
  const recalcular = (linea: CotizacionItem, mantenerPrecio: boolean): CotizacionItem => {
    const formula = formulas.find((f) => f.id === linea.formula_volumen_id);
    if (!formula) return linea;
    // El costo depende de la ESENCIA DE ESA FRAGANCIA: Khamrah cuesta el triple
    // que Mandarin Sky por ml. Costear con la esencia genérica del tamaño daría
    // un margen falso, y en mayoreo son cientos de unidades.
    const perfume = perfumes.find((p) => p.id === linea.perfume_id);
    const desglose = calcularDesgloseCosto(
      formula, insumos, linea.accesorios_seleccionados, perfume?.insumo_esencia_precio ?? null,
    );
    const sugerido = sugerirPrecio(formula.escalas, linea.cantidad);
    const precio = mantenerPrecio ? linea.precio_unitario : (sugerido ?? linea.precio_unitario);
    return {
      ...linea,
      volumen_nombre: formula.nombre,
      desglose_costo: desglose,
      precio_unitario: precio,
      subtotal: precio * linea.cantidad,
    };
  };

  const actualizar = (idx: number, cambios: Partial<CotizacionItem>, mantenerPrecio = true) => {
    onChange(lineas.map((l, i) => (i === idx ? recalcular({ ...l, ...cambios }, mantenerPrecio) : l)));
  };

  const agregarPerfume = (id: number | string) => {
    const perfume = perfumes.find((p) => p.id === Number(id));
    const formula = formulas[0];
    if (!perfume || !formula) return;
    const base: CotizacionItem = {
      perfume_id: perfume.id,
      perfume_nombre: perfume.nombre,
      perfume_imagen: perfume.imagen_url,
      formula_volumen_id: formula.id,
      volumen_nombre: formula.nombre,
      cantidad: formula.escalas[0]?.cantidad_min ?? 10,
      // Vienen marcados los del tamaño; se pueden ajustar para este cliente
      accesorios_seleccionados: formula.accesorios_default ?? [],
      desglose_costo: { esencia: 0, diluyente: 0, sellador: 0, feromonas: 0, envase: 0, accesorios: 0, costo_unitario: 0 },
      precio_unitario: 0,
      subtotal: 0,
    };
    onChange([...lineas, recalcular(base, false)]);
  };

  const toggleAccesorio = (idx: number, insumo: Insumo) => {
    const linea = lineas[idx];
    const yaEsta = linea.accesorios_seleccionados.some((a) => a.insumo_id === insumo.id);
    const nuevos: AccesorioSeleccionado[] = yaEsta
      ? linea.accesorios_seleccionados.filter((a) => a.insumo_id !== insumo.id)
      : [...linea.accesorios_seleccionados, { insumo_id: insumo.id, nombre: insumo.nombre, precio: insumo.precio }];
    actualizar(idx, { accesorios_seleccionados: nuevos });
  };

  return (
    <div className="space-y-3">
      <BuscadorSelect
        opciones={(perfumes ?? []).map((p) => ({ id: p.id, nombre: p.nombre }))}
        placeholder="Buscar perfume del catálogo para agregar…"
        onSelect={agregarPerfume}
        vacio="Sin perfumes que coincidan"
      />

      {formulas.length === 0 && (
        <p className="rounded-lg border border-amber-400/45 bg-amber-400/10 px-3 py-2 text-[12.5px] font-medium text-amber-700">
          Primero crea al menos un tamaño en "Tamaños y fórmulas".
        </p>
      )}

      {lineas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[13px] text-muted-foreground">
          Agrega productos con el buscador de arriba.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {lineas.map((l, idx) => {
            const rent = rentabilidadLinea(l.desglose_costo, l.precio_unitario, l.cantidad);
            const formula = formulas.find((f) => f.id === l.formula_volumen_id);
            const sugerido = formula ? sugerirPrecio(formula.escalas, l.cantidad) : null;
            const abierto = costoAbierto === idx;
            return (
              <li key={idx} className="rounded-xl border border-border bg-card p-3.5">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-40 flex-1">
                    <p className="text-[14px] font-medium text-foreground">{l.perfume_nombre}</p>
                    <p className="text-[11.5px] text-muted-foreground">Subtotal: {formatPrice(l.subtotal)}</p>
                  </div>

                  <Field label="Tamaño" className="w-32">
                    <NativeSelect
                      className="h-9"
                      value={l.formula_volumen_id ?? ''}
                      onChange={(e) => actualizar(idx, { formula_volumen_id: Number(e.target.value) }, false)}
                    >
                      {formulas.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                    </NativeSelect>
                  </Field>

                  <Field label="Cantidad" className="w-24">
                    <Input
                      type="number" min="1" className="h-9"
                      value={l.cantidad}
                      onChange={(e) => actualizar(idx, { cantidad: Math.max(1, Number(e.target.value) || 1) }, false)}
                    />
                  </Field>

                  <Field label="Precio unitario" className="w-32">
                    <Input
                      type="number" min="0" className="h-9"
                      value={l.precio_unitario}
                      onChange={(e) => actualizar(idx, { precio_unitario: Number(e.target.value) || 0 })}
                    />
                  </Field>

                  <Button size="icon" variant="ghost" className="size-9 text-muted-foreground hover:text-destructive"
                    onClick={() => onChange(lineas.filter((_, i) => i !== idx))}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                {/* Sin precio no hay cotización posible: se dice qué falta hacer,
                    en vez de mostrar una "pérdida" que solo confunde. */}
                {l.precio_unitario <= 0 ? (
                  <p className="mt-1.5 text-[12px] font-medium text-amber-700">
                    Escribe el precio que le vas a cobrar por unidad
                    {formula && formula.escalas.length === 0
                      && ' (o define precios por cantidad en "Tamaños y fórmulas" para que se llene solo)'}.
                  </p>
                ) : sugerido != null && sugerido !== l.precio_unitario && (
                  <button type="button" className="mt-1.5 text-[12px] font-medium text-primary hover:underline"
                    onClick={() => actualizar(idx, { precio_unitario: sugerido })}>
                    Precio sugerido para {l.cantidad} u: {formatPrice(sugerido)} — aplicar
                  </button>
                )}

                {/* Sin esencia asignada el costo sale de la genérica del tamaño:
                    en mayoreo eso son cientos de unidades mal costeadas. */}
                {!perfumes.find((p) => p.id === l.perfume_id)?.insumo_esencia_precio && (
                  <p className="mt-1.5 text-[12px] font-medium text-amber-700">
                    Este producto no tiene su esencia asignada, así que el costo es aproximado.
                    Ponsela en su ficha del catálogo antes de cotizar en volumen.
                  </p>
                )}

                {/* Accesorios incluidos en esta línea */}
                {accesorios.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {accesorios.map((a) => {
                      const activo = l.accesorios_seleccionados.some((s) => s.insumo_id === a.id);
                      return (
                        <button key={a.id} type="button" onClick={() => toggleAccesorio(idx, a)}
                          className={`rounded-full border px-2.5 py-1 text-[11.5px] transition-colors ${
                            activo ? 'border-primary bg-brand-soft font-medium text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                          }`}>
                          {activo ? '✓ ' : '+ '}{a.nombre}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Costo interno (plegable) — NUNCA sale en el PDF del cliente */}
                <button type="button" onClick={() => onCostoAbierto(abierto ? null : idx)}
                  className="mt-2.5 flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground">
                  {abierto ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  {l.precio_unitario <= 0
                    ? `Te cuesta ${formatPrice(l.desglose_costo.costo_unitario)} producir cada uno`
                    : `Costo interno · utilidad ${formatPrice(rent.utilidad)} (${rent.margenPct}%)`}
                </button>
                {abierto && (
                  <div className="mt-2 grid gap-x-6 gap-y-1 rounded-lg bg-secondary/50 px-3 py-2.5 text-[12px] text-muted-foreground sm:grid-cols-2">
                    <span>Esencia: <strong className="text-foreground">{formatPrice(l.desglose_costo.esencia)}</strong></span>
                    <span>Diluyente: <strong className="text-foreground">{formatPrice(l.desglose_costo.diluyente)}</strong></span>
                    <span>Sellador: <strong className="text-foreground">{formatPrice(l.desglose_costo.sellador)}</strong></span>
                    <span>Feromonas: <strong className="text-foreground">{formatPrice(l.desglose_costo.feromonas)}</strong></span>
                    <span>Envase: <strong className="text-foreground">{formatPrice(l.desglose_costo.envase)}</strong></span>
                    <span>Accesorios: <strong className="text-foreground">{formatPrice(l.desglose_costo.accesorios)}</strong></span>
                    <span className="sm:col-span-2 border-t border-border/70 pt-1">
                      Costo por unidad: <strong className="text-foreground">{formatPrice(l.desglose_costo.costo_unitario)}</strong>
                      {' · '}Costo total: <strong className="text-foreground">{formatPrice(rent.costoTotal)}</strong>
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
