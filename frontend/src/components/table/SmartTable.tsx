import { type ReactNode, useState, useRef, useCallback } from 'react';
import type { ColumnDef, FilterValue } from './tableTypes';
import { useTableControls } from './useTableControls';
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
}

function getPages(page: number, totalPages: number): (number | '...')[] {
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
}: SmartTableProps<T>) {
  const { processed, sort, toggleSort, filters, setFilter, clearAll, search, setSearch, activeFiltersCount } =
    useTableControls(rows, columns);

  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);

  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout>>();

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

  const hasActiveControls = activeFiltersCount > 0 || search.trim().length > 0 || sort !== null;
  const totalPages = pagination ? Math.ceil(pagination.totalRows / pagination.pageSize) : 0;

  return (
    <div className="st-root">
      {/* Toolbar: search + filter summary */}
      <div className="st-toolbar">
        <div className="st-search-wrap">
          <span className="st-search-icon">⊘</span>
          <input
            className="st-search"
            placeholder="Buscar en todos los campos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Búsqueda global"
            maxLength={200}
          />
          {search && (
            <button type="button" className="st-search-clear" onClick={() => setSearch('')} aria-label="Limpiar búsqueda">
              ✕
            </button>
          )}
        </div>
        <div className="st-toolbar-right">
          {activeFiltersCount > 0 && (
            <span className="st-filter-badge">
              {activeFiltersCount} filtro{activeFiltersCount !== 1 ? 's' : ''} activo{activeFiltersCount !== 1 ? 's' : ''}
            </span>
          )}
          {hasActiveControls && (
            <button type="button" className="st-clear-btn" onClick={clearAll}>
              Limpiar todo
            </button>
          )}
          <span className="st-count">
            {processed.length !== rows.length
              ? `${processed.length} de ${rows.length}`
              : pagination
                ? `${pagination.totalRows} registros`
                : `${rows.length} registros`}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              {columns.map(col => {
                const isFilterActive = !!filters[col.key];
                const sortDir = sort?.key === col.key ? sort.dir : null;
                const isSortable = col.sortable !== false;
                const isFilterable = col.filterable !== false;

                return (
                  <th key={col.key} className={col.className}>
                    <div className="st-th-inner">
                      {isSortable ? (
                        <button
                          type="button"
                          className={`st-sort-btn${sortDir ? ' st-sort-btn--active' : ''}`}
                          onClick={() => toggleSort(col.key)}
                          title={`Ordenar por ${col.header}`}
                        >
                          {col.header}
                          <span className="st-sort-icon" aria-hidden="true">
                            {sortDir === 'asc' ? '↑' : sortDir === 'desc' ? '↓' : '↕'}
                          </span>
                        </button>
                      ) : (
                        <span className="st-th-label">{col.header}</span>
                      )}

                      {isFilterable && (
                        <div className="st-filter-wrap">
                          <button
                            type="button"
                            className={`st-filter-btn${isFilterActive ? ' st-filter-btn--active' : ''}`}
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
                            {isFilterActive ? '⬛' : '⬜'}
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
                  </th>
                );
              })}
              {renderActions && <th className="dash-td-actions" />}
            </tr>
          </thead>
          <tbody>
            {processed.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (renderActions ? 1 : 0)}
                  style={{ textAlign: 'center', padding: '32px 12px', color: 'var(--text)' }}
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              processed.map((row, i) => (
                <tr key={rowKey ? rowKey(row) : i}>
                  {columns.map(col => {
                    const raw = String(col.getValue(row) ?? '') || '—';
                    const content = col.render ? col.render(row) : raw;
                    return (
                      <td key={col.key} className={col.className}>
                        {col.noTruncate ? content : (
                          <div className="dash-cell" data-tip={raw} onMouseEnter={showTooltip} onMouseLeave={hideTooltip}>
                            {content}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  {renderActions && (
                    <td className="dash-td-actions">{renderActions(row)}</td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer: page size selector + paginator */}
      {pagination && totalPages >= 1 && (
        <div className="st-footer">
          <div className="st-page-size">
            <label htmlFor="st-ps">Filas:</label>
            <select
              id="st-ps"
              className="st-page-size-select"
              value={pagination.pageSize}
              onChange={e => pagination.onPageSizeChange(Number(e.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {totalPages > 1 && (
            <div className="st-paginator">
              <button
                className="st-pg-btn"
                disabled={pagination.page === 1}
                onClick={() => pagination.onPageChange(pagination.page - 1)}
                aria-label="Página anterior"
              >
                ‹
              </button>
              {getPages(pagination.page, totalPages).map((p, i) =>
                p === '...' ? (
                  <span key={`e${i}`} className="st-pg-ellipsis">…</span>
                ) : (
                  <button
                    key={p}
                    className={`st-pg-btn${p === pagination.page ? ' st-pg-btn--active' : ''}`}
                    onClick={() => pagination.onPageChange(p as number)}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                className="st-pg-btn"
                disabled={pagination.page === totalPages}
                onClick={() => pagination.onPageChange(pagination.page + 1)}
                aria-label="Página siguiente"
              >
                ›
              </button>
            </div>
          )}
        </div>
      )}

      {tooltip && (
        <div className="dash-cell-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.text}
        </div>
      )}
    </div>
  );
}