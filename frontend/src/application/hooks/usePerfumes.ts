import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Genero, Perfume } from '../../domain/entities/perfume.schema';
import { http } from '../../infrastructure/api/http';
import { urls } from '../../infrastructure/api/urls';

export const PERFUMES_PAGE_SIZE = 24;

/** Las claves de la dirección que maneja el catálogo (`categoria` es la vieja, la del combo). */
const CLAVES_CATALOGO = ['q', 'genero', 'categoria', 'categorias', 'aromas', 'ocasiones', 'sort', 'page'];

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

  // La URL es la fuente de la vista inicial y adónde se escribe cada cambio:
  // un enlace compartido reproduce la búsqueda, los filtros, el orden y la página.
  const [searchParams, setSearchParams] = useSearchParams();
  const listaDeUrl = (clave: string) => (searchParams.get(clave) ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  // La búsqueda va al servidor con un pequeño debounce para no disparar una
  // petición por tecla
  const [searchQuery, setSearchQuery] = useState(() => (searchParams.get('q') ?? '').trim());
  const [activeAromas, setActiveAromas] = useState<Set<string>>(() => new Set(listaDeUrl('aromas')));
  const [activeOcasiones, setActiveOcasiones] = useState<Set<string>>(() => new Set(listaDeUrl('ocasiones')));
  const [activeGenero, setActiveGenero] = useState<Genero | ''>(() => {
    const g = searchParams.get('genero');
    return g === 'dama' || g === 'caballero' || g === 'unisex' ? g : '';
  });
  const [activeCategorias, setActiveCategorias] = useState<Set<string>>(() => {
    const c = searchParams.get('categoria') ?? searchParams.get('categorias') ?? '';
    return new Set(c.split(',').map((s) => s.trim()).filter(Boolean));
  });
  const [showFilters, setShowFilters] = useState(false);
  const [orden, setOrden] = useState(() => searchParams.get('sort') ?? 'destacados');
  const [page, setPage] = useState(() => {
    const p = Number(searchParams.get('page'));
    return Number.isInteger(p) && p > 0 ? p : 1;
  });

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Refleja la vista en la URL para poder compartirla y marcarla. `replace` no
  // ensucia el historial del navegador. Solo se escribe si algo cambió de verdad.
  useEffect(() => {
    // Se parte de la dirección actual y solo se tocan las claves del catálogo:
    // lo demás que traiga (las marcas de TikTok, un código de invitado) se queda.
    const next = new URLSearchParams(searchParams);
    for (const clave of CLAVES_CATALOGO) next.delete(clave);
    if (searchQuery) next.set('q', searchQuery);
    if (activeGenero) next.set('genero', activeGenero);
    if (activeCategorias.size) next.set('categorias', [...activeCategorias].join(','));
    if (activeAromas.size) next.set('aromas', [...activeAromas].join(','));
    if (activeOcasiones.size) next.set('ocasiones', [...activeOcasiones].join(','));
    if (orden && orden !== 'destacados') next.set('sort', orden);
    if (page > 1) next.set('page', String(page));
    if (next.toString() === searchParams.toString()) return;
    setSearchParams(next, { replace: true });
  }, [searchQuery, activeGenero, activeCategorias, activeAromas, activeOcasiones, orden, page, searchParams, setSearchParams]);

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
