import { Check, ClipboardCopy, FlaskConical, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Section } from '../../ui';
import { formatPrice } from '../../helpers';
import type { useAjustesPedido } from './useAjustesPedido';

/**
 * Una de las dos listas del pedido sugerido (esencias e implementos).
 *
 * **Vive en su propio archivo a propósito, no dentro de `ReposicionTab`.** Es la
 * corrección de un fallo que reportó el dueño el 2026-08-14: *"al cambiar el
 * número de ml de una esencia a pedir hace como una recarga de página molesta"*.
 *
 * Declarada dentro del componente de la pantalla, en CADA tecla era una función
 * nueva; React la tomaba por otro componente distinto y **desmontaba y volvía a
 * montar la tabla entera**. El campo se destruía a media escritura: se perdía el
 * foco y el valor tecleado volvía al sugerido.
 *
 * Regla general: **un componente nunca se declara dentro de otro.** Si necesita
 * datos del padre, se los pasa por props — que es justo lo que hace este.
 */

export interface Fila {
  id: number; nombre: string; tipo: string; unidad: string;
  gama: string | null;
  stock: number; minimo: number; minimo_heredado: boolean;
  consumo_diario: number; sugerido: number;
  base: 'consumo' | 'minimo';
  costo_promedio: number; costo_estimado: number;
}

export const cantidad = (n: number, unidad: string) =>
  `${n.toLocaleString('es-CO', { maximumFractionDigits: 2 })} ${unidad === 'ml' ? 'ml' : 'u'}`;

interface Props {
  titulo: string;
  filas: Fila[];
  nota: string;
  ajustes: ReturnType<typeof useAjustesPedido>;
  copiado: boolean;
  onCopiar: (filas: Fila[]) => void;
  /**
   * Marcar el material como EN PRUEBA: deja de sugerirse hasta que el dueño lo
   * desmarque. Es la versión PERMANENTE de "sacar del pedido" —que solo vale
   * para esta vuelta y vive en el navegador—, y por eso son dos botones
   * distintos y no uno: sacar es "hoy no", en prueba es "todavía no me
   * interesa reponerlo".
   */
  onEnPrueba: (f: Fila) => void;
}

export function TablaPedido({ titulo, filas, nota, ajustes, copiado, onCopiar, onEnPrueba }: Props) {
  // Lo quitado sale de la tabla pero NO desaparece: se lista abajo para poder
  // devolverlo. Dejar caer algo en silencio es justo lo que no se hace aquí.
  const visibles = filas.filter((f) => !ajustes.estaQuitado(f.id));
  const fuera = filas.filter((f) => ajustes.estaQuitado(f.id));

  return (
    <Section>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13.5px] font-medium text-foreground">{titulo} ({visibles.length})</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{nota}</p>
        </div>
        {visibles.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => onCopiar(filas)}>
            {copiado ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
            Copiar la lista
          </Button>
        )}
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-lg border border-border bg-secondary/40 px-3 py-4 text-center text-[12.5px] text-muted-foreground">
          {filas.length === 0 ? 'Nada por pedir aquí.' : 'Sacaste todo de esta lista.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-136 border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5 pr-3 font-semibold">Material</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Te queda</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Mínimo</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Pide</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Te costará</th>
                <th className="py-1.5 font-semibold"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr key={f.id} className="border-b border-border/60 last:border-0">
                  <td className="py-1.5 pr-3 text-foreground">
                    {f.nombre}
                    {f.gama && <span className="block text-[11px] text-muted-foreground">{f.gama}</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-destructive">
                    {cantidad(f.stock, f.unidad)}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">
                    {cantidad(f.minimo, f.unidad)}
                    {f.minimo_heredado && (
                      <span className="block text-[10.5px]">de su gama</span>
                    )}
                  </td>
                  {/* La cantidad se teclea: el sistema propone, el dueño decide.
                      Debajo se sigue diciendo de dónde salía el número sugerido,
                      y si lo cambió, cuál era — para poder volver sin recargar. */}
                  <td className="py-1.5 pr-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Input
                        type="number" min="0" step="any"
                        aria-label={`Cuánto pedir de ${f.nombre}`}
                        className="h-8 w-24 text-right text-[12.5px] tabular-nums"
                        value={ajustes.cantidadDe(f.id, f.sugerido)}
                        onChange={(e) => ajustes.fijarCantidad(
                          f.id, e.target.value === '' ? null : Number(e.target.value))}
                      />
                      <span className="w-5 text-left text-[11px] text-muted-foreground">
                        {f.unidad === 'ml' ? 'ml' : 'u'}
                      </span>
                    </div>
                    <span className="block text-[10.5px] font-normal text-muted-foreground">
                      {ajustes.fueTocado(f.id)
                        ? `sugería ${cantidad(f.sugerido, f.unidad)}`
                        : f.base === 'consumo' ? 'por lo que gastas' : 'para el colchón'}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">
                    {formatPrice(Math.round(ajustes.cantidadDe(f.id, f.sugerido) * f.costo_promedio))}
                  </td>
                  <td className="py-1.5 text-right">
                    <button
                      onClick={() => onEnPrueba(f)}
                      aria-label={`Marcar ${f.nombre} como en prueba`}
                      title="En prueba: no me lo vuelvas a sugerir hasta que yo lo desmarque"
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                    >
                      <FlaskConical className="size-4" />
                    </button>
                    <button
                      onClick={() => ajustes.quitar(f.id)}
                      aria-label={`Sacar ${f.nombre} de este pedido`}
                      title="Sacar de este pedido"
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lo que se sacó sigue a la vista y se puede devolver de un clic: el
          material NO dejó de estar bajo mínimo, solo no entra en este pedido. */}
      {fuera.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/70 pt-2 text-[11.5px] text-muted-foreground">
          <span>Sacaste de este pedido:</span>
          {fuera.map((f) => (
            <button
              key={f.id}
              onClick={() => ajustes.devolver(f.id)}
              className="rounded-full border border-border px-2 py-0.5 transition-colors hover:border-primary/40 hover:text-foreground"
              title="Volver a incluirlo"
            >
              {f.nombre} <span className="text-primary">+</span>
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}
