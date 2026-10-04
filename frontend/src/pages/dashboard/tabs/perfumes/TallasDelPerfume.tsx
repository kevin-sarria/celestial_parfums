import { Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Field } from '../../ui';
import { formatPrice } from '../../helpers';
import type { Lookup, PerfumeForm } from '../../types';
import { FrascosPorTalla, type Envase } from './FrascosPorTalla';
import { esBotellaCompleta, heredaPrecioGeneral } from '../../../../domain/entities/decants';
import { useCostosDeFicha } from './useCostosDeFicha';

/** La botella de un original: su costo por ml y cuánto trae. */
export interface BotellaOriginal { id: number; precio: number; ml_botella?: number | null }

/**
 * De la más pequeña a la más grande, y lo que no es tamaño ("200/250ML",
 * "Combo Personalizado") al final. Antes salían en el orden del texto —100,
 * 10, 125, 3, 30…— y el dueño tenía que buscar la talla en la lista
 * (2026-10-02).
 */
const porTamano = (a: Lookup, b: Lookup) =>
  (a.ml ?? Infinity) - (b.ml ?? Infinity) || a.nombre.localeCompare(b.nombre);

/**
 * Qué tallas vende este perfume, a qué precio y en qué frasco.
 *
 * Rediseñada el 2026-10-02 porque al dueño le parecía "poco intuitiva y
 * estorbosa": cada talla marcada abría tres renglones (precio, frasco y
 * accesorios) aunque casi nunca se cambian. La bolsa y el perfumero ya no
 * van aquí desde el 2026-10-04: son el empaque por línea (Catálogo → Empaque).
 * Ahora son tres piezas, de lo diario a lo raro:
 *   1. Las tallas como botones, ordenadas por tamaño: se marcan de un toque.
 *   2. Un renglón por talla marcada: su precio, lo que cuesta y lo que deja.
 *   3. El frasco distinto por talla, plegado (`FrascosPorTalla`).
 *
 * Recibe el formulario entero y su `setForm`: el dueño del estado sigue siendo
 * la pestaña, que es quien lo guarda.
 */
