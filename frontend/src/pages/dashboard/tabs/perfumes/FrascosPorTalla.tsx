import { SelectSimple } from '@/components/ui/select-simple';
import type { Lookup, PerfumeForm } from '../../types';

/** Un insumo elegible como frasco de una talla. */
export interface Envase { id: number; nombre: string; precio?: number }

/**
 * ¿Esta ficha ya usa un frasco distinto del del tamaño? Si sí, la sección
 * arranca abierta para que no quede escondido lo que cuenta.
 */
const tieneDistintos = (form: PerfumeForm, tallas: Lookup[]) => tallas.some(pr => !!form.envases_talla[pr.id]);

/**
 * El frasco por talla, plegado. La bolsa y el perfumero ya no van aquí
 * (2026-10-04): son el empaque por línea, en Catálogo → Empaque.
 *
 * Casi siempre va el del tamaño (el de la receta), así que esto vive
 * cerrado: antes eran dos desplegables por talla siempre a la vista, y una
 * ficha con cuatro tallas eran ocho controles que nadie tocaba (dueño,
 * 2026-10-02). El frasco sí cambia a veces según la referencia: un 1.1 de
 * Sauvage no usa el mismo que uno de Bleu.
 */
export function FrascosPorTalla({ form, setForm, tallas, envases }: {
  form: PerfumeForm;
  setForm: React.Dispatch<React.SetStateAction<PerfumeForm>>;
  tallas: Lookup[];
  envases: Envase[];
}) {
  return (
    <details className="group text-[12.5px]" open={tieneDistintos(form, tallas) || undefined}>
      <summary className="cursor-pointer font-medium text-primary">
        Frasco distinto por talla
        <span className="font-normal text-muted-foreground"> · si no, va el del tamaño</span>
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
          </div>
        ))}
      </div>
    </details>
  );
}
