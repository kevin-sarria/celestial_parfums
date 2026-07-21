import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Genero, Perfume } from '../../domain/entities/perfume.schema';
import { BASE_URL } from '../../infrastructure/api/client';

export const PERFUMES_PAGE_SIZE = 24;

interface Lookup {
  id: number;
  nombre: string;
}

/**
 * Catálogo público con paginación y filtros server-side: solo viaja la página
 * visible (24 perfumes), así el catálogo escala a miles sin engordar la carga.
 * Las opciones de filtro salen de los endpoints de lookups, no de la lista.
 */
export function usePerfumes() {
  const [items, setItems] = useState<Perfume[]>([]);
  const [total, setTotal] = useState(0);
  const [categorias, setCategorias] = useState<Lookup[]>([]);
  const [allAromas, setAllAromas] = useState<string[]>([]);
  const [allOcasiones, setAllOcasiones] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  // La búsqueda va al servidor con un pequeño debounce para no disparar una
  // petición por tecla
  const [searchQuery, setSearchQuery] = useState('');
  // ?categoria=X preselecciona el filtro (lo usa "Elegir mis perfumes" de un combo)
  const [searchParams] = useSearchParams();
  const [activeAromas, setActiveAromas] = useState<Set<string>>(new Set());
  const [activeOcasiones, setActiveOcasiones] = useState<Set<string>>(new Set());
  const [activeGenero, setActiveGenero] = useState<Genero | ''>('');
  const [activeCategorias, setActiveCategorias] = useState<Set<string>>(() => {
    const c = searchParams.get('categoria');
    return c ? new Set([c]) : new Set();
  });
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Opciones de los filtros (una sola vez)
  useEffect(() => {
    const ac = new AbortController();
    Promise.all([
      fetch(`${BASE_URL}/api/parfums/categorias`, { signal: ac.signal }).then((r) => r.json()),
      fetch(`${BASE_URL}/api/parfums/tipos-aroma`, { signal: ac.signal }).then((r) => r.json()),
      fetch(`${BASE_URL}/api/parfums/ocasiones`, { signal: ac.signal }).then((r) => r.json()),
    ])
      .then(([cats, aromas, ocasiones]) => {
        setCategorias(cats.data ?? []);
        setAllAromas(((aromas.data ?? []) as Lookup[]).map((a) => a.nombre).sort());
        setAllOcasiones(((ocasiones.data ?? []) as Lookup[]).map((o) => o.nombre).sort());
      })
      .catch(() => {}); // sin lookups los filtros quedan vacíos, la lista sigue
    return () => ac.abort();
  }, []);

  // Página actual según filtros
  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(PERFUMES_PAGE_SIZE) });
    if (searchQuery) params.set('search', searchQuery);
    if (activeGenero) params.set('genero', activeGenero);
    if (activeCategorias.size) params.set('categorias', [...activeCategorias].join(','));
    if (activeAromas.size) params.set('aromas', [...activeAromas].join(','));
    if (activeOcasiones.size) params.set('ocasiones', [...activeOcasiones].join(','));
    fetch(`${BASE_URL}/api/parfums/?${params}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((json) => {
        setItems(json.data ?? []);
        setTotal(json.total ?? 0);
        setError('');
      })
      .catch((e) => { if (e.name !== 'AbortError') setError('No se pudo cargar los perfumes'); })
      .finally(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => ac.abort();
  }, [page, searchQuery, activeGenero, activeCategorias, activeAromas, activeOcasiones]);

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
    items,
    total,
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
