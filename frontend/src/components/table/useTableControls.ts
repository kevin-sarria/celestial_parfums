import { useState, useMemo } from 'react';
import type { ColumnDef, SortState, FiltersState, FilterValue } from './tableTypes';

function sanitizeStr(v: unknown): string {
  return String(v ?? '').replace(/[<>]/g, '').trim();
}

function matchesFilter(raw: string | number | null | undefined, filter: FilterValue): boolean {
  switch (filter.type) {
    case 'string': {
      const str = sanitizeStr(raw).toLowerCase();
      const q = sanitizeStr(filter.value).toLowerCase();
      if (!q) return true;
      if (filter.op === 'contains') return str.includes(q);
      if (filter.op === 'equals') return str === q;
      if (filter.op === 'starts') return str.startsWith(q);
      return true;
    }
    case 'number':
    case 'currency': {
      const n = Number(raw ?? 0);
      const v = Number(filter.value);
      if (!filter.value || isNaN(v)) return true;
      if (filter.op === 'eq') return n === v;
      if (filter.op === 'gt') return n > v;
      if (filter.op === 'lt') return n < v;
      return true;
    }
    case 'date': {
      const d = String(raw ?? '').slice(0, 10);
      const v = filter.value;
      if (!v) return true;
      if (filter.op === 'eq') return d === v;
      if (filter.op === 'before') return d < v;
      if (filter.op === 'after') return d > v;
      return true;
    }
    case 'enum': {
      if (!filter.values.length) return true;
      return filter.values.includes(String(raw ?? ''));
    }
  }
}

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'es');
}

export function useTableControls<T>(rows: T[], columns: ColumnDef<T>[]) {
  const [sort, setSort] = useState<SortState | null>(null);
  const [filters, setFilters] = useState<FiltersState>({});
  const [search, setSearch] = useState('');

  const toggleSort = (key: string) => {
    setSort(prev => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  };

  const setFilter = (key: string, value: FilterValue | null) => {
    setFilters(prev => {
      const next = { ...prev };
      if (value === null) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  const clearAll = () => {
    setFilters({});
    setSearch('');
    setSort(null);
  };

  const processed = useMemo(() => {
    let result = [...rows];

    // Global search across all getValue results
    const q = sanitizeStr(search).toLowerCase();
    if (q) {
      result = result.filter(row =>
        columns.some(col => sanitizeStr(col.getValue(row)).toLowerCase().includes(q))
      );
    }

    // Per-column filters
    for (const [key, filter] of Object.entries(filters)) {
      const col = columns.find(c => c.key === key);
      if (!col) continue;
      result = result.filter(row => matchesFilter(col.getValue(row), filter));
    }

    // Sort
    if (sort) {
      const col = columns.find(c => c.key === sort.key);
      if (col) {
        result = [...result].sort((a, b) => {
          const cmp = compare(col.getValue(a), col.getValue(b));
          return sort.dir === 'asc' ? cmp : -cmp;
        });
      }
    }

    return result;
  }, [rows, sort, filters, search, columns]);

  const activeFiltersCount = Object.keys(filters).length;

  return {
    processed,
    sort,
    toggleSort,
    filters,
    setFilter,
    clearAll,
    search,
    setSearch,
    activeFiltersCount,
  };
}
