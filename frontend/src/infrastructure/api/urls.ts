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

/** Las cuatro listas de clasificación que existen. */
export type Clasificacion = 'tipos-aroma' | 'ocasiones' | 'categorias' | 'presentaciones';

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
    /** Frascos que ya existían antes del sistema. NO descuenta material. */
    cargaInicialArmados: '/inventario/terminado/carga-inicial',
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
    crearInsumo: '/costeo/insumos',
    insumo: (id: number) => `/costeo/insumos/${id}`,
    /** Recetas por tamaño: qué lleva y cuánto de cada cosa. */
    formulas: '/costeo/formulas',
    crearFormula: '/costeo/formulas',
    formula: (id: number) => `/costeo/formulas/${id}`,
    /** Los accesorios fijos de un tamaño (van con cada frasco de ese tamaño). */
    accesoriosFormula: (id: number) => `/costeo/formulas/${id}/accesorios`,
    /** Precio mayorista por cantidad ("de 10 a 49 unidades, tanto"). */
    escalas: '/costeo/escalas',
    escala: (id: number) => `/costeo/escalas/${id}`,
    /** Gamas de esencia con su punto de pedido. */
    gamas: '/costeo/gamas/todas',
    /** OJO, no es la misma: esta da el COSTO POR ML promedio de cada gama. */
    promediosPorGama: '/costeo/gamas',
    gama: (id: number) => `/costeo/gamas/${id}`,
    crearGama: '/costeo/gamas',
    /** Datos de la empresa y condiciones comerciales que salen en el PDF. */
    config: '/costeo/config',
  },

  /** Cotizaciones mayoristas (B2B). */
  cotizaciones: {
    lista: '/cotizaciones',
    crear: '/cotizaciones',
    cotizacion: (id: number) => `/cotizaciones/${id}`,
    /** Borrador → enviada, al mandarla por WhatsApp. */
    estado: (id: number) => `/cotizaciones/${id}/estado`,
  },

  perfumes: {
    /** Catálogo COMPLETO, sin paginar. Ojo: responde `{ data: { data: [...] } }`. */
    todos: '/parfums',
    /**
     * Igual, pero **incluye lo que está fuera de la tienda**. Lo usan Ventas y
     * Créditos: al registrar un pedido de WhatsApp se vende lo que hay, no solo
     * lo que está publicado — y los accesorios (perfumero, bolsa) nacen sin
     * publicar a propósito. El servidor solo honra `todos=1` si eres admin, así
     * que nadie puede listar lo oculto agregándolo a la URL.
     */
    todosConOcultos: '/parfums?todos=1',
    /** La ficha pública de un perfume, por su slug. */
    porSlug: (slug: string) => `/parfums/by-slug/${encodeURIComponent(slug)}`,
    /** El "también te puede gustar" de esa misma ficha. */
    relacionados: (slug: string) => `/parfums/by-slug/${encodeURIComponent(slug)}/related`,
    /** Novedades y más vendidos del home, calculados de las ventas. */
    destacados: '/parfums/destacados',
    crear: '/parfums/create',
    actualizar: (id: number) => `/parfums/update/${id}`,
    borrar: (id: number) => `/parfums/delete/${id}`,
    /** La lista de precios: categoría × talla. */
    precios: '/parfums/precios',
    /** Sacar de la tienda / devolver a la tienda. Distinto de agotado. */
    publicado: (id: number) => `/parfums/${id}/publicado`,
    /** "No hay ahora mismo": se sigue viendo, marcado. */
    agotado: (id: number) => `/parfums/${id}/agotado`,
    descuento: (id: number) => `/parfums/${id}/descuento`,
    /** Pone el mismo % a TODOS los perfumes de una categoría. */
    descuentoPorCategoria: '/parfums/descuento/por-categoria',

    /**
     * Enlazar cada perfume con la esencia de la que se fabrica. Sin ese enlace
     * la venta no descuenta material y el costo no es real, así que hay tres
     * caminos: proponer por nombre, aplicar los propuestos, y asignar a mano.
     */
    esencia: {
      sugerencias: '/parfums/esencia/sugerencias',
      enlaces: '/parfums/esencia/enlaces',
      masiva: '/parfums/esencia/masiva',
      /** Esencias que aún no tienen su perfume en el catálogo (GET propone, POST crea). */
      emparejar: '/parfums/esencia/emparejar',
    },
    /** Contadores del arranque de la pestaña Productos. Solo admin. */
    primerosPasosProductos: '/parfums/primeros-pasos',
  },

  ventas: {
    /**
     * Listado paginado. Los filtros se pasan como `params` de la petición, no
     * pegados a la cadena: así nadie tiene que acordarse de `encodeURIComponent`
     * (y un nombre con "&" dejaba de romper la búsqueda).
     */
    lista: '/ventas',
    /**
     * Los totales del mes vienen DENTRO de `lista` cuando se piden con
     * `con_totales: 1`. Este endpoint suelto queda para quien solo los quiera.
     */
    totales: '/ventas/totales',
    porMes: '/ventas/por-mes',
    crear: '/ventas',
    venta: (id: number) => `/ventas/${id}`,
    /** Reintenta la inferencia venta→perfumes de lo importado sin enlazar. */
    enlazarPerfumes: '/ventas/enlazar-perfumes',
  },

  combos: {
    todos: '/combos',
    /** Paginado para el dashboard. */
    lista: '/combos',
    /** La ficha pública de un combo, por su slug. */
    porSlug: (slug: string) => `/combos/by-slug/${encodeURIComponent(slug)}`,
    relacionados: (slug: string) => `/combos/by-slug/${encodeURIComponent(slug)}/related`,
    crear: '/combos',
    combo: (id: number) => `/combos/${id}`,
    descuento: (id: number) => `/combos/${id}/descuento`,
  },

  /**
   * Aromas, ocasiones, categorías y presentaciones: cuatro listas con el MISMO
   * juego de rutas, por eso se generan en vez de escribirlas cuatro veces.
   * `mover_a` solo lo usan las categorías: sus perfumes no pueden quedar
   * huérfanos, porque el precio sale de la lista categoría × talla.
   */
  clasificaciones: (tipo: Clasificacion) => ({
    lista: `/parfums/${tipo}`,
    crear: `/parfums/${tipo}`,
    uno: (id: number) => `/parfums/${tipo}/${id}`,
    borrarMoviendo: (id: number, destinoId: number) =>
      `/parfums/${tipo}/${id}?mover_a=${destinoId}`,
  }),

  /** Los popups de la tienda y los descuentos que reparten. */
  anuncios: {
    /** Los vigentes que ve el visitante. La audiencia se filtra en el cliente. */
    publico: '/anuncios',
    /** Emite el código de un solo uso de ese cupón, para quien NO tiene cuenta. */
    emitirCodigo: (id: number) => `/anuncios/${id}/codigo`,
    admin: '/anuncios/admin',
    crear: '/anuncios',
    anuncio: (id: number) => `/anuncios/${id}`,
    /** Certifica un código de descuento (CP-XXXXXX) antes de aplicarlo. */
    codigo: (codigo: string) => `/anuncios/codigos/${encodeURIComponent(codigo)}`,
    /** Anular o reactivar ese código. Misma ruta, con PATCH. */
    estadoCodigo: (codigo: string) => `/anuncios/codigos/${encodeURIComponent(codigo)}`,
  },

  creditos: {
    lista: '/creditos',
    totales: '/creditos/totales',
    crear: '/creditos',
    credito: (id: number) => `/creditos/${id}`,
    abono: (id: number) => `/creditos/${id}/abono`,
    borrarAbono: (id: number, abonoId: number) => `/creditos/${id}/abono/${abonoId}`,
  },

  /** Compras a proveedores (la tabla se llama `pagos_proveedor`). */
  pagos: {
    lista: '/pagos',
    totales: '/pagos/totales',
    crear: '/pagos',
    pago: (id: number) => `/pagos/${id}`,
    /** IVA por proveedor: se configura ahí, nunca global. */
    configIva: '/pagos/config-iva',
    soportes: '/pagos/soportes',
  },

  empresas: {
    lista: '/empresas',
    crear: '/empresas',
  },

  usuarios: {
    lista: '/usuarios',
    crear: '/usuarios',
    usuario: (id: number) => `/usuarios/${id}`,
    /** Cupo y comportamiento de pago, calculado por el servidor (solo admin). */
    perfilCredito: (id: number) => `/usuarios/${id}/perfil-credito`,
  },

  devoluciones: {
    lista: '/devoluciones',
    crear: '/devoluciones',
    devolucion: (id: number) => `/devoluciones/${id}`,
    /** Mover de solicitada a aprobada, rechazada o resuelta. */
    estado: (id: number) => `/devoluciones/${id}/estado`,
    /** Las ventas elegibles para devolver. */
    ventas: '/devoluciones/ventas',
    /** Portal del cliente: sus compras con la garantía todavía viva. */
    misCompras: '/devoluciones/mis-compras',
    /** Lo que reporta el cliente, con fotos (multipart). */
    solicitar: '/devoluciones/solicitar',
  },

  /** "Avísame cuando vuelva": el interés que dejan los clientes. */
  avisos: {
    admin: '/avisos/admin',
    marcarNotificados: (perfumeId: number) => `/avisos/admin/${perfumeId}/notificados`,
    /** Los del cliente logueado, solo los ids: pintan la campana de cada card. */
    mios: '/avisos/mios',
    /** Mismo camino para poner (POST) y quitar (DELETE) el aviso de un perfume. */
    aviso: (perfumeId: number) => `/avisos/${perfumeId}`,
  },

  /** El corazón de las cards. Solo existe para el cliente logueado. */
  favoritos: {
    /** Solo los ids, que es lo que necesita la card para pintarse. */
    mios: '/favoritos',
    /** Los perfumes enteros, para la página "Mis favoritos". */
    detalle: '/favoritos/detalle',
    /** POST alterna: si ya estaba, lo quita. */
    alternar: (perfumeId: number) => `/favoritos/${perfumeId}`,
  },

  /** El portal del cliente: lo suyo, no lo del admin. */
  portal: {
    /** Su deuda y sus abonos. Solo lectura: los créditos los da el admin. */
    credito: '/portal/credito',
    /** Su código de invitación y los amigos que trajo, con si ya compraron. */
    referidos: '/portal/referidos',
    /** Los cupones que le quedan por usar (la versión con cuenta). */
    descuentos: '/portal/descuentos',
    /** Emite el código de un solo uso de ese cupón. */
    emitirCodigo: (id: number) => `/portal/descuentos/${id}/codigo`,
  },

  /** La tarjeta de sellos: configuración, progreso de cada cliente y entregas. */
  recompensas: {
    config: '/recompensas/config',
    clientes: '/recompensas/clientes',
    /** Premio entregado: la tarjeta del cliente se reinicia. */
    entregar: (clienteId: number) => `/recompensas/clientes/${clienteId}/entregar`,
    /** Regla propia para UN cliente (otro objetivo, otro premio). */
    override: (clienteId: number) => `/recompensas/clientes/${clienteId}/override`,
    /** Las fotos de la entrega, que se moderan antes de publicarse. */
    entregas: '/recompensas/admin/entregas',
    entrega: (id: number) => `/recompensas/admin/entregas/${id}`,
    fotosEntrega: (id: number) => `/recompensas/admin/entregas/${id}/fotos`,
    /** Lo que ve el cliente en su portal. */
    miTarjeta: '/recompensas/mi-tarjeta',
    misEntregas: '/recompensas/mis-entregas',
    subirFotos: (id: number) => `/recompensas/entregas/${id}/fotos`,
    ganadores: '/recompensas/ganadores',
  },

  /** Textos e imágenes de la página "Sobre nosotros". */
  nosotros: {
    /** Lo que ve el visitante. Responde `{ data: null }` si aún no se configuró. */
    publico: '/nosotros',
    config: '/nosotros/config',
    imagen: '/nosotros/imagen',
  },

  /** Copia de seguridad de la base, con doble candado (sesión + TOTP). */
  backup: {
    /** Fecha de la última copia y si el segundo factor está configurado. */
    estado: '/backup/estado',
    descargar: '/backup',
    activarTotp: '/backup/totp/setup',
  },

  /** La campana: lo que está pendiente, recalculado en cada consulta. */
  notificaciones: '/notificaciones',

  reportes: (ruta: string) => `/reportes/${ruta}`,

  blog: {
    /** La lista pública de entradas publicadas, paginada. */
    publico: (pagina: number, porPagina: number) => `/blog?page=${pagina}&limit=${porPagina}`,
    /** Una entrada por su slug. Responde `{ data: null }` si no existe. */
    porSlug: (slug: string) => `/blog/${encodeURIComponent(slug)}`,
    admin: '/blog/admin',
    crear: '/blog/admin',
    entrada: (id: number) => `/blog/admin/${id}`,
    /** La imagen de cabecera de una entrada. El campo del formulario es `imagen`. */
    portada: '/blog/admin/portada',
  },

  /**
   * La sesión. `refresh` NO está aquí a propósito: lo pide el interceptor de
   * `http.ts` por su cuenta y fuera de la instancia, porque si él mismo diera
   * 401 se llamaría a sí mismo para siempre.
   */
  auth: {
    login: '/auth/login',
    /** Inicia sesión con el token que devuelve el botón de Google. */
    google: '/auth/google',
    logout: '/auth/logout',
    /** Quién soy. Responde 401 si no hay sesión: eso NO es un error que mostrar. */
    yo: '/auth/me',
    registro: '/auth/register',
    /** El enlace que llega al correo. El token va en el camino, no en el cuerpo. */
    verificar: (token: string) => `/auth/verify/${encodeURIComponent(token)}`,
  },

  /** "Encuentra tu perfume ideal": GET trae la última, POST pide una nueva. */
  recomendaciones: '/recomendaciones',

  /** Redes sociales y el enlace único de contacto (la página /contactame). */
  contacto: {
    /** Lo que ve el visitante en /contactame. `admin` es la versión editable. */
    publico: '/contacto',
    admin: '/contacto/admin',
    config: '/contacto/config',
    avatar: '/contacto/avatar',
    fondo: '/contacto/fondo',
    exportar: '/contacto/export',
    importar: '/contacto/import',
    links: '/contacto/links',
    link: (id: number) => `/contacto/links/${id}`,
    reordenar: '/contacto/links/reorder',
  },

  /** Subida de imágenes del admin (perfumes, combos, anuncios). Campo: `image`. */
  upload: '/upload',

  resenas: {
    /** Las reseñas publicadas de un perfume. Públicas: se ven sin sesión. */
    producto: (perfumeId: number) => `/resenas/producto/${perfumeId}`,
    admin: '/resenas/admin',
    moderar: (id: number) => `/resenas/admin/${id}`,
    /** Lo que el cliente compró y todavía puede reseñar. */
    misCompras: '/resenas/mis-compras',
    /** Deja o corrige su reseña. Va con fotos, así que es multipart. */
    crear: '/resenas',
  },

  /**
   * Excel: el mismo juego de rutas para cada entidad (perfumes, ventas,
   * inventario…), por eso se generan igual que las clasificaciones.
   */
  excel: (entidad: string) => ({
    /** Qué columnas espera el archivo, para pintarlas en el modal. */
    spec: `/import/${entidad}/spec`,
    plantilla: `/import/${entidad}/template`,
    /**
     * `familia` solo la usa el Catálogo, que son dos pestañas sobre la misma
     * tabla: sin ella, Exportar desde Productos se traía los 222 perfumes.
     */
    exportar: (familia?: string) =>
      familia ? `/import/${entidad}/export?familia=${familia}` : `/import/${entidad}/export`,
    importar: `/import/${entidad}`,
  }),
} as const;
