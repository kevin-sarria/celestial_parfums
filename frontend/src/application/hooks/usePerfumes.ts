import { useEffect, useMemo, useState } from 'react';
import type { Genero, Perfume } from '../../domain/entities/perfume.schema';
import { BASE_URL } from '../../infrastructure/api/client';

export const PERFUMES_PAGE_SIZE = 24;

interface Lookup {
  id: number;
  nombre: string;
}

export function usePerfumes() {
  const [perfumes, setPerfumes] = useState<Perfume[]>([]);
  const [categorias, setCategorias] = useState<Lookup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [activeAromas, setActiveAromas] = useState<Set<string>>(new Set());
  const [activeOcasiones, setActiveOcasiones] = useState<Set<string>>(new Set());
  const [activeGenero, setActiveGenero] = useState<Genero | ''>('');
  const [activeCategorias, setActiveCategorias] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const ac = new AbortController();
    Promise.all([
      fetch(`${BASE_URL}/api/parfums/`, { signal: ac.signal }).then((r) => r.json()),
      fetch(`${BASE_URL}/api/parfums/categorias`, { signal: ac.signal }).then((r) => r.json()),
    ])
      .then(([pJson, cJson]) => {
        setPerfumes(pJson.data.data ?? []);
        setCategorias(cJson.data ?? []);
      })
      .catch((e) => { if (e.name !== 'AbortError') setError('No se pudo cargar los perfumes'); })
      .finally(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => ac.abort();
  }, []);

  const allAromas = useMemo(
    () => [...new Set(perfumes.flatMap((p) => p.tipos_aroma))].sort(),
    [perfumes],
  );

  const allOcasiones = useMemo(
    () => [...new Set(perfumes.flatMap((p) => p.ocasiones))].sort(),
    [perfumes],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return perfumes.filter((p) =>
      (!search ||
        p.nombre.toLowerCase().includes(q) ||
        (p.descripcion ?? '').toLowerCase().includes(q)) &&
      (activeAromas.size === 0 || p.tipos_aroma.some((a) => activeAromas.has(a))) &&
      (activeOcasiones.size === 0 || p.ocasiones.some((o) => activeOcasiones.has(o))) &&
      (!activeGenero || p.genero === activeGenero) &&
      (activeCategorias.size === 0 ||
        (p.categoria != null && activeCategorias.has(p.categoria))),
    );
  }, [perfumes, search, activeAromas, activeOcasiones, activeGenero, activeCategorias]);

  const paginated = useMemo(
    () => filtered.slice((page - 1) * PERFUMES_PAGE_SIZE, page * PERFUMES_PAGE_SIZE),
    [filtered, page],
  );

  const hasActiveFilters =
    search.trim() !== '' ||
    activeAromas.size > 0 ||
    activeOcasiones.size > 0 ||
    !!activeGenero ||
    activeCategorias.size > 0;

  const onSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const onGeneroToggle = (g: Genero) => {
    setActiveGenero((prev) => (prev === g ? '' : g));
    setPage(1);
  };

  const toggleStringSet = (
    value: string,
    set: Set<string>,
    setter: (s: Set<string>) => void,
  ) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
    setPage(1);
  };

  const clearAll = () => {
    setActiveAromas(new Set());
    setActiveOcasiones(new Set());
    setActiveGenero('');
    setActiveCategorias(new Set());
    setPage(1);
  };

  return {
    loading,
    error,
    categorias,
    allAromas,
    allOcasiones,
    filtered,
    paginated,
    search,
    activeAromas,
    activeOcasiones,
    activeGenero,
    activeCategorias,
    showFilters,
    page,
    hasActiveFilters,
    onSearchChange,
    onGeneroToggle,
    toggleStringSet,
    clearAll,
    setShowFilters,
    setPage,
    setActiveAromas,
    setActiveOcasiones,
    setActiveCategorias,
  };
}
