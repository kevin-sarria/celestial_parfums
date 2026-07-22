import { useEffect, useMemo, useState } from 'react';
import type { Genero, Perfume } from '../../domain/entities/perfume.schema';
import type { Combo } from '../../domain/entities/combo.schema';
import { BASE_URL } from '../../infrastructure/api/client';
import { fetchJsonCached } from '../../infrastructure/api/cachedFetch';

const HOME_PREVIEW_SIZE = 12;

interface Lookup {
  id: number;
  nombre: string;
}

/**
 * Catálogo del home: los perfumes viajan paginados desde el servidor (solo la
 * vista previa de 12), con búsqueda y filtros server-side. Los combos son pocos
 * y se filtran en el cliente.
 */
export function useCatalog() {
  const [previewPerfumes, setPreviewPerfumes] = useState<Perfume[]>([]);
  const [totalPerfumes, setTotalPerfumes] = useState(0);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [categorias, setCategorias] = useState<Lookup[]>([]);
  const [allAromas, setAllAromas] = useState<string[]>([]);
  const [allOcasiones, setAllOcasiones] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeAromas, setActiveAromas] = useState<Set<string>>(new Set());
  const [activeOcasiones, setActiveOcasiones] = useState<Set<string>>(new Set());
  const [activeGenero, setActiveGenero] = useState<Genero | ''>('');
  const [activeCategorias, setActiveCategorias] = useState<Set<string>>(new Set());
  const [activeComboCantidades, setActiveComboCantidades] = useState<Set<number>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Combos + opciones de filtros (con caché en memoria: al navegar no se repiten)
  useEffect(() => {
    let vivo = true;
    Promise.all([
      fetchJsonCached<{ data?: Lookup[] }>(`${BASE_URL}/api/parfums/categorias`),
      fetchJsonCached<{ data?: Lookup[] }>(`${BASE_URL}/api/parfums/tipos-aroma`),
      fetchJsonCached<{ data?: Lookup[] }>(`${BASE_URL}/api/parfums/ocasiones`),
      fetchJsonCached<{ data?: Combo[] }>(`${BASE_URL}/api/combos`),
    ])
      .then(([cats, aromas, ocasiones, combosJson]) => {
        if (!vivo) return;
        setCategorias(cats.data ?? []);
        setAllAromas((aromas.data ?? []).map((a) => a.nombre).sort());
        setAllOcasiones((ocasiones.data ?? []).map((o) => o.nombre).sort());
        setCombos((combosJson.data ?? []).filter((c: Combo) => c.activo));
      })
      .catch(() => { if (vivo) setError('No se pudo cargar el catálogo'); });
    return () => { vivo = false; };
  }, []);

  // Vista previa de perfumes según filtros
  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ page: '1', limit: String(HOME_PREVIEW_SIZE) });
    if (searchQuery) params.set('search', searchQuery);
    if (activeGenero) params.set('genero', activeGenero);
    if (activeCategorias.size) params.set('categorias', [...activeCategorias].join(','));
    if (activeAromas.size) params.set('aromas', [...activeAromas].join(','));
    if (activeOcasiones.size) params.set('ocasiones', [...activeOcasiones].join(','));
    fetch(`${BASE_URL}/api/parfums/?${params}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((json) => {
        setPreviewPerfumes(json.data ?? []);
        setTotalPerfumes(json.total ?? 0);
      })
      .catch((e) => { if (e.name !== 'AbortError') setError('No se pudo cargar el catálogo'); })
      .finally(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => ac.abort();
  }, [searchQuery, activeGenero, activeCategorias, activeAromas, activeOcasiones]);

  const comboCantidades = useMemo(
    () => [...new Set(combos.map((c) => c.cantidad))].sort((a, b) => a - b),
    [combos],
  );

  const filteredCombos = useMemo(() => {
    const q = search.toLowerCase();
    return combos.filter((c) =>
      (!search ||
        c.nombre.toLowerCase().includes(q) ||
        (c.descripcion ?? '').toLowerCase().includes(q)) &&
      (activeComboCantidades.size === 0 || activeComboCantidades.has(c.cantidad)),
    );
  }, [combos, search, activeComboCantidades]);

  const previewCombos = useMemo(() => filteredCombos.slice(0, HOME_PREVIEW_SIZE), [filteredCombos]);
  const hasMorePerfumes = totalPerfumes > HOME_PREVIEW_SIZE;
  const hasMoreCombos = filteredCombos.length > HOME_PREVIEW_SIZE;

  const hasActiveFilters =
    activeAromas.size > 0 ||
    activeOcasiones.size > 0 ||
    !!activeGenero ||
    activeCategorias.size > 0 ||
    activeComboCantidades.size > 0;

  const hasPerfumeFilter =
    search.trim() !== '' ||
    activeAromas.size > 0 ||
    activeOcasiones.size > 0 ||
    !!activeGenero ||
    activeCategorias.size > 0;

  const showPerfumes = activeComboCantidades.size === 0 || hasPerfumeFilter;

  const onSearchChange = (value: string) => setSearch(value);

  const onGeneroToggle = (g: Genero) =>
    setActiveGenero((prev) => (prev === g ? '' : g));

  const toggleStringSet = (
    value: string,
    set: Set<string>,
    setter: (s: Set<string>) => void,
  ) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  const toggleComboCantidad = (qty: number) => {
    const next = new Set(activeComboCantidades);
    if (next.has(qty)) next.delete(qty);
    else next.add(qty);
    setActiveComboCantidades(next);
  };

  const clearAll = () => {
    setActiveAromas(new Set());
    setActiveOcasiones(new Set());
    setActiveGenero('');
    setActiveCategorias(new Set());
    setActiveComboCantidades(new Set());
  };

  return {
    loading,
    error,
    categorias,
    allAromas,
    allOcasiones,
    comboCantidades,
    totalPerfumes,
    filteredCombos,
    previewPerfumes,
    previewCombos,
    hasMorePerfumes,
    hasMoreCombos,
    search,
    activeAromas,
    activeOcasiones,
    activeGenero,
    activeCategorias,
    activeComboCantidades,
    showFilters,
    hasActiveFilters,
    showPerfumes,
    onSearchChange,
    onGeneroToggle,
    toggleStringSet,
    toggleComboCantidad,
    clearAll,
    setShowFilters,
    setActiveAromas,
    setActiveOcasiones,
    setActiveCategorias,
  };
}
