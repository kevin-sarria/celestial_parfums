import { type ReactNode, useState, useRef, useCallback } from 'react';
import { Search, X, Filter, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ColumnDef, FilterValue, FiltersState } from './tableTypes';
import { useTableControls } from './useTableControls';
import { useMediaQuery } from './useMediaQuery';
import { FilaTarjeta } from './FilaTarjeta';
import { ColumnFilterPopover } from './ColumnFilterPopover';
import { PaginadorTabla } from './PaginadorTabla';


/**
 * Por defecto de la paginación en el navegador. Es distinto del
 * DEFAULT_PAGE_SIZE = 10 de helpers.ts a propósito: ese aplica a las pestañas
 * que piden página por página al servidor, donde cada página cuesta una
 * petición. Aquí las filas ya están todas en memoria, así que cortar de a 10
 * solo obliga a paginar más sin ahorrar nada.
 */
const PAGE_SIZE_LOCAL = 25;

interface PaginationProps {
  page: number;
  totalRows: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

interface SmartTableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  rowKey?: (row: T) => string | number;
  renderActions?: (row: T) => ReactNode;
  emptyText?: string;
  pagination?: PaginationProps;
  /**
   * Si se define, la búsqueda global se delega al servidor (busca en TODA la data,
   * no solo en la página cargada). Se dispara con debounce de 2s tras dejar de escribir;
   * al vaciar el campo se restaura la lista original de inmediato.
   */
  onServerSearch?: (term: string) => void;
  /**
   * Si se define, los filtros de columna se delegan al servidor (filtran TODA
   * la data, no solo la página cargada). Se dispara al Aplicar/Limpiar de
   * cada filtro y al "Limpiar todo" — a diferencia de la búsqueda, no lleva
   * debounce: ya es una acción deliberada, no tecleo.
   */
  onServerFilter?: (filtros: FiltersState) => void;
  /**
   * "Limpiar todo" con búsqueda Y filtros de servidor a la vez: si se usaran
   * `onServerSearch('')` y `onServerFilter({})` por separado, salen dos
   * recargas casi juntas y cada una lleva el valor VIEJO de lo que limpia la
   * otra (la búsqueda se limpia con los filtros de ayer, el filtro se limpia
   * con la búsqueda de ayer) — la que responda de última gana y dejaba la
   * tabla a medio limpiar. Con esta prop es un solo viaje, sin ambigüedad.
   */
  onServerClearAll?: () => void;
  /** Muestra una columna "#" con la posición en la lista (1, 2, 3…). */
  numerada?: boolean;
  /**
   * Pagina en el navegador cuando la pantalla carga todas las filas de una.
   * Se ignora si ya se pasó `pagination` (paginación de servidor).
   */
  paginadoLocal?: boolean;
  /** Debajo de 640px cambia la tabla por tarjetas, en vez de scroll horizontal. */
  tarjetaMovil?: boolean;
  /**
   * Acciones de la tarjeta. Si falta, usa `renderActions`.
   * Existe porque `renderActions` devuelve botones de solo icono, pensados para
   * una fila estrecha; en la tarjeta hay ancho de sobra y el icono solo es
   * ambiguo con el pulgar.
   */
  accionesMovil?: (row: T) => ReactNode;
  /**
   * Botones que actúan SOBRE la tabla (crear, importar, exportar). Van en su
   * barra, al lado opuesto del buscador: pertenecen a la tabla, no a la página.
   * Sueltos arriba junto al título se leen como acciones de toda la pantalla y
   * dejan una banda de botones sin caja que se ve improvisada.
   */
  acciones?: ReactNode;
}

const SERVER_SEARCH_DEBOUNCE_MS = 2000;

/**
 * La flechita de ordenar de un encabezado.
 *
 * Va FUERA del componente a propósito (regla del `CLAUDE.md`): declarado
 * dentro, en cada render sería una función nueva y React desmontaría y volvería
 * a montar su subárbol. Aquí no se notaba —es un icono sin estado—, pero es el
 * mismo descuido que en un campo de texto hace perder el foco a media palabra.
 */
