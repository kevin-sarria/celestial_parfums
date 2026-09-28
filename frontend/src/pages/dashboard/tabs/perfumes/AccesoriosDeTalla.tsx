import { SelectSimple } from '@/components/ui/select-simple';
import { cn } from '@/lib/utils';

export interface OpcionAccesorio { id: number; nombre: string }

type Modo = 'tamano' | 'ninguno' | 'propios';

/**
 * Qué accesorios lleva ESTA talla de ESTE producto.
 *
 * Tres respuestas, que el servidor guarda distinto (ver
 * `backend/src/repositories/accesoriosDeFicha.ts`):
 *   - "Los del tamaño" → null: los de la receta (bolsa y perfumero en 100 ml).
 *   - "Ninguno"        → []: lo normal en un 1.1 (dueño, 2026-08-30).
 *   - "Elegir…"        → la lista que se marque.
 *
 * Existe desde el 2026-09-27: antes no había cómo decir "ninguno" y los 27
 * lotes 1.1 del negocio cargaron bolsa y perfumero que no llevaban ($54.300).
 */
export function AccesoriosDeTalla({ valor, opciones, onCambio }: {
  valor: number[] | null;
  opciones: OpcionAccesorio[];
  onCambio: (v: number[] | null) => void;
}) {
  const modo: Modo = valor == null ? 'tamano' : valor.length === 0 ? 'ninguno' : 'propios';

  const cambiarModo = (m: Modo) => {
    if (m === 'tamano') onCambio(null);
    else if (m === 'ninguno') onCambio([]);
    // Al pasar a "Elegir…" se arranca con el primero marcado: una lista vacía
    // sería "ninguno" y el selector saltaría solo a esa opción.
    else if (opciones[0]) onCambio([opciones[0].id]);
  };

  const alternar = (id: number) => {
    const actual = valor ?? [];
    const siguiente = actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id];
    onCambio(siguiente);
  };

  return (
    <div className="flex w-full flex-wrap items-center gap-2 pl-6 text-[12px] text-muted-foreground">
      <span>Accesorios:</span>
      <SelectSimple
        className="h-8 w-40"
        aria-label="Accesorios de esta talla"
        value={modo}
        onChange={(e) => cambiarModo(e.target.value as Modo)}
      >
        <option value="tamano">Los del tamaño</option>
        <option value="ninguno">Ninguno</option>
        {opciones.length > 0 && <option value="propios">Elegir…</option>}
      </SelectSimple>
      {modo === 'propios' && (
        <div className="flex flex-wrap gap-1.5">
          {opciones.map((o) => {
            const marcado = valor?.includes(o.id) ?? false;
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={marcado}
                onClick={() => alternar(o.id)}
                className={cn(
                  'h-7 rounded-full border px-2.5 text-[12px] transition-colors',
                  marcado ? 'border-primary bg-brand-soft text-primary' : 'border-border bg-card hover:text-foreground',
                )}
              >
                {o.nombre}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
