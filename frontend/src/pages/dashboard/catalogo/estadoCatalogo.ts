import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import type { Combo } from '../../../domain/entities/combo.schema';
import type { FiltersState } from '../../../components/table/tableTypes';
import { claves, clienteConsultas, pedir } from '../../../infrastructure/api/consultas';
import { urls } from '../../../infrastructure/api/urls';
import { DEFAULT_PAGE_SIZE, conNotaDeTalla } from '../helpers';
import type { Lookup } from '../types';
import type { LineaCatalogo } from '../tabs/perfumes/tipoDeProducto';

/**
 * EL CATÁLOGO DEL PANEL, CENTRALIZADO (TanStack Query, dueño 2026-10-08).
 *
 * Antes `DashboardPage` cargaba las 4 pestañas del catálogo al entrar —aunque
 * se fuera a Inicio— y tras CUALQUIER guardado volvía a pedir las 4 listas
 * fijas, los combos y las 4 pestañas: 9 consultas por un perfume. Ahora:
 * - las listas fijas (aromas, ocasiones, categorías, tallas) se piden UNA vez;
 * - cada pestaña pide solo su página, y solo cuando está abierta;
 * - editar un perfume pone en su sitio lo que devolvió el servidor (0 consultas);
 * - crear o borrar marca viejo el catálogo: se pide solo lo que está en pantalla.
 */

type Pagina<T> = { data: T[]; total: number };

const vacias = { aromas: [], ocasiones: [], categorias: [], presentaciones: [] } satisfies Record<string, Lookup[]>;

/** Las listas fijas, una sola vez para todo el panel. `activa` = quien puede ver el catálogo y lo necesita. */
export function useClasificaciones(activa = true) {
  const { data } = useQuery({
    queryKey: claves.clasificaciones,
    enabled: activa,
    staleTime: Infinity, // solo cambian cuando el dueño las edita, y ese guardado las marca viejas
    queryFn: async () => {
      const lista = (nombre: Parameters<typeof urls.clasificaciones>[0]) =>
        pedir<{ data: Lookup[] }>(urls.clasificaciones(nombre).lista).then((r) => r.data ?? []);
      const [aromas, ocasiones, categorias, presentaciones] = await Promise.all([
        lista('tipos-aroma'), lista('ocasiones'), lista('categorias'), lista('presentaciones'),
      ]);
      return { aromas, ocasiones, categorias, presentaciones: conNotaDeTalla(presentaciones) };
    },
  });
  return data ?? vacias;
}

/** Página, tamaño, búsqueda y filtros de una tabla paginada en el servidor. */
function usePaginado() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState('');
  const [filtros, setFiltros] = useState<FiltersState>({});
  const params = {
    page, limit: pageSize,
    ...(search ? { search } : {}),
    ...(Object.keys(filtros).length ? { filtros: JSON.stringify(filtros) } : {}),
  };
  const controles = {
    page, pageSize,
    onPageChange: setPage,
    onPageSizeChange: (s: number) => { setPageSize(s); setPage(1); },
    onSearch: (t: string) => { setSearch(t); setPage(1); },
    onFilter: (f: FiltersState) => { setFiltros(f); setPage(1); },
    // "Limpiar todo": búsqueda y filtros vacíos a la vez, una sola consulta
    onClearAll: () => { setSearch(''); setFiltros({}); setPage(1); },
  };
  return { params, controles };
}

/**
 * Una pestaña del catálogo. `todos=1`: el panel ve también lo que está fuera
 * de la tienda (el servidor solo lo acepta con `catalogo.ver`).
 */
export function useLineaCatalogo(linea: LineaCatalogo) {
  const { params, controles } = usePaginado();
  const consulta = useQuery({
    queryKey: [...claves.perfumes.linea(linea), params],
    queryFn: () => pedir<Pagina<Perfume>>(urls.perfumes.todos, { params: { ...params, todos: 1, linea } }),
    // Al cambiar de página se queda la anterior a la vista mientras llega la nueva
    placeholderData: keepPreviousData,
  });
  return {
    ...controles,
    items: consulta.data?.data ?? [],
    total: consulta.data?.total ?? 0,
    cargando: consulta.isPending,
    error: consulta.error?.message ?? '',
  };
}

export function useCombosLista() {
  const { params, controles } = usePaginado();
  const consulta = useQuery({
    queryKey: [...claves.combos, params],
    queryFn: () => pedir<Pagina<Combo>>(urls.combos.lista, { params }),
    placeholderData: keepPreviousData,
  });
  return {
    ...controles,
    combos: consulta.data?.data ?? [],
    total: consulta.data?.total ?? 0,
    cargando: consulta.isPending,
    error: consulta.error?.message ?? '',
  };
}

/* ── Después de guardar: cambiar solo lo que cambió ───────────────────────── */

/**
 * Pone el perfume que devolvió el servidor en cada página guardada donde
 * aparece. No pide nada: la respuesta del guardado YA es el dato nuevo.
 */
export const ponerPerfume = (p: Perfume) => {
  clienteConsultas.setQueriesData<Pagina<Perfume>>({ queryKey: claves.perfumes.todas }, (pagina) =>
    pagina && pagina.data.some((x) => x.id === p.id)
      ? { ...pagina, data: pagina.data.map((x) => (x.id === p.id ? p : x)) }
      : pagina);
};

/**
 * Marca viejo lo que cambió sin que el servidor devolviera el dato (crear,
 * borrar, importar, un precio de lista que mueve a muchos). Solo se vuelve a
 * pedir lo que está en pantalla; lo demás, al abrirlo.
 */
export const refrescar = {
  perfumes: () => clienteConsultas.invalidateQueries({ queryKey: claves.perfumes.todas }),
  combos: () => clienteConsultas.invalidateQueries({ queryKey: claves.combos }),
  /** Renombrar o borrar una categoría o una talla también cambia lo que muestran perfumes y combos. */
  clasificaciones: () => Promise.all([
    clienteConsultas.invalidateQueries({ queryKey: claves.clasificaciones }),
    clienteConsultas.invalidateQueries({ queryKey: claves.perfumes.todas }),
    clienteConsultas.invalidateQueries({ queryKey: claves.combos }),
  ]),
};