const SortIcon = ({ dir }: { dir: 'asc' | 'desc' | null }) =>
  dir === 'asc' ? <ArrowUp className="size-3.5" /> : dir === 'desc' ? <ArrowDown className="size-3.5" /> : <ArrowUpDown className="size-3.5 opacity-40" />;


export function SmartTable<T>({
  columns,
  rows,
  rowKey,
  renderActions,
  emptyText = 'Sin resultados',
  pagination,
  onServerSearch,
  onServerFilter,
  onServerClearAll,
  numerada,
  paginadoLocal,
  tarjetaMovil,
  accionesMovil,
  acciones,
}: SmartTableProps<T>) {
  const isServerFilter = !!onServerFilter;
  const { processed, sort, toggleSort, filters, setFilter, clearAll, search, setSearch, activeFiltersCount } =
    useTableControls(rows, columns, { serverFiltrado: isServerFilter });
  const pantallaAngosta = useMediaQuery('(max-width: 520px)');
  // 639px = justo debajo del breakpoint `sm` de Tailwind
  const esMovil = useMediaQuery('(max-width: 639px)');
  const vistaTarjeta = esMovil && !!tarjetaMovil;

  // ── Paginación en el navegador ──
  // Dos modos excluyentes: la de servidor (prop `pagination`) manda sobre la local.
  const [pageLocal, setPageLocal] = useState(1);
  const [sizeLocal, setSizeLocal] = useState(PAGE_SIZE_LOCAL);
  const localActivo = !!paginadoLocal && !pagination;

  /**
   * Al cambiar búsqueda, filtros u orden la lista es otra: volver al principio.
   * Sin esto, filtrar de 200 a 3 registros deja al usuario mirando una página 7
   * vacía. Se hace en el evento que cambia la lista y no en un efecto que
   * reaccione después: eso encadenaría un render de más.
   */
  const volverAlPrincipio = () => setPageLocal(1);

  // ── Búsqueda en servidor (opcional) ──
  const isServerSearch = !!onServerSearch;
  const [serverTerm, setServerTerm] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const searchValue = isServerSearch ? serverTerm : search;

  const handleSearchChange = (value: string) => {
    volverAlPrincipio();
    if (!isServerSearch) { setSearch(value); return; }
    setServerTerm(value);
    clearTimeout(debounceRef.current);
    if (value.trim() === '') {
      // Al borrar, restaura la lista original de inmediato
      onServerSearch!('');
    } else {
      debounceRef.current = setTimeout(() => onServerSearch!(value.trim()), SERVER_SEARCH_DEBOUNCE_MS);
    }
  };

  const handleSearchClear = () => {
    volverAlPrincipio();
    if (isServerSearch) {
      clearTimeout(debounceRef.current);
      setServerTerm('');
      onServerSearch!('');
    } else {
      setSearch('');
    }
  };

  const handleClearAll = () => {
    volverAlPrincipio();
    clearAll();
    clearTimeout(debounceRef.current);
    if (isServerSearch) setServerTerm('');
    if (onServerClearAll) { onServerClearAll(); return; }
    // Sin `onServerClearAll`: solo hay UNA de las dos cosas que limpiar de
    // servidor (nunca las dos a la vez), así que no hay carrera posible.
    if (isServerSearch && serverTerm) onServerSearch!('');
    if (isServerFilter) onServerFilter!({});
  };

  /** Igual al `setFilter` del hook, pero además le avisa al servidor si aplica. */
  const applyFilter = (key: string, value: FilterValue | null) => {
    volverAlPrincipio();
    setFilter(key, value);
    if (!isServerFilter) return;
    const next = { ...filters };
    if (value === null) delete next[key];
    else next[key] = value;
    onServerFilter!(next);
  };

  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);

  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showTooltip = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollWidth <= el.clientWidth) return;
    const text = el.getAttribute('data-tip') || '';
    if (!text || text === '—') return;
    clearTimeout(tooltipTimer.current);
    tooltipTimer.current = setTimeout(() => {
      const rect = el.getBoundingClientRect();
      setTooltip({ text, x: rect.left, y: rect.bottom + 4 });
    }, 300);
  }, []);

  const hideTooltip = useCallback(() => {
    clearTimeout(tooltipTimer.current);
    setTooltip(null);
  }, []);

  const hasActiveControls = activeFiltersCount > 0 || searchValue.trim().length > 0 || sort !== null;

  const totalPaginasLocal = Math.max(1, Math.ceil(processed.length / sizeLocal));
  // Red de seguridad: si borran filas y la página guardada ya no existe,
  // el clamp evita quedarse mirando una lista vacía.
  const paginaLocal = Math.min(pageLocal, totalPaginasLocal);

  const visibles = localActivo
    ? processed.slice((paginaLocal - 1) * sizeLocal, paginaLocal * sizeLocal)
    : processed;

  /** Cuánto sumarle al índice de la fila para que el "#" siga de corrido entre páginas. */
  const offsetNumero = pagination
    ? (pagination.page - 1) * pagination.pageSize
    : localActivo
      ? (paginaLocal - 1) * sizeLocal
      : 0;

  // ── Datos del paginador, sirva de servidor o de navegador ──
  const paginadorVisible = !!pagination || localActivo;
  const paginaActual = pagination ? pagination.page : paginaLocal;
  const tamanoActual = pagination ? pagination.pageSize : sizeLocal;
  const totalPages = pagination
    ? Math.ceil(pagination.totalRows / pagination.pageSize)
    : totalPaginasLocal;

  const irAPagina = (p: number) => {
    if (pagination) pagination.onPageChange(p);
    else setPageLocal(p);
  };
  const cambiarTamano = (s: number) => {
    if (pagination) pagination.onPageSizeChange(s);
    else { setSizeLocal(s); setPageLocal(1); }
  };

  return (
    <div className="space-y-3">
      {/* ── Barra de la tabla: buscar y estado a la izquierda, acciones a la derecha ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
        <div className="relative w-full max-w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-8 pr-8"
            placeholder={isServerSearch ? 'Buscar en todos los registros...' : 'Buscar en todos los campos...'}
            value={searchValue}
            onChange={e => handleSearchChange(e.target.value)}
            aria-label="Búsqueda global"
            maxLength={100}
          />
          {searchValue && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              onClick={handleSearchClear}
              aria-label="Limpiar búsqueda"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="rounded-full">
              {activeFiltersCount} filtro{activeFiltersCount !== 1 ? 's' : ''} activo{activeFiltersCount !== 1 ? 's' : ''}
            </Badge>
          )}
          {hasActiveControls && (
            <Button type="button" variant="ghost" size="sm" onClick={handleClearAll}>
              Limpiar todo
            </Button>
          )}
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {processed.length !== rows.length
              ? `${processed.length} de ${rows.length}`
              : pagination
                ? `${pagination.totalRows} registros`
                : `${rows.length} registros`}
          </span>
        </div>

        {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
      </div>

      {/* ── Tarjetas (celular) o tabla (el resto) ── */}
      {vistaTarjeta ? (
        visibles.length === 0 ? (
          <p className="rounded-xl border border-border py-10 text-center text-muted-foreground">
            {emptyText}
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {visibles.map((row, i) => (
              <FilaTarjeta
                key={rowKey ? rowKey(row) : i}
                row={row}
                numero={numerada ? offsetNumero + i + 1 : null}
                columns={columns}
                acciones={(accionesMovil ?? renderActions)?.(row)}
              />
            ))}
          </ul>
        )
      ) : (
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table className="min-w-150">
          <TableHeader className="bg-secondary/60">
            <TableRow className="hover:bg-transparent">
              {numerada && (
                <TableHead className="h-10 w-12 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  #
                </TableHead>
              )}
              {columns.map(col => {
                const isFilterActive = !!filters[col.key];
                const sortDir = sort?.key === col.key ? sort.dir : null;
                const isSortable = col.sortable !== false;
                const isFilterable = col.filterable !== false;

                return (
                  <TableHead key={col.key} className={cn('h-10', col.className)}>
                    <div className="flex items-center gap-0.5">
                      {isSortable ? (
                        <button
                          type="button"
                          className={cn(
                            'flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors',
                            sortDir ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                          )}
                          onClick={() => { volverAlPrincipio(); toggleSort(col.key); }}
                          title={`Ordenar por ${col.header}`}
                        >
                          {col.header}
                          <SortIcon dir={sortDir} />
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          {col.header}
                        </span>
                      )}

                      {isFilterable && (
                        <div className="relative">
                          <button
                            type="button"
                            className={cn(
                              'ml-0.5 rounded p-1 transition-colors',
                              isFilterActive
                                ? 'text-primary'
                                : 'text-muted-foreground/50 hover:text-foreground',
                            )}
                            onClick={e => {
                              if (openFilter === col.key) {
                                setOpenFilter(null);
                                setFilterAnchor(null);
                              } else {
                                setOpenFilter(col.key);
                                setFilterAnchor(e.currentTarget);
                              }
                            }}
                            title={isFilterActive ? 'Filtro activo — clic para editar' : `Filtrar por ${col.header}`}
                            aria-pressed={isFilterActive}
                          >
                            <Filter className={cn('size-3.5', isFilterActive && 'fill-current')} />
                          </button>
                          {openFilter === col.key && (
                            <ColumnFilterPopover
                              column={col}
                              active={filters[col.key]}
                              onApply={(v: FilterValue | null) => applyFilter(col.key, v)}
                              onClose={() => { setOpenFilter(null); setFilterAnchor(null); }}
                              anchorEl={filterAnchor}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </TableHead>
                );
              })}
              {/* La columna de acciones lleva su encabezado como cualquier otra.
                  Sin él la tabla terminaba en una cabecera vacía y se leía como
                  si algo se hubiera cortado. Va aquí, en la pieza compartida, y
                  no en cada pestaña: es lo que hace que las 10 tablas del
                  dashboard se vean igual sin tocarlas una por una. */}
              {renderActions && (
                <TableHead className="w-0 whitespace-nowrap text-right">
                  {/* Mismas clases que el encabezado de una columna sin orden:
                      si no, "Acciones" se lee de otra familia que el resto. */}
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Acciones
                  </span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (numerada ? 1 : 0) + (renderActions ? 1 : 0)}
                  className="py-10 text-center text-muted-foreground"
                >
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : (
              visibles.map((row, i) => (
                <TableRow key={rowKey ? rowKey(row) : i} className="text-[13px]">
                  {numerada && (
                    <TableCell className="py-2.5 text-[12px] tabular-nums text-muted-foreground">
                      {offsetNumero + i + 1}
                    </TableCell>
                  )}
                  {columns.map(col => {
                    const raw = String(col.getValue(row) ?? '') || '—';
                    const content = col.render ? col.render(row) : raw;
                    return (
                      <TableCell key={col.key} className={cn('py-2.5', col.className)}>
                        {col.noTruncate ? content : (
                          <div
                            className="max-w-60 truncate"
                            data-tip={raw}
                            onMouseEnter={showTooltip}
                            onMouseLeave={hideTooltip}
                          >
                            {content}
                          </div>
                        )}
                      </TableCell>
                    );
                  })}
                  {renderActions && (
                    <TableCell className="whitespace-nowrap py-2 text-right">
                      <div className="flex items-center justify-end gap-1">{renderActions(row)}</div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      )}

      {/* ── Footer: tamaño de página + paginador ── */}
      {paginadorVisible && (
        <PaginadorTabla
          tamano={tamanoActual}
          onTamano={cambiarTamano}
          pagina={paginaActual}
          totalPaginas={totalPages}
          onPagina={irAPagina}
          compacto={pantallaAngosta}
        />
      )}

      {tooltip && (
        <div
          className="fixed z-100 max-w-95 rounded-lg border border-border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
