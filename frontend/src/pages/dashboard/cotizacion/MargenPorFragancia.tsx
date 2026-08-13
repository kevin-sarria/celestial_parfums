import { useMemo, useState } from 'react';
import { AlertTriangle, TrendingDown } from 'lucide-react';
import { SelectSimple } from '@/components/ui/select-simple';
import { formatPrice } from '../helpers';
import { calcularDesgloseCosto } from '../../../application/costeoCotizacion';
import type { FormulaVolumen, Insumo } from '../../../domain/entities/cotizacion.types';
import type { Perfume } from '../../../domain/entities/perfume.schema';

interface Props {
  perfumes: Perfume[];
  formulas: FormulaVolumen[];
  insumos: Insumo[];
}

/** Debajo de esto, la fragancia deja de compensar aunque se venda al precio estándar. */
const MARGEN_FLOJO = 35;

/**
 * Rentabilidad real de cada fragancia al PRECIO ESTÁNDAR.
 *
 * El negocio cobra lo mismo por todas las no premium (política del dueño: se
 * renuncia a la ganancia extra de las esencias baratas para tener un precio
 * parejo). Eso es una decisión válida, pero solo se sostiene si se ve **cuánto
 * margen deja cada una**: una esencia que sube de precio puede dejar de rendir
 * sin que nadie se entere, porque el precio de venta no se mueve.
 */
export default function MargenPorFragancia({ perfumes, formulas, insumos }: Props) {
  const [volumenId, setVolumenId] = useState<number | ''>(formulas[0]?.id ?? '');
  const formula = formulas.find((f) => f.id === volumenId) ?? null;

  const filas = useMemo(() => {
    if (!formula) return [];
    return perfumes
      .map((p) => {
        // Precio estándar de ESTA talla (sale de la lista de precios del negocio)
        const talla = (p.precios ?? []).find(
          (pr) => pr.presentacion.toLowerCase().replace(/\s/g, '')
            === formula.nombre.toLowerCase().replace(/\s/g, ''),
        );
        const precio = talla?.precio ?? 0;
        const costo = calcularDesgloseCosto(
          formula, insumos, formula.accesorios_default ?? [], p.insumo_esencia_precio,
        ).costo_unitario;
        const utilidad = precio - costo;
        const margen = precio > 0 ? Math.round((utilidad / precio) * 1000) / 10 : 0;
        return {
          id: p.id,
          nombre: p.nombre,
          esencia: p.insumo_esencia_nombre,
          premium: p.esencia_premium,
          precio, costo, utilidad, margen,
        };
      })
      // Sin esencia asignada el costo sería el genérico: no dice nada útil
      .filter((f) => f.esencia && f.precio > 0)
      .sort((a, b) => a.margen - b.margen);
  }, [perfumes, formula, insumos]);

  const enRojo = filas.filter((f) => f.utilidad < 0);
  const flojas = filas.filter((f) => f.utilidad >= 0 && f.margen < MARGEN_FLOJO);

  if (formulas.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <TrendingDown className="size-3.5" /> Margen por fragancia
        </h3>
        <SelectSimple className="h-8 w-32" value={volumenId}
          onChange={(e) => setVolumenId(Number(e.target.value) || '')}>
          {formulas.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
        </SelectSimple>
      </div>

      <p className="mb-3 text-[12.5px] leading-relaxed text-muted-foreground">
        Todas se venden al mismo precio, así que la que tiene la esencia más cara deja menos
        ganancia. Eso está bien mientras sepas cuáles son: aquí salen ordenadas de la que
        menos deja a la que más.
      </p>

      {filas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-[13px] text-muted-foreground">
          Todavía ningún perfume tiene su esencia asignada. Ponsela en su ficha del catálogo
          para ver cuánto deja cada fragancia de verdad.
        </p>
      ) : (
        <>
          {enRojo.length > 0 && (
            <p className="mb-2.5 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12.5px] font-medium text-destructive">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {enRojo.length === 1 ? 'Una fragancia se está vendiendo por debajo del costo'
                  : `${enRojo.length} fragancias se están vendiendo por debajo del costo`}:
                {' '}{enRojo.map((f) => f.nombre).join(', ')}. Ahí ya no estás renunciando a
                ganancia extra: estás poniendo plata.
              </span>
            </p>
          )}
          {enRojo.length === 0 && flojas.length > 0 && (
            <p className="mb-2.5 rounded-lg border border-amber-400/45 bg-amber-400/10 px-3 py-2 text-[12.5px] font-medium text-amber-700">
              {flojas.length} {flojas.length === 1 ? 'fragancia deja' : 'fragancias dejan'} menos
              del {MARGEN_FLOJO}%. Ojo con darles cupón o precio de combo: ahí es donde se
              vuelven pérdida.
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">Fragancia</th>
                  <th className="py-2 pr-3 font-semibold">Su esencia</th>
                  <th className="py-2 pr-3 text-right font-semibold">Te cuesta</th>
                  <th className="py-2 pr-3 text-right font-semibold">La vendes a</th>
                  <th className="py-2 text-right font-semibold">Te deja</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 text-foreground">
                      {f.nombre}
                      {f.premium && <span className="ml-1.5 text-[11px] text-primary">premium</span>}
                    </td>
                    <td className="py-2 pr-3 text-[12.5px] text-muted-foreground">{f.esencia}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{formatPrice(f.costo)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-foreground">{formatPrice(f.precio)}</td>
                    <td className={`py-2 text-right tabular-nums font-medium ${
                      f.utilidad < 0 ? 'text-destructive'
                        : f.margen < MARGEN_FLOJO ? 'text-amber-700' : 'text-emerald-600'}`}>
                      {f.utilidad >= 0 ? '+' : ''}{formatPrice(f.utilidad)} ({f.margen}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
