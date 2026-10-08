import { QueryClient } from '@tanstack/react-query';
import { alEscribir, http, type OpcionesPeticion } from './http';

/**
 * EL ESTADO DEL SERVIDOR, EN UN SOLO SITIO (TanStack Query, dueño 2026-10-08).
 *
 * Antes cada pantalla pedía sus datos por su cuenta y, tras guardar, volvía a
 * pedir TODO por si acaso: medido ese día, guardar un perfume disparaba 9
 * consultas (las 4 listas fijas, los combos y las 4 pestañas del catálogo,
 * aunque solo se viera una). Ahora cada dato vive una vez bajo su clave
 * (`claves`), lo comparten las pantallas que lo usan, y un guardado cambia
 * SOLO lo que cambió:
 *
 * - si el servidor devuelve el dato nuevo → `setQueriesData` lo pone en su
 *   sitio, sin pedir nada;
 * - si no (crear, borrar) → `invalidateQueries` de esa clave: se vuelve a pedir
 *   solo lo que esté en pantalla; lo demás queda marcado y se pide al abrirlo.
 */
export const clienteConsultas = new QueryClient({
  defaultOptions: {
    queries: {
      // Un dato del panel no caduca solo: lo marca viejo el guardado que lo cambia
      staleTime: 5 * 60 * 1000,
      // Volver a la pestaña del navegador no es motivo para pedir todo otra vez
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/**
 * Cualquier guardado marca TODO como viejo, pero SIN pedir nada
 * (`refetchType: 'none'`): cada dato se vuelve a pedir solo cuando una pantalla
 * lo necesite. Así un insumo creado en Inventario aparece en la ficha del
 * perfume sin que cada pantalla tenga que saber qué toca cada guardado, y sin
 * las 9 consultas de antes. Quien SÍ sabe qué cambió (editar un perfume) pone
 * el dato nuevo después con `setQueriesData`, que lo deja fresco otra vez.
 */
alEscribir(() => {
  void clienteConsultas.invalidateQueries({
    refetchType: 'none',
    // Las listas fijas solo las cambia su propia pantalla, que avisa explícito (`refrescar.clasificaciones`)
    predicate: (q) => q.queryKey[0] !== claves.clasificaciones[0],
  });
});

/**
 * Las claves de cada dato. Una clave más corta abarca a las más largas:
 * invalidar `claves.perfumes.todas` alcanza a todas las páginas de todas las
 * líneas, `claves.perfumes.linea('contratipo')` solo a esa pestaña.
 */
export const claves = {
  clasificaciones: ['clasificaciones'] as const,
  perfumes: {
    todas: ['perfumes'] as const,
    linea: (linea: string) => ['perfumes', 'linea', linea] as const,
  },
  combos: ['combos'] as const,
  /** Materiales (esencias, botellas, envases): los usa la ficha del perfume. */
  insumos: ['insumos'] as const,
  /** Lista de precios categoría × talla. */
  listaPrecios: ['lista-precios'] as const,
};

/**
 * `http.get` para una consulta: `http` no lanza (devuelve `{ ok, error }`),
 * pero TanStack Query necesita que el fallo LANCE para marcar la consulta en
 * error y dejar la pantalla mostrarlo.
 */
export const pedir = async <T>(url: string, config?: OpcionesPeticion): Promise<T> => {
  const res = await http.get<T>(url, config);
  if (!res.ok || res.cuerpo == null) throw new Error(res.error || 'No se pudo cargar');
  return res.cuerpo;
};
