/**
 * TODAS LAS RUTAS DE LA API, EN UN SOLO SITIO.
 *
 * Ninguna pantalla vuelve a escribir una URL. Si el backend renombra un
 * endpoint, se cambia aquí y ya está — antes había **129 rutas escritas a mano
 * repartidas por el frontend** y renombrar una obligaba a salir a buscarla.
 *
 * Reglas de esta casa:
 *
 * - **Solo el camino, sin la raíz.** `http` ya lleva la URL base en su
 *   instancia (`VITE_API_URL` + `/api`). Repetir la variable de entorno en
 *   cada ruta sería volver a tener el problema en otro sitio.
 * - **Lo que lleva parámetro es una FUNCIÓN.** Una plantilla dentro de un
 *   objeto se evalúa al cargar el archivo, cuando el id todavía no existe.
 * - **Agrupadas por dominio**, con el nombre que usa el negocio.
 *
 * Se van llenando dominio por dominio a medida que se migran las pantallas
 * (2026-08-14): lo que no está aquí todavía es que esa pantalla sigue con el
 * `guardedFetch` viejo. Un dominio se migra ENTERO o no se migra.
 */

export const urls = {
  inventario: {
    /** Qué hay en bodega, cuánto vale y los frascos ya armados. */
    resumen: '/inventario',
    /** Progreso del arranque (la lista de "Primeros pasos"). */
    primerosPasos: '/inventario/primeros-pasos',
    /** Qué reponer y cuánto. Solo lee, no mueve nada. */
    reposicion: '/inventario/reposicion',
    /** Entradas y salidas de UN material, con su costo. */
    movimientos: (insumoId: number) => `/inventario/movimientos/${insumoId}`,
    /** Conteo físico: "tengo X". El sistema calcula la diferencia. */
    ajustes: '/inventario/ajustes',
    /** Salida sin venta: muestra del mostrario, regalo o merma. */
    salidas: '/inventario/salidas',
    /** Punto de pedido de un material suelto. */
    minimo: (insumoId: number) => `/inventario/minimo/${insumoId}`,
    /** Los puntos de pedido de todas las gamas, de una vez. */
    minimosGama: '/inventario/minimos-gama',
    producciones: '/inventario/producciones',
    produccion: (id: number) => `/inventario/producciones/${id}`,
  },

  /** Materiales, sus costos y las recetas por tamaño. */
  costeo: {
    insumos: '/costeo/insumos',
    insumo: (id: number) => `/costeo/insumos/${id}`,
    formulas: '/costeo/formulas',
    /** Gamas de esencia con su punto de pedido. */
    gamas: '/costeo/gamas/todas',
  },

  perfumes: {
    /** Catálogo COMPLETO, sin paginar. Ojo: responde `{ data: { data: [...] } }`. */
    todos: '/parfums',
  },
} as const;
