import { SelectSimple } from '@/components/ui/select-simple';
import type { Lookup, PerfumeForm } from '../../types';
import { AccesoriosDeTalla, type OpcionAccesorio } from './AccesoriosDeTalla';

/** Un insumo elegible como frasco de una talla. */
export interface Envase { id: number; nombre: string; precio?: number }

/**
 * ¿Esta ficha ya usa un frasco o accesorios distintos de los del tamaño?
 * Si sí, la sección arranca abierta para que no quede escondido lo que cuenta.
 * El "Ninguno" de un 1.1 no cuenta: es su valor de siempre (ver `alternar` en
 * `TallasDelPerfume`).
 */
const tieneDistintos = (form: PerfumeForm, tallas: Lookup[]) => tallas.some(pr =>
  !!form.envases_talla[pr.id]
  || (form.accesorios_talla[pr.id] != null && !(form.solo_armado && form.accesorios_talla[pr.id]!.length === 0)));

/**
 * Frasco y accesorios por talla, plegados.
 *
 * Casi siempre van los del tamaño (los de la receta), así que esto vive
 * cerrado: antes eran dos desplegables por talla siempre a la vista, y una
 * ficha con cuatro tallas eran ocho controles que nadie tocaba (dueño,
 * 2026-10-02). El frasco sí cambia a veces según la referencia: un 1.1 de
 * Sauvage no usa el mismo que uno de Bleu.
 */
export function FrascosPorTalla({ form, setForm, tallas, envases, accesorios }: {
  form: PerfumeForm;
  setForm: React.Dispatch<React.SetStateAction<PerfumeForm>>;
  tallas: Lookup[];
  envases: Envase[];
  accesorios: OpcionAccesorio[];
}) {
  return (
    <details className="group text-[12.5px]" open={tieneDistintos(form, tallas) || undefined}>
      <summary className="cursor-pointer font-medium text-primary">
        Frasco y accesorios distintos por talla
        <span className="font-normal text-muted-foreground"> · si no, van los del tamaño</span>
      </summary>
      <div className="mt-2 space-y-2.5">
        {tallas.map(pr => (
          <div key={pr.id} className="space-y-1.5 rounded-md border border-border bg-card p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 shrink-0 font-medium text-foreground">{pr.nombre}</span>
              <SelectSimple
                className="h-8 min-w-0 flex-1 sm:max-w-56"
                aria-label={`Frasco de ${pr.nombre}`}
                value={form.envases_talla[pr.id] ?? ''}
                onChange={e => setForm(f => ({
                  ...f,
                  envases_talla: { ...f.envases_talla, [pr.id]: Number(e.target.value) || '' },
                }))}
              >
                <option value="">Frasco del tamaño</option>
                {envases.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
              </SelectSimple>
            </div>
            <AccesoriosDeTalla
              valor={form.accesorios_talla[pr.id] ?? null}
              opciones={accesorios}
              onCambio={v => setForm(f => ({ ...f, accesorios_talla: { ...f.accesorios_talla, [pr.id]: v } }))}
            />
          </div>
        ))}
      </div>
    </details>
  );
}
