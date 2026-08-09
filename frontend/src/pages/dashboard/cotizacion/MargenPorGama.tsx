import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { calcularDesgloseCosto, sugerirPrecio } from '../../../application/costeoCotizacion';
import { formatPrice } from '../helpers';
import type { FormulaVolumen, Insumo } from '../../../domain/entities/cotizacion.types';

/** Costo por ml promedio de una gama, tal como lo devuelve `GET /costeo/gamas`. */
export interface PromedioGama {
  gama_id: number;
  /** Nombre tal como lo escribió el dueño ("Clásica", "Nicho premium"…). */
  gama: string;
  esencias: number;
  promedio: number;
  minimo: number;
  maximo: number;
}

interface Props {
  /** Los tamaños marcados para la lista de precios. */
  formulas: FormulaVolumen[];
  insumos: Insumo[];
  gamas: PromedioGama[];
  /** Descuento global de la cotización, en %. */
  descuentoPct: number;
}

const margenPct = (precio: number, costo: number) =>
  precio > 0 ? Math.round(((precio - costo) / precio) * 1000) / 10 : 0;

/**
 * Costo y margen de una cotización GENERAL, que es la que no dice qué
 * fragancias lleva.
 *
 * Sin esto se cotizaba a ciegas: el panel de rentabilidad está pensado para
 * líneas con producto concreto, así que en la lista de precios por cantidad se
 * ocultaba entero y no se veía ni el costo ni el margen.
 *
 * La pieza que faltaba era **con qué esencia costear** cuando todavía no se
 * sabe cuál va. La respuesta es la GAMA: sobre las esencias cargadas no hay
 * cientos de precios sino tres escalones muy marcados, así que el promedio de
 * la gama sí representa lo que costará de verdad.
 *
 * NUNCA viaja al PDF: costo, utilidad y margen son solo del admin.
 */
