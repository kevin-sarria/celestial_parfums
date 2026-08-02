import { type ReactNode, useState, useRef, useCallback } from 'react';
import { Search, X, Filter, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NativeSelect } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';
import type { ColumnDef, FilterValue } from './tableTypes';
import { useTableControls } from './useTableControls';
import { useMediaQuery } from './useMediaQuery';
import { ColumnFilterPopover } from './ColumnFilterPopover';

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100] as const;

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
}

const SERVER_SEARCH_DEBOUNCE_MS = 2000;

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

export function SmartTable<T>({
  columns,
  rows,
  rowKey,
  renderActions,
  emptyText = 'Sin resultados',
  pagination,
  onServerSearch,
}: SmartTableProps<T>) {
  const { processed, sort, toggleSort, filters, setFilter, clearAll, search, setSearch, activeFiltersCount } =
    useTableControls(rows, columns);
  const pantallaAngosta = useMediaQuery('(max-width: 520px)');

  // ── Búsqueda en servidor (opcional) ──
  const isServerSearch = !!onServerSearch;
  const [serverTerm, setServerTerm] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const searchValue = isServerSearch ? serverTerm : search;

  const handleSearchChange = (value: string) => {
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
    if (isServerSearch) {
      clearTimeout(debounceRef.current);
      setServerTerm('');
      onServerSearch!('');
    } else {
      setSearch('');
    }
  };

  const handleClearAll = () => {
    clearAll();
    if (isServerSearch && serverTerm) handleSearchClear();
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
  const totalPages = pagination ? Math.ceil(pagination.totalRows / pagination.pageSize) : 0;

  const SortIcon = ({ dir }: { dir: 'asc' | 'desc' | null }) =>
    dir === 'asc' ? <ArrowUp className="size-3.5" /> : dir === 'desc' ? <ArrowDown className="size-3.5" /> : <ArrowUpDown className="size-3.5 opacity-40" />;

  return (
    <div className="space-y-3">
      {/* ── Toolbar: búsqueda global + resumen de filtros ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <div className="flex items-center gap-2.5">
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
          <span className="text-xs text-muted-foreground">
            {processed.length !== rows.length
              ? `${processed.length} de ${rows.length}`
              : pagination
                ? `${pagination.totalRows} registros`
                : `${rows.length} registros`}
          </span>
        </div>
      </div>

      {/* ── Tabla ── */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table className="min-w-150">
          <TableHeader className="bg-secondary/60">
            <TableRow className="hover:bg-transparent">
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
                          onClick={() => toggleSort(col.key)}
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
                              onApply={(v: FilterValue | null) => setFilter(col.key, v)}
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
              {renderActions && <TableHead className="w-0" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {processed.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (renderActions ? 1 : 0)}
                  className="py-10 text-center text-muted-foreground"
                >
                  {emptyText}
                </TableCell>
              </TableRow>
            ) : (
              processed.map((row, i) => (
                <TableRow key={rowKey ? rowKey(row) : i} className="text-[13px]">
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

      {/* ── Footer: tamaño de página + paginador ── */}
      {pagination && totalPages >= 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <label htmlFor="st-ps">Filas:</label>
            <NativeSelect
              id="st-ps"
              className="w-18"
              value={pagination.pageSize}
              onChange={e => pagination.onPageSizeChange(Number(e.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </NativeSelect>
          </div>

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                disabled={pagination.page === 1}
                onClick={() => pagination.onPageChange(pagination.page - 1)}
                aria-label="Página anterior"
              >
                ‹
              </Button>
              {getPages(pagination.page, totalPages, pantallaAngosta).map((p, i) =>
                p === '...' ? (
                  <span key={`e${i}`} className="px-1 text-muted-foreground">…</span>
                ) : (
                  <Button
                    key={p}
                    variant={p === pagination.page ? 'default' : 'outline'}
                    size="icon"
                    className="size-8 text-xs"
                    onClick={() => pagination.onPageChange(p as number)}
                  >
                    {p}
                  </Button>
                )
              )}
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                disabled={pagination.page === totalPages}
                onClick={() => pagination.onPageChange(pagination.page + 1)}
                aria-label="Página siguiente"
              >
                ›
              </Button>
            </div>
          )}
        </div>
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
