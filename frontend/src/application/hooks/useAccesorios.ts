import { useEffect, useState } from 'react';
import type { Perfume } from '../../domain/entities/perfume.schema';
import { http } from '../../infrastructure/api/http';
import { urls } from '../../infrastructure/api/urls';

export const ACCESORIOS_PAGE_SIZE = 24;

/**
 * Los accesorios de la tienda (perfumero, bolsa, tarjeta), paginados en el
 * servidor. Más simple que `usePerfumes` a propósito: sin género, notas ni
 * ocasiones, que en una bolsa de organza no significan nada (diseño del
 * 2026-08-23, Ola 3).
 */
export function useAccesorios() {
  const [items, setItems] = useState<Perfume[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    const params: Record<string, string | number> = { page, limit: ACCESORIOS_PAGE_SIZE, seccion: 'accesorios', sort: 'nombre' };
    if (searchQuery) params.search = searchQuery;
    (async () => {
      try {
        const res = await http.get<{ data?: Perfume[]; total?: number }>(urls.perfumes.todos, { params, signal: ac.signal });
        if (ac.signal.aborted) return;
        setError(res.ok ? '' : res.error);
        setItems(res.cuerpo?.data ?? []);
        setTotal(res.cuerpo?.total ?? 0);
      } catch {
        if (!ac.signal.aborted) setError('No se pudo conectar con el servidor');
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [page, searchQuery]);

  return {
    items, total, loading, error, search, page, setPage,
    onSearchChange: (v: string) => { setSearch(v); setPage(1); },
  };
}

/**
 * ¿Hay algún accesorio publicado? El menú de la tienda solo enseña la entrada
 * "Accesorios" si la respuesta es sí: un enlace a una página vacía es peor que
 * no tenerlo. Con caché: se pregunta una vez, no en cada pantalla.
 */
export function useHayAccesorios() {
  const [hay, setHay] = useState(false);
  useEffect(() => {
    let vivo = true;
    http.getCacheado<{ total?: number }>(urls.perfumes.hayAccesorios)
      .then((res) => { if (vivo) setHay((res.cuerpo?.total ?? 0) > 0); })
      .catch(() => { /* sin respuesta, el menú sigue sin la entrada */ });
    return () => { vivo = false; };
  }, []);
  return hay;
}
