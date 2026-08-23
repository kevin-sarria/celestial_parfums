import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Genero, Perfume } from '../../domain/entities/perfume.schema';
import { http } from '../../infrastructure/api/http';
import { urls } from '../../infrastructure/api/urls';

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

  // ?q=... preselecciona la búsqueda (la manda el buscador del landing);
  // ?categoria=X preselecciona el filtro (lo usa "Elegir mis perfumes" de un combo)
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  // La búsqueda va al servidor con un pequeño debounce para no disparar una
  // petición por tecla
  const [searchQuery, setSearchQuery] = useState(() => (searchParams.get('q') ?? '').trim());
  const [activeAromas, setActiveAromas] = useState<Set<string>>(new Set());
  const [activeOcasiones, setActiveOcasiones] = useState<Set<string>>(new Set());
  const [activeGenero, setActiveGenero] = useState<Genero | ''>('');
  const [activeCategorias, setActiveCategorias] = useState<Set<string>>(() => {
    const c = searchParams.get('categoria');
    return c ? new Set([c]) : new Set();
  });
  const [showFilters, setShowFilters] = useState(false);
  const [orden, setOrden] = useState('destacados');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Opciones de los filtros (con caché en memoria: al navegar no se repiten)
  useEffect(() => {
    let vivo = true;
    (async () => {
      const [cats, aromas, ocasiones] = await Promise.all([
        http.getCacheado<{ data?: Lookup[] }>(urls.clasificaciones('categorias').lista),
        http.getCacheado<{ data?: Lookup[] }>(urls.clasificaciones('tipos-aroma').lista),
        http.getCacheado<{ data?: Lookup[] }>(urls.clasificaciones('ocasiones').lista),
      ]);
      if (!vivo) return;
      // Sin lookups los filtros quedan vacíos pero la lista sigue funcionando,
      // así que no lleva aviso: el error que importa es el de la lista.
      setCategorias(cats.cuerpo?.data ?? []);
      setAllAromas((aromas.cuerpo?.data ?? []).map((a) => a.nombre).sort());
      setAllOcasiones((ocasiones.cuerpo?.data ?? []).map((o) => o.nombre).sort());
    })();
    return () => { vivo = false; };
  }, []);

  // Página actual según filtros
  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    // Los filtros van como `params`, no pegados a la cadena: así nadie tiene que
    // acordarse de `encodeURIComponent` y un nombre con "&" deja de romperlos.
    const params: Record<string, string | number> = { page, limit: PERFUMES_PAGE_SIZE };
    if (searchQuery) params.search = searchQuery;
    if (activeGenero) params.genero = activeGenero;
    if (activeCategorias.size) params.categorias = [...activeCategorias].join(',');
    if (activeAromas.size) params.aromas = [...activeAromas].join(',');
    if (activeOcasiones.size) params.ocasiones = [...activeOcasiones].join(',');
    if (orden) params.sort = orden;

    (async () => {
      const res = await http.get<{ data?: Perfume[]; total?: number }>(
        urls.perfumes.todos, { params, signal: ac.signal },
      );
      // Cancelada porque el visitante cambió de filtro: la petición nueva manda.
      if (ac.signal.aborted) return;
      setError(res.ok ? '' : res.error);
      setItems(res.cuerpo?.data ?? []);
      setTotal(res.cuerpo?.total ?? 0);
      setLoading(false);
    })();
    return () => ac.abort();
  }, [page, searchQuery, activeGenero, activeCategorias, activeAromas, activeOcasiones, orden]);

  const onOrdenChange = (value: string) => { setOrden(value); setPage(1); };

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
    orden,
    page,
    hasActiveFilters,
    onOrdenChange,
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