export function MargenPorGama({ formulas, insumos, gamas, descuentoPct }: Props) {
  const [tamanoId, setTamanoId] = useState<number | null>(null);
  /** Unidades esperadas de cada gama, para la mezcla. */
  const [mezcla, setMezcla] = useState<Record<number, string>>({});

  const formula = formulas.find((f) => f.id === tamanoId) ?? formulas[0] ?? null;

  /** Lo que cuesta armar UNA unidad de este tamaño con cada gama de esencia. */
  const costos = useMemo(() => {
    if (!formula) return [];
    return gamas.map((g) => ({
      ...g,
      costo: calcularDesgloseCosto(
        formula, insumos, formula.accesorios_default ?? [], g.promedio,
      ).costo_unitario,
    }));
  }, [formula, insumos, gamas]);

  const unidades = (id: number) => Number(mezcla[id]) || 0;
  const totalUnidades = costos.reduce((s, c) => s + unidades(c.gama_id), 0);
  const costoMezcla = costos.reduce((s, c) => s + unidades(c.gama_id) * c.costo, 0);
  /** El precio se decide por el TOTAL de unidades: es como se pacta el mayoreo. */
  const precioUnit = formula ? sugerirPrecio(formula.escalas, totalUnidades) : null;
  const facturado = precioUnit != null
    ? Math.round(precioUnit * totalUnidades * (1 - descuentoPct / 100))
    : 0;
  const utilidad = facturado - costoMezcla;
  const promedioPorPerfume = totalUnidades > 0 ? Math.round(costoMezcla / totalUnidades) : 0;

  if (!formula) return null;

  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium text-foreground">Tus costos y tu margen</p>
          <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
            Esto no sale en el documento del cliente. Como la lista de precios no dice qué
            fragancias van, el costo se calcula con el promedio de cada gama.
          </p>
        </div>
        {formulas.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {formulas.map((f) => (
              <button
                key={f.id} type="button"
                onClick={() => setTamanoId(f.id)}
                className={`rounded-full px-2.5 py-1 text-[12px] transition-colors ${
                  f.id === formula.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      {gamas.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-amber-700">
          Todavía no has clasificado ninguna esencia por gama. Ponle la gama a tus esencias
          en Inventario y aquí verás cuánto te cuesta cada una.
        </p>
      ) : (
        <>
          {/* Qué cuesta una unidad con cada gama, y qué margen deja en cada rango */}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[30rem] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-1.5 pr-3 font-semibold">Gama</th>
                  <th className="py-1.5 pr-3 text-right font-semibold">Un {formula.nombre} te cuesta</th>
                  {formula.escalas.map((e) => (
                    <th key={e.id} className="py-1.5 pr-3 text-right font-semibold">
                      {e.cantidad_max == null ? `${e.cantidad_min}+` : `${e.cantidad_min}-${e.cantidad_max}`} u
                      <span className="block font-normal normal-case text-muted-foreground">
                        {formatPrice(e.precio)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {costos.map((c) => (
                  <tr key={c.gama_id} className="border-b border-border/60 last:border-0">
                    <td className="py-1.5 pr-3 text-foreground">
                      {c.gama}
                      <span className="block text-[11px] text-muted-foreground">
                        {formatPrice(c.promedio)}/ml · {c.esencias} esencias
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-right font-semibold tabular-nums text-foreground">
                      {formatPrice(c.costo)}
                    </td>
                    {formula.escalas.map((e) => {
                      const m = margenPct(e.precio, c.costo);
                      return (
                        <td key={e.id}
                          className={`py-1.5 pr-3 text-right tabular-nums ${
                            m < 0 ? 'font-semibold text-destructive'
                              : m < 35 ? 'font-medium text-amber-700'
                              : 'text-muted-foreground'
                          }`}>
                          {m}%
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {formula.escalas.length === 0 && (
              <p className="mt-2 text-[12px] text-amber-700">
                Este tamaño todavía no tiene precios por cantidad. Ponlos en Tamaños y
                fórmulas y aquí verás el margen de cada rango.
              </p>
            )}
          </div>

          {/* Mezcla esperada: lo que de verdad se pide en un pedido grande */}
          <div className="mt-3.5 rounded-lg border border-border bg-card p-3">
            <p className="text-[12.5px] font-medium text-foreground">
              ¿Cómo crees que va a repartir el pedido?
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
              Un pedido grande casi nunca es de una sola gama. Escribe cuántas de cada una y
              te digo cuánto te cuesta el pedido completo y cuánto ganas.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {costos.map((c) => (
                <label key={c.gama_id} className="w-28">
                  <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">
                    {c.gama}
                  </span>
                  <Input
                    type="number" min="0" placeholder="0"
                    className="h-8 text-right text-[12.5px] tabular-nums"
                    value={mezcla[c.gama_id] ?? ''}
                    onChange={(ev) => setMezcla((m) => ({ ...m, [c.gama_id]: ev.target.value }))}
                  />
                </label>
              ))}
            </div>

            {totalUnidades > 0 && (
              <div className="mt-2.5 border-t border-border pt-2.5 text-[12.5px]">
                <p className="text-muted-foreground">
                  <strong className="text-foreground">{totalUnidades} unidades</strong> te cuestan{' '}
                  <strong className="text-foreground">{formatPrice(costoMezcla)}</strong> —
                  eso es <strong className="text-foreground">{formatPrice(promedioPorPerfume)}</strong> por perfume.
                </p>
                {precioUnit == null ? (
                  <p className="mt-1 text-amber-700">
                    No hay un precio definido para {totalUnidades} unidades: agrega ese rango en
                    Tamaños y fórmulas para ver la ganancia.
                  </p>
                ) : (
                  <p className="mt-1 text-muted-foreground">
                    A {formatPrice(precioUnit)} cada uno
                    {descuentoPct > 0 && ` (menos ${descuentoPct}% de descuento)`} facturas{' '}
                    <strong className="text-foreground">{formatPrice(facturado)}</strong> y ganas{' '}
                    <strong className={utilidad < 0 ? 'text-destructive' : 'text-primary'}>
                      {formatPrice(utilidad)}
                    </strong>{' '}
                    <span className={margenPct(facturado, costoMezcla) < 35 ? 'text-amber-700' : ''}>
                      (margen {margenPct(facturado, costoMezcla)}%)
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
