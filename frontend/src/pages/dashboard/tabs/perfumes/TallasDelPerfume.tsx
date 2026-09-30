import { Input } from '@/components/ui/input';
import { SelectSimple } from '@/components/ui/select-simple';
import { Field } from '../../ui';
import { formatPrice } from '../../helpers';
import type { Lookup, PerfumeForm } from '../../types';
import { AccesoriosDeTalla, type OpcionAccesorio } from './AccesoriosDeTalla';
import { esBotellaCompleta, mlQueSalenDeLaBotella } from '../../../../domain/entities/decants';

/** Un insumo elegible como frasco de una talla. */
interface Envase { id: number; nombre: string; precio?: number }

/** La botella de un original: su costo por ml y cuánto trae. */
export interface BotellaOriginal { precio: number; ml_botella?: number | null }

/**
 * Qué tallas vende este perfume, a qué precio y en qué frasco.
 *
 * Salió de `PerfumesTab.tsx` (iba en 547 líneas) porque es lo más enredado del
 * formulario y lo que menos tiene que ver con el resto de la ficha: aquí se
 * cruzan tres cosas por cada talla —si se vende, si cuesta distinto de lo que
 * dice la lista de precios, y con qué frasco se arma—, y cada una vive en un
 * campo distinto del formulario.
 *
 * Recibe el formulario entero y su `setForm`: el dueño del estado sigue siendo
 * la pestaña, que es quien lo guarda.
 */
export function TallasDelPerfume({ form, setForm, presentaciones, envases, accesorios, precioDeLista, botella }: {
  form: PerfumeForm;
  setForm: React.Dispatch<React.SetStateAction<PerfumeForm>>;
  presentaciones: Lookup[];
  envases: Envase[];
  accesorios: OpcionAccesorio[];
  /** Lo que ya cuesta esa talla por la lista de su categoría (null = sin precio). */
  precioDeLista: (presentacionId: number) => number | null;
  /**
   * Solo originales: la botella de la que salen. Con ella cada talla dice
   * cuánto cuesta —el dueño pidió ver eso al lado del precio para no vender a
   * pérdida (2026-09-29)— y cuál es la botella completa.
   */
  botella?: BotellaOriginal | null;
}) {
  /**
   * Lo que cuesta UNA venta de esa talla: los ml que salen de la botella (con la
   * pérdida del trasvase si es decant) más su frasco de decant, si tiene uno
   * propio. Null = no hay con qué calcularlo (sin botella o sin costo aún).
   */
  const costoDe = (ml: number | null | undefined, presentacionId: number) => {
    if (!botella || !(botella.precio > 0) || ml == null) return null;
    const liquido = mlQueSalenDeLaBotella(ml, botella.ml_botella) * botella.precio;
    const envase = esBotellaCompleta(ml, botella.ml_botella) ? 0
      : envases.find(v => v.id === form.envases_talla[presentacionId])?.precio ?? 0;
    return Math.round(liquido + envase);
  };
  const toggleId = (ids: number[], id: number) => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
  return (
    <Field label="Presentaciones y precio">
      <div className="space-y-1.5 rounded-lg border border-border bg-secondary/30 p-2.5">
        <p className="text-[12px] text-muted-foreground">
          Marca las tallas que vendes. Cada una cobra el precio de la lista de su
          categoría; escribe un valor solo si ESTE perfume cuesta distinto.
        </p>
        {presentaciones.map(pr => {
          const activa = form.presentaciones.includes(pr.id);
          const deLista = precioDeLista(pr.id);
          return (
            // `flex-wrap`: en celular los cuatro controles (nombre, precio,
            // nota y frasco) no caben en una línea y la fila se desbordaba
            // por fuera del modal. Bajan de renglón en vez de salirse.
            <div key={pr.id} className="flex flex-wrap items-center gap-2">
              <label className="flex min-w-28 flex-1 cursor-pointer items-center gap-2 text-[13px] text-foreground">
                <input
                  type="checkbox" className="size-4 accent-primary" checked={activa}
                  onChange={() => setForm(f => ({
                    ...f,
                    presentaciones: toggleId(f.presentaciones, pr.id),
                    // Un 1.1 NO lleva bolsa ni perfumero: la talla nueva arranca
                    // en "Ninguno" (el dueño la cambia si ese sí los lleva).
                    accesorios_talla: f.solo_armado && !(pr.id in f.accesorios_talla)
                      ? { ...f.accesorios_talla, [pr.id]: [] }
                      : f.accesorios_talla,
                  }))}
                />
                {pr.nombre}
                {botella && pr.ml != null && esBotellaCompleta(pr.ml, botella.ml_botella) && (
                  <span className="text-[11.5px] font-medium text-primary">botella completa</span>
                )}
              </label>
              {activa && (
                <>
                  <Input
                    type="number" min="0" className="h-8 max-w-32 text-[13px]"
                    placeholder={deLista != null ? `Lista: ${deLista}` : 'Precio'}
                    value={form.precios_propios[pr.id] ?? ''}
                    onChange={e => setForm(f => ({
                      ...f,
                      precios_propios: { ...f.precios_propios, [pr.id]: e.target.value },
                    }))}
                  />
                  <span className="w-24 shrink-0 text-[12px] text-muted-foreground">
                    {form.precios_propios[pr.id]
                      ? 'precio propio'
                      : deLista != null
                        ? formatPrice(deLista)
                        : 'sin precio'}
                  </span>
                  {costoDe(pr.ml, pr.id) != null && (
                    <span className="w-28 shrink-0 text-[12px] text-muted-foreground">
                      te cuesta <strong className="font-semibold text-foreground">{formatPrice(costoDe(pr.ml, pr.id)!)}</strong>
                    </span>
                  )}
                  {/* El frasco cambia según la referencia: un 1.1 de Sauvage
                      no usa el mismo que uno de Bleu. Vacío = el del tamaño. */}
                  {form.tipo_producto !== 'comprado' && (
                    <SelectSimple
                      className="h-8 max-w-48"
                      value={form.envases_talla[pr.id] ?? ''}
                      onChange={e => setForm(f => ({
                        ...f,
                        envases_talla: { ...f.envases_talla, [pr.id]: Number(e.target.value) || '' },
                      }))}
                    >
                      <option value="">Frasco del tamaño</option>
                      {envases.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                    </SelectSimple>
                  )}
                  {form.tipo_producto !== 'comprado' && (
                    <AccesoriosDeTalla
                      valor={form.accesorios_talla[pr.id] ?? null}
                      opciones={accesorios}
                      onCambio={v => setForm(f => ({ ...f, accesorios_talla: { ...f.accesorios_talla, [pr.id]: v } }))}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </Field>
  );
}
