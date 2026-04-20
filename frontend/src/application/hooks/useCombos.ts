import { useEffect, useMemo, useState } from 'react';
import type { Combo } from '../../domain/entities/combo.schema';
import { BASE_URL } from '../../infrastructure/api/client';

export const COMBOS_PAGE_SIZE = 12;

export function useCombos() {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [activeComboCantidades, setActiveComboCantidades] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch(`${BASE_URL}/api/combos`)
      .then((r) => r.json())
      .then((json) => setCombos((json.data ?? []).filter((c: Combo) => c.activo)))
      .catch(() => setError('No se pudo cargar los combos'))
      .finally(() => setLoading(false));
  }, []);

  const comboCantidades = useMemo(
    () => [...new Set(combos.map((c) => c.cantidad))].sort((a, b) => a - b),
    [combos],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return combos.filter((c) =>
      (!search ||
        c.nombre.toLowerCase().includes(q) ||
        (c.descripcion ?? '').toLowerCase().includes(q)) &&
      (activeComboCantidades.size === 0 || activeComboCantidades.has(c.cantidad)),
    );
  }, [combos, search, activeComboCantidades]);

  const paginated = useMemo(
    () => filtered.slice((page - 1) * COMBOS_PAGE_SIZE, page * COMBOS_PAGE_SIZE),
    [filtered, page],
  );

  const hasActiveFilters = search.trim() !== '' || activeComboCantidades.size > 0;

  const onSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const toggleComboCantidad = (qty: number) => {
    const next = new Set(activeComboCantidades);
    if (next.has(qty)) next.delete(qty);
    else next.add(qty);
    setActiveComboCantidades(next);
    setPage(1);
  };

  const clearAll = () => {
    setSearch('');
    setActiveComboCantidades(new Set());
    setPage(1);
  };

  return {
    loading,
    error,
    comboCantidades,
    filtered,
    paginated,
    search,
    activeComboCantidades,
    page,
    hasActiveFilters,
    onSearchChange,
    toggleComboCantidad,
    clearAll,
    setPage,
  };
}
