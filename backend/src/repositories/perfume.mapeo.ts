import { Prisma } from '@prisma/client';

/**
 * CÓMO SE LEE UN PERFUME: de fila de base a lo que ve la tienda.
 *
 * Está aparte del repositorio porque son dos oficios distintos: aquí no se
 * consulta ni se escribe nada — todo es puro y síncrono — y es donde viven las
 * reglas que deciden el precio efectivo y si hoy se puede vender. El
 * repositorio se encarga de las consultas y llama a esto al final.
 */

/**
 * Se deriva de `perfumeInclude` en vez de repetirlo: eran dos listas que había
 * que mantener iguales a mano, y al agregarle la gama a una se rompió la otra.
 * (Los tipos se elevan, así que no importa que `perfumeInclude` esté más abajo.)
 */
export type PerfumeRow = Prisma.PerfumeGetPayload<{ include: typeof perfumeInclude }>;

/**
 * La columna `accesorios` es `Json`: puede traer lo que sea. Antes se leía con
 * `as number[]`, que no comprueba nada — un valor raro guardado a mano viajaba
 * a la pantalla como id de accesorio y el pedido salía con un accesorio
 * fantasma. Lo que no sea número se descarta.
 */
const idsDeJson = (v: Prisma.JsonValue): number[] =>
  (Array.isArray(v) ? v : []).filter((x): x is number => typeof x === 'number');

// Un perfume cuenta como "nuevo lanzamiento" durante sus primeros 30 días en el catálogo.
export const NUEVO_DIAS = 7;
const esNuevo = (created: Date) => Date.now() - created.getTime() < NUEVO_DIAS * 86400000;

/**
 * Precio de un perfume en una presentación, en cascada:
 *   1. precio propio de esa presentación (excepción: los de esencia premium lo usan)
 *   2. precio de la lista para (categoría, presentación)
 *   3. precio de respaldo del perfume (perfumes sin categoría o sin lista aún)
 * Así, subir el precio de la lista mueve a todos los perfumes de esa categoría
 * de una sola vez, sin tocar los que tienen precio propio.
 */
const resolverPrecios = (p: PerfumeRow) => {
  const lista = new Map((p.categoria?.precios ?? []).map((pr) => [pr.presentacion_id, Number(pr.precio)]));
  return p.presentaciones.map((r) => ({
    presentacion: r.presentacion.nombre,
    /**
     * Número real de la talla. La etiqueta ("30ML") sirve para buscar el precio;
     * el número, para saber qué receta descontar del inventario. Van juntos para
     * que quien arma un pedido no tenga que adivinar uno a partir del otro.
     * Null a propósito en las que no son talla ("200/250ML", "Combo Personalizado").
     */
    ml: r.presentacion.ml ?? null,
    precio: Number(r.precio ?? lista.get(r.presentacion_id) ?? p.precio),
    /** true = ese precio es exclusivo del perfume, no viene de la lista */
    propio: r.precio != null,
    presentacion_id: r.presentacion_id,
    /** Frasco propio de esta combinación; null = el de la receta del tamaño. */
    envase_insumo_id: r.envase_insumo_id ?? null,
    accesorios: idsDeJson(r.accesorios),
    /** Frascos armados de ESTA talla (no la suma de todas). */
    armados: armadosDeTalla(r),
    /**
     * Por qué no se puede vender ESTA talla, o null si sí. Viaja con el precio
     * porque quien elige tamaño —la tienda y el armador de pedidos— necesita
     * saberlo talla por talla: el perfume puede estar disponible y ese tamaño no.
     */
    motivo_agotado: motivoAgotadoDeTalla(p, r),
  }));
};

/**
 * Cuánta esencia hace falta para armar UNA unidad de la talla más pequeña que
 * ofrece este perfume.
 *
 * Se mide contra la más pequeña —y no contra una fija— porque un perfume que
 * solo se vende en 100 ml necesita 50 ml de esencia, no los 15 del 30 ml.
 * Null = no se puede saber: la talla no tiene receta enlazada, o lo que ofrece
 * no son tallas ("Combo Personalizado", "200/250ML" vienen sin `ml` a propósito).
 */