export function TallasDelPerfume({ form, setForm, presentaciones, envases, precioDeLista, botella }: {
  form: PerfumeForm;
  setForm: React.Dispatch<React.SetStateAction<PerfumeForm>>;
  presentaciones: Lookup[];
  envases: Envase[];
  /** Lo que ya cuesta esa talla por la lista de su categoría (null = sin precio). */
  precioDeLista: (presentacionId: number) => number | null;
  /**
   * Solo originales: la botella de la que salen. Con ella cada talla dice
   * cuánto cuesta —el dueño pidió ver eso al lado del precio para no vender a
   * pérdida (2026-09-29)— y cuál es la botella completa.
   */
  botella?: BotellaOriginal | null;
}) {
  const ordenadas = [...presentaciones].sort(porTamano);
  const activas = ordenadas.filter(pr => form.presentaciones.includes(pr.id));
  const esBotella = (pr: Lookup) => !!botella && pr.ml != null && esBotellaCompleta(pr.ml, botella.ml_botella);

  /**
   * Lo que cuesta UNA venta de esa talla, desglosado: lo calcula el servidor
   * con la misma cuenta de Precios de originales (líquido, merma, frasco y
   * empaque). Null = no hay con qué calcularlo (sin botella o sin costo aún).
   */
  const costos = useCostosDeFicha(botella?.id ?? null, activas.map(pr => ({
    presentacion_id: pr.id, envase_insumo_id: Number(form.envases_talla[pr.id]) || null,
  })));
  const costoDe = (pr: Lookup) => costos.get(pr.id)?.total ?? null;

  /**
   * El precio con que sale HOY, en la misma cascada que usa el servidor
   * (`perfume.mapeo.ts`): el propio, si no el de la lista, si no el general
   * del perfume. 0 = esa talla no sale en la tienda (opción B, 2026-10-02).
   */
  const heredado = (pr: Lookup) => {
    const deLista = precioDeLista(pr.id);
    if (deLista != null) return { valor: deLista, de: 'lista' };
    // Un decant de un original no hereda el precio de la botella (`heredaPrecioGeneral`)
    return heredaPrecioGeneral(form.tipo_producto, pr.ml, botella?.ml_botella)
      ? { valor: Number(form.precio) || 0, de: 'general' }
      : { valor: 0, de: 'general' };
  };
  const precioDe = (pr: Lookup) => Number(form.precios_propios[pr.id]) || heredado(pr).valor;

  const alternar = (id: number) => setForm(f => ({
    ...f,
    presentaciones: f.presentaciones.includes(id) ? f.presentaciones.filter(x => x !== id) : [...f.presentaciones, id],
  }));

  const hayCostos = activas.some(pr => costoDe(pr) != null);

  return (
    <Field label="Presentaciones y precio">
      <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tallas que vendes">
          {ordenadas.map(pr => {
            const activa = form.presentaciones.includes(pr.id);
            return (
              <button
                key={pr.id} type="button" aria-pressed={activa} onClick={() => alternar(pr.id)}
                className={cn(
                  'inline-flex h-9 items-center gap-1 rounded-full border px-3 text-[13px] transition-colors sm:h-8',
                  activa
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:border-primary/50',
                )}
              >
                {activa && <Check className="size-3.5" />}
                {pr.nombre}
                {esBotella(pr) && <span className={activa ? 'opacity-80' : 'text-primary'}>· botella</span>}
              </button>
            );
          })}
        </div>

        {activas.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">Toca las tallas que vendes.</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-border bg-card">
            <div className="hidden grid-cols-[5.5rem_minmax(0,1fr)_7rem_7rem] gap-3 border-b border-border bg-secondary/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
              <span>Talla</span><span>Precio</span>
              <span className="text-right">{hayCostos ? 'Te cuesta' : ''}</span>
              <span className="text-right">{hayCostos ? 'Ganas' : ''}</span>
            </div>
            {activas.map(pr => {
              const base = heredado(pr);
              const precio = precioDe(pr);
              const costo = costoDe(pr);
              return (
                <div key={pr.id}
                  className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 border-b border-border px-3 py-2 last:border-b-0 sm:grid-cols-[5.5rem_minmax(0,1fr)_7rem_7rem]">
                  <span className="text-[13px] font-medium text-foreground">
                    {pr.nombre}
                    {esBotella(pr) && <span className="block text-[11px] font-normal text-primary">botella completa</span>}
                  </span>
                  <div className="min-w-0">
                    <Input
                      type="number" min="0" className="h-9 sm:h-8"
                      aria-label={`Precio de ${pr.nombre}`}
                      placeholder={base.valor > 0 ? `${formatPrice(base.valor)} (${base.de})` : 'Sin precio'}
                      value={form.precios_propios[pr.id] ?? ''}
                      onChange={e => setForm(f => ({ ...f, precios_propios: { ...f.precios_propios, [pr.id]: e.target.value } }))}
                    />
                    {!(precio > 0) && (
                      <span className="mt-0.5 block text-[11.5px] text-amber-700">Sin precio: no sale en la tienda</span>
                    )}
                  </div>
                  {/* En el celular el costo y la ganancia bajan debajo del precio */}
                  <span className="col-start-2 text-[12px] tabular-nums text-muted-foreground sm:col-start-auto sm:text-right">
                    {costo != null && <><span className="sm:hidden">te cuesta </span>{formatPrice(costo)}</>}
                  </span>
                  <span className={cn('col-start-2 text-[12.5px] font-semibold tabular-nums sm:col-start-auto sm:text-right',
                    costo != null && precio > 0 && precio - costo < 0 ? 'text-destructive' : 'text-foreground')}>
                    {costo != null && precio > 0 && <><span className="font-normal text-muted-foreground sm:hidden">ganas </span>{formatPrice(precio - costo)}</>}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {form.tipo_producto !== 'comprado' && activas.length > 0 && (
          <FrascosPorTalla form={form} setForm={setForm} tallas={activas} envases={envases} />
        )}
      </div>
    </Field>
  );
}
