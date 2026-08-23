import { Button } from '@/components/ui/button';
import { SelectSimple } from '@/components/ui/select-simple';

/**
 * Cómo se navega una tabla larga: cuántas filas por página y a cuál ir.
 *
 * Salió de `SmartTable.tsx` (iba en 538 líneas) con las dos cosas que solo él
 * usaba —las opciones de tamaño y el cálculo de qué números mostrar—, para que
 * la tabla se quede con lo suyo: pintar columnas y filas.
 */

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100] as const;

function getPages(page: number, totalPages: number, compacto: boolean): (number | '...')[] {
  // En pantallas angostas el paginador completo no cabe y se desbordaba del
  // borde de la tarjeta: se muestra una ventana de máximo 5 posiciones.
  if (compacto) {
    if (totalPages <= 4) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 2) return [1, 2, 3, '...', totalPages];
    if (page >= totalPages - 1) return [1, '...', totalPages - 2, totalPages - 1, totalPages];
    return [1, '...', page, '...', totalPages];
  }
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, '...', totalPages];
  if (page >= totalPages - 3) return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, '...', page - 1, page, page + 1, '...', totalPages];
}


export function PaginadorTabla({ tamano, onTamano, pagina, totalPaginas, onPagina, compacto }: {
  tamano: number;
  onTamano: (n: number) => void;
  pagina: number;
  totalPaginas: number;
  onPagina: (n: number) => void;
  /** Pantalla angosta: el paginador completo no cabe y se muestra una ventana. */
  compacto: boolean;
}) {
  return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <label htmlFor="st-ps">Filas:</label>
          <SelectSimple
            id="st-ps"
            className="w-18"
            value={tamano}
            onChange={e => onTamano(Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </SelectSimple>
        </div>

        {totalPaginas > 1 && (
          <div className="flex flex-wrap items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={pagina === 1}
              onClick={() => onPagina(pagina - 1)}
              aria-label="Página anterior"
            >
              ‹
            </Button>
            {getPages(pagina, totalPaginas, compacto).map((p, i) =>
              p === '...' ? (
                <span key={`e${i}`} className="px-1 text-muted-foreground">…</span>
              ) : (
                <Button
                  key={p}
                  variant={p === pagina ? 'default' : 'outline'}
                  size="icon"
                  className="size-8 text-xs"
                  onClick={() => onPagina(p as number)}
                >
                  {p}
                </Button>
              )
            )}
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={pagina === totalPaginas}
              onClick={() => onPagina(pagina + 1)}
              aria-label="Página siguiente"
            >
              ›
            </Button>
          </div>
        )}
      </div>
  );
}