const esenciaParaUno = (p: PerfumeRow): number | null => {
  const tallas = p.presentaciones
    .map((r) => r.presentacion)
    .filter((x) => x.ml != null && x.ml > 0);
  if (!tallas.length) return null;
  const menor = tallas.reduce((a, b) => (a.ml! <= b.ml! ? a : b));
  return menor.formula ? Number(menor.formula.esencia_ml) : null;
};

/**
 * ¿Se quedó sin esencia para armar ni uno?
 *
 * El corte NO es "tiene algo de stock": con 3 ml de esencia no sale un frasco
 * de 30 ml, que necesita 15. Si el catálogo lo mostrara disponible le estaría
 * prometiendo al cliente algo que no se puede armar.
 *
 * Solo se juzga a los que se FABRICAN: una gorra o un splash comprado no
 * dependen de ninguna esencia. Un perfume sin esencia asignada cuenta como sin
 * esencia — uno recién creado nace así, y hasta que no se le asigne no se sabe
 * con qué armarlo.
 */
export const sinEsenciaParaUno = (p: PerfumeRow): boolean => {
  if ((p.tipo_producto ?? 'fabricado') !== 'fabricado') return false;
  if (!p.insumo_esencia) return true;
  const stock = Number(p.insumo_esencia.stock);
  const necesita = esenciaParaUno(p);
  // Sin receta enlazada, lo único afirmable es que quede algo: inventar aquí un
  // número marcaría agotado a quien sí puede vender.
  return necesita == null ? stock <= 0 : stock < necesita;
};

/**
 * Frascos de este perfume que YA están armados, sumando todas sus tallas.
 *
 * Sale de `perfume_presentacion.stock`, que es la proyección del libro
 * `movimientos_terminado`. Se suman las tallas porque para saber si el perfume
 * es vendible basta con que quede armado UNO de cualquier tamaño.
 */
export const frascosArmados = (p: PerfumeRow): number =>
  p.presentaciones.reduce((total, r) => total + Number(r.stock ?? 0), 0);

/** Frascos armados de UNA talla concreta (los negativos cuentan como cero). */
const armadosDeTalla = (r: PerfumeRow['presentaciones'][number]): number =>
  Math.max(0, Number(r.stock ?? 0));

/** Por qué NO se puede vender hoy, o null si sí se puede. */
export type MotivoAgotado = 'sin_esencia' | 'sin_armados' | 'sin_producto' | null;

/**
 * La regla de disponibilidad, entera y en un solo sitio.
 *
 * Las tres categorías no se consiguen igual, así que no se agotan igual
 * (decidido con el dueño el 2026-08-14):
 *
 * | Categoría  | Cómo se consigue        | Disponible cuando…        |
 * |------------|-------------------------|---------------------------|
 * | Contratipo | se arma contra pedido   | alcanza la esencia        |
 * | 1.1        | se arma por adelantado  | hay frascos armados       |
 * | Original   | viene hecho             | hay stock de su botella   |
 *
 * Devuelve el MOTIVO y no un booleano suelto para poder explicárselo al dueño
 * en la pantalla: "agotado" a secas obliga a adivinar qué le falta.
 */
/**
 * La misma regla, pero **para UNA talla**.
 *
 * `armados` son los frascos de ESA talla, no la suma de todas. Es la corrección
 * del 2026-08-29: sumarlas hacía que un frasco de 50 ml pusiera disponible el de
 * 100 ml, y al vender —que sí busca la talla exacta— no había nada que sacar.
 * Con `armados = null` se juzga al perfume entero (basta con que una talla lo
 * pueda vender), que es lo que necesita la card del catálogo.
 */
