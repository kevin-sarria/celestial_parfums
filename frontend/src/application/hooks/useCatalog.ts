import { useEffect, useMemo, useState } from 'react';
import type { Genero, Perfume } from '../../domain/entities/perfume.schema';
import type { Combo } from '../../domain/entities/combo.schema';
import { BASE_URL } from '../../infrastructure/api/client';

const HOME_PREVIEW_SIZE = 12;

interface Lookup {
  id: number;
  nombre: string;
}

export function useCatalog() {
  const [perfumes, setPerfumes] = useState<Perfume[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [categorias, setCategorias] = useState<Lookup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [activeAromas, setActiveAromas] = useState<Set<string>>(new Set());
  const [activeOcasiones, setActiveOcasiones] = useState<Set<string>>(new Set());
  const [activeGenero, setActiveGenero] = useState<Genero | ''>('');
  const [activeCategorias, setActiveCategorias] = useState<Set<string>>(new Set());
  const [activeComboCantidades, setActiveComboCantidades] = useState<Set<number>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    Promise.all([
      fetch(`${BASE_URL}/api/parfums/`, { signal: ac.signal }).then((r) => r.json()),
      fetch(`${BASE_URL}/api/parfums/categorias`, { signal: ac.signal }).then((r) => r.json()),
      fetch(`${BASE_URL}/api/combos`, { signal: ac.signal }).then((r) => r.json()),
    ])
      .then(([pJson, cJson, combosJson]) => {
        setPerfumes(pJson.data.data ?? []);
        setCategorias(cJson.data ?? []);
        setCombos((combosJson.data ?? []).filter((c: Combo) => c.activo));
      })
      .catch((e) => { if (e.name !== 'AbortError') setError('No se pudo cargar el catálogo'); })
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

  const comboCantidades = useMemo(
    () => [...new Set(combos.map((c) => c.cantidad))].sort((a, b) => a - b),
    [combos],
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

  const filteredCombos = useMemo(() => {
    const q = search.toLowerCase();
    return combos.filter((c) =>
      (!search ||
        c.nombre.toLowerCase().includes(q) ||
        (c.descripcion ?? '').toLowerCase().includes(q)) &&
      (activeComboCantidades.size === 0 || activeComboCantidades.has(c.cantidad)),
    );
  }, [combos, search, activeComboCantidades]);

  const previewPerfumes = useMemo(() => filtered.slice(0, HOME_PREVIEW_SIZE), [filtered]);
  const previewCombos = useMemo(() => filteredCombos.slice(0, HOME_PREVIEW_SIZE), [filteredCombos]);
  const hasMorePerfumes = filtered.length > HOME_PREVIEW_SIZE;
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
    filtered,
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