const motivoConArmados = (p: PerfumeRow, armados: number): MotivoAgotado => {
  const tipo = p.tipo_producto ?? 'fabricado';

  // Un 1.1 se ofrece cuando está ARMADO, no cuando se podría armar: tener su
  // envase especial y la esencia en bodega no lo pone en la tienda.
  if (p.solo_armado) return armados > 0 ? null : 'sin_armados';

  // El original no se fabrica: manda el stock del insumo que ES el producto.
  // Sin insumo asignado no hay nada que mirar, y marcarlo agotado escondería
  // de la tienda cosas que sí se tienen.
  if (tipo === 'comprado') {
    if (!p.insumo_producto) return null;
    return Number(p.insumo_producto.stock) > 0 ? null : 'sin_producto';
  }

  // Un frasco ya armado se vende aunque no quede ni gota de esencia: esa
  // esencia ya se gastó el día que se armó.
  if (armados > 0) return null;

  return sinEsenciaParaUno(p) ? 'sin_esencia' : null;
};

/** Por qué no se puede vender ESTA talla hoy, o null si sí se puede. */
export const motivoAgotadoDeTalla = (
  p: PerfumeRow, r: PerfumeRow['presentaciones'][number],
): MotivoAgotado => motivoConArmados(p, armadosDeTalla(r));

/**
 * Por qué no se puede vender el perfume, mirándolo entero.
 *
 * Disponible = **alguna** de sus tallas lo está. Un 1.1 con un solo frasco de
 * 100 ml sigue apareciendo en el catálogo; lo que ya no pasa es que ese frasco
 * ponga disponible su talla de 50 ml (eso lo decide `motivoAgotadoDeTalla`).
 */
export const motivoAgotado = (p: PerfumeRow): MotivoAgotado => {
  if (!p.presentaciones.length) return motivoConArmados(p, 0);
  const motivos = p.presentaciones.map((r) => motivoAgotadoDeTalla(p, r));
  return motivos.includes(null) ? null : (motivos[0] ?? null);
};

export const sinExistenciasParaUno = (p: PerfumeRow): boolean => motivoAgotado(p) !== null;

export const mapPerfume = (p: PerfumeRow) => {
  const precios = resolverPrecios(p);
  const motivo = motivoAgotado(p);
  // El precio "de portada" (cards, PDF, SEO) es el más barato de sus
  // presentaciones: es el que acompaña al "desde $X" cuando hay varias.
  const desde = precios.length ? Math.min(...precios.map((x) => x.precio)) : Number(p.precio);
  return {
    id:           p.id,
    nombre:       p.nombre,
    descripcion:  p.descripcion ?? null,
    precio:       desde,
    /** Precio de cada presentación ya resuelto (lista o excepción del perfume). */
    precios,
    /** true = sus presentaciones no valen todas lo mismo (la card muestra "desde"). */
    varios_precios: precios.length > 1 && new Set(precios.map((x) => x.precio)).size > 1,
    duracion:     p.duracion ?? null,
    proyeccion:   p.proyeccion ?? null,
    imagen_url:   p.imagen_url ?? null,
    genero:       p.genero ?? null,
    categoria:    p.categoria?.nombre ?? null,
    categoria_id: p.categoria_id ?? null,
    // % efectivo que consume todo el sistema (catálogo, carrito, cupones, SEO):
    // el mayor entre el propio del perfume y el general de su categoría
    descuento:        Math.max(p.descuento, p.categoria?.descuento ?? 0),
    descuento_propio: p.descuento,
    /** Contratipo de esencia premium: lleva distintivo y nunca entra en combos. */
    esencia_premium:  p.esencia_premium,
    insumo_esencia_id: p.insumo_esencia_id ?? null,
    tipo_producto: p.tipo_producto ?? 'fabricado',
    insumo_producto_id: p.insumo_producto_id ?? null,
    ml_utiles: p.ml_utiles ?? null,
    insumo_esencia_nombre: p.insumo_esencia?.nombre ?? null,
    /// Costo real por ml de SU esencia (cada fragancia tiene la suya).
    insumo_esencia_precio: p.insumo_esencia ? Number(p.insumo_esencia.precio) : null,
    /**
     * Gama del perfume: NO es una columna suya, se HEREDA de su esencia.
     *
     * Deducirla es mejor que guardarla — el día que una esencia se reclasifique
     * de árabe a premium, sus perfumes se mueven solos; una copia guardada
     * quedaría mintiendo (mismo criterio que los sellos y el cupo). Null = el
     * perfume todavía no tiene esencia asignada, y entonces NO se puede
     * segmentar por gama: quien filtre tiene que contarlos aparte, no
     * dejarlos caer en silencio.
     */
    gama:    p.insumo_esencia?.gama?.nombre ?? null,
    gama_id: p.insumo_esencia?.gama_id ?? null,
    /// Existencias de SU esencia, para saber si hoy se puede armar uno.
    insumo_esencia_stock: p.insumo_esencia ? Number(p.insumo_esencia.stock) : null,
    /**
     * Lo que ve la tienda: lo marcó el dueño **o** no alcanza la esencia.
     *
     * El sistema NUNCA escribe la columna; esto se recalcula en cada consulta
     * (mismo criterio que los sellos, el cupo y la gama). Un valor guardado
     * quedaría mintiendo en cuanto entre una compra de esencia, y el dueño
     * tendría que acordarse de desmarcar a mano lo que ya puede vender.
     */
    agotado:      p.agotado || motivo !== null,
    /** La marca manual, cruda: es lo único que el dashboard puede desmarcar. */
    agotado_manual: p.agotado,
    /** Motivo calculado, para poder EXPLICARLO en vez de solo marcarlo. */
    sin_esencia:  motivo === 'sin_esencia',
    /**
     * Qué le falta exactamente: esencia (contratipo), frascos armados (1.1) o
     * stock de su botella (original). Null = no le falta nada.
     */
    motivo_agotado: motivo,
    /** Frascos de este perfume que ya están armados, sumando sus tallas. */
    frascos_armados: frascosArmados(p),
    /**
     * Unidades del insumo que ES el producto (la botella original, la gorra).
     * Null = no es un producto comprado o todavía no tiene insumo asignado.
     *
     * No cuesta una consulta más: `insumo_producto` ya viaja en `perfumeInclude`
     * desde que la regla de agotado lo necesita. Era la única razón por la que
     * la columna Stock de Productos se había quedado esperando.
     */
    producto_stock: p.insumo_producto ? Number(p.insumo_producto.stock) : null,
    /** Los 1.1: solo se venden si ya están armados, nunca contra pedido. */
    solo_armado: p.solo_armado,
    /** Es un accesorio (perfumero, bolsa, tarjeta), no una fragancia. */
    es_accesorio: p.es_accesorio,
    /** Cuánta esencia pide una unidad de su talla más pequeña (para el motivo). */
    esencia_necesaria: esenciaParaUno(p),
    publicado:    p.publicado ?? true,
    es_nuevo:     esNuevo(p.created_at),
    tipos_aroma:    p.tipos_aroma.map((r) => r.tipo_aroma.nombre),
    ocasiones:      p.ocasiones.map((r) => r.ocasion.nombre),
    presentaciones: p.presentaciones.map((r) => r.presentacion.nombre),
    // Promedio de reseñas aprobadas (se rellena con `conRatings`)
    rating_promedio: 0,
    rating_total:    0,
  };
};

export const perfumeInclude = {
  categoria:      { include: { precios: true } },
  tipos_aroma:    { include: { tipo_aroma: true } },
  ocasiones:      { include: { ocasion: true } },
  // La receta viaja con la talla para poder saber, sin una segunda consulta, si
  // hoy alcanza la esencia para armar uno (ver `sinEsenciaParaUno`). Traerla
  // aquí es lo que deja a `mapPerfume` puro y síncrono: cargarla aparte
  // obligaría a acordarse de aplicarla en cada consulta del catálogo, y la que
  // se olvidara mostraría como disponible algo que no se puede armar.
  presentaciones: { include: { presentacion: { include: { formula: true } } } },
  // Esencia concreta del perfume: su costo real por ml (cada fragancia la suya)
  // y su GAMA, que es de donde el perfume hereda si es árabe, clásico o premium.
  insumo_esencia: { include: { gama: true } },
  // El insumo que ES el producto (la botella original, la gorra): su stock es
  // lo que decide si un `comprado` se puede vender. Viaja aquí por la misma
  // razón que la receta: para que la regla de agotado se aplique sola en todas
  // las consultas del catálogo, sin que nadie tenga que acordarse.
  insumo_producto: true,
} as const;
