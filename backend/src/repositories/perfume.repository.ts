import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';
import { CreatePerfumeDTO } from '../types/perfume.type';
import { paginatedResponse } from '../utils/pagination';
import { toSlug } from '../utils/slug';
import { borrarImagenSiCambio, borrarImagenSubida } from '../utils/imagenes';
import { resumenRatings } from './resena.repository';
import { badRequest } from '../utils/httpError';
import { buildPerfumeIndex, matchPerfume } from '../utils/perfumeMatcher';

/**
 * Se deriva de `perfumeInclude` en vez de repetirlo: eran dos listas que había
 * que mantener iguales a mano, y al agregarle la gama a una se rompió la otra.
 * (Los tipos se elevan, así que no importa que `perfumeInclude` esté más abajo.)
 */
type PerfumeRow = Prisma.PerfumeGetPayload<{ include: typeof perfumeInclude }>;

// Un perfume cuenta como "nuevo lanzamiento" durante sus primeros 30 días en el catálogo.
const NUEVO_DIAS = 7;
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
    envase_insumo_id: (r as any).envase_insumo_id ?? null,
    accesorios: ((r as any).accesorios as number[] | null) ?? [],
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

export const mapPerfume = (p: PerfumeRow) => {
  const precios = resolverPrecios(p);
  const sinEsencia = sinEsenciaParaUno(p);
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
    agotado:      p.agotado || sinEsencia,
    /** La marca manual, cruda: es lo único que el dashboard puede desmarcar. */
    agotado_manual: p.agotado,
    /** Motivo calculado, para poder EXPLICARLO en vez de solo marcarlo. */
    sin_esencia:  sinEsencia,
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
} as const;

/** Rellena el promedio/total de reseñas aprobadas de una lista ya mapeada. */
export const conRatings = async <T extends { id: number }>(perfumes: T[]): Promise<T[]> => {
  const resumen = await resumenRatings(perfumes.map((p) => p.id));
  return perfumes.map((p) => {
    const r = resumen.get(p.id);
    return r ? { ...p, rating_promedio: r.promedio, rating_total: r.total } : p;
  });
};

/**
 * Filtro de la tienda: solo lo publicado.
 *
 * Un perfume despublicado desaparece del catálogo como si no existiera —
 * listados, búsqueda, destacados, relacionados, detalle y sitemap. Es distinto
 * de `agotado`, que SÍ se muestra (marcado, con "avísame cuando vuelva").
 *
 * Se usa en TODAS las consultas públicas. El dashboard es el único que ve los
 * apagados, y para eso tiene que pedirlos explícitamente (`todos`).
 */
export const SOLO_PUBLICADOS = { publicado: true } as const;

export const selectAllParfums = async (todos = false) => {
  const perfumes = await prisma.perfume.findMany({
    where: todos ? undefined : SOLO_PUBLICADOS,
    include: perfumeInclude,
    orderBy: { nombre: 'asc' },
  });
  return { data: await conRatings(perfumes.map(mapPerfume)) };
};

/** Filtros del catálogo público (por nombre, tal como los muestra el frontend). */
export type OrdenCatalogo = 'destacados' | 'precio_asc' | 'precio_desc' | 'nombre';

export interface CatalogoFiltros {
  genero?: 'dama' | 'caballero' | 'unisex';
  categorias?: string[];
  aromas?: string[];
  ocasiones?: string[];
  orden?: OrdenCatalogo;
}

// Ojo: el precio "efectivo" sale de la cascada (mapPerfume), no de una columna.
// Ordenamos por `perfumes.precio` (respaldo), suficiente porque casi todos los
// perfumes comparten precio; si se quisiera exacto habría que denormalizar.
const ORDEN_CATALOGO: Record<OrdenCatalogo, Prisma.PerfumeOrderByWithRelationInput> = {
  destacados: { created_at: 'desc' }, // lo más nuevo primero
  precio_asc: { precio: 'asc' },
  precio_desc: { precio: 'desc' },
  nombre: { nombre: 'asc' },
};

export const selectParfumsPaginated = async (
  page: number,
  limit: number,
  search?: string,
  filtros?: CatalogoFiltros,
  /** Solo el dashboard: incluir también los que están fuera de la tienda. */
  todos = false,
) => {
  const skip = (page - 1) * limit;
  const and: Prisma.PerfumeWhereInput[] = todos ? [] : [SOLO_PUBLICADOS];
  if (search) {
    and.push({
      OR: [
        { nombre: { contains: search } },
        { descripcion: { contains: search } },
        { categoria: { nombre: { contains: search } } },
      ],
    });
  }
  if (filtros?.genero) and.push({ genero: filtros.genero });
  if (filtros?.categorias?.length) and.push({ categoria: { nombre: { in: filtros.categorias } } });
  if (filtros?.aromas?.length)
    and.push({ tipos_aroma: { some: { tipo_aroma: { nombre: { in: filtros.aromas } } } } });
  if (filtros?.ocasiones?.length)
    and.push({ ocasiones: { some: { ocasion: { nombre: { in: filtros.ocasiones } } } } });
  const where: Prisma.PerfumeWhereInput | undefined = and.length ? { AND: and } : undefined;
  const orderBy = ORDEN_CATALOGO[filtros?.orden ?? 'destacados'];
  const [rows, total] = await Promise.all([
    prisma.perfume.findMany({ where, include: perfumeInclude, orderBy, skip, take: limit }),
    prisma.perfume.count({ where }),
  ]);
  return paginatedResponse(await conRatings(rows.map(mapPerfume)), total, page, limit);
};

/** Perfumes por lista de ids, preservando el orden dado (favoritos, etc.). */
export const selectPerfumesByIds = async (ids: number[]) => {
  if (!ids.length) return [];
  // También filtra: un favorito que se sacó del catálogo no debe reaparecer
  // como tarjeta que al abrirla da "no encontrado".
  const rows = await prisma.perfume.findMany({
    where: { id: { in: ids }, ...SOLO_PUBLICADOS },
    include: perfumeInclude,
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordenados = ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => p != null);
  return conRatings(ordenados.map(mapPerfume));
};

/**
 * Enlaces perfume→presentación con su precio propio cuando lo tienen.
 * Sin precio propio quedan en null y heredan el de la lista de su categoría.
 */
const enlacesPresentacion = (data: CreatePerfumeDTO) => {
  const propios = new Map((data.precios_propios ?? []).map((p) => [p.presentacion_id, p.precio]));
  // Frasco y accesorios de ESTE perfume en ESTA talla (mandan sobre la receta)
  const envases = new Map((data.envases_talla ?? []).map((e) => [e.presentacion_id, e]));
  return (data.presentaciones ?? []).map((id) => {
    const e = envases.get(id);
    return {
      presentacion_id: id,
      precio: propios.get(id) ?? null,
      envase_insumo_id: e?.envase_insumo_id ?? null,
      accesorios: e?.accesorios?.length ? e.accesorios : undefined,
    };
  });
};

export const createPerfume = async (data: CreatePerfumeDTO) => {
  const perfume = await prisma.perfume.create({
    data: {
      nombre:       data.nombre,
      descripcion:  data.descripcion ?? null,
      precio:       data.precio,
      duracion:     data.duracion ?? null,
      proyeccion:   data.proyeccion ?? null,
      imagen_url:   data.imagen_url ?? null,
      genero:       data.genero ?? null,
      categoria_id: data.categoria_id ?? null,
      descuento:    data.descuento ?? 0,
      agotado:      data.agotado ?? false,
      // Nace publicado salvo que se pida lo contrario (ficha a medio llenar).
      publicado:    data.publicado ?? true,
      esencia_premium:  data.esencia_premium ?? false,
      insumo_esencia_id: data.insumo_esencia_id ?? null,
      tipo_producto: data.tipo_producto ?? 'fabricado',
      insumo_producto_id: data.insumo_producto_id ?? null,
      ml_utiles: data.ml_utiles ?? null,
      tipos_aroma: {
        create: (data.tipos_aroma ?? []).map((id) => ({ tipo_aroma_id: id })),
      },
      ocasiones: {
        create: (data.ocasiones ?? []).map((id) => ({ ocasion_id: id })),
      },
      presentaciones: { create: enlacesPresentacion(data) },
    },
  });
  return { id: perfume.id };
};

export const editPerfume = async (id: string, data: CreatePerfumeDTO) => {
  const numId = Number(id);
  const previo = await prisma.perfume.findUnique({
    where: { id: numId },
    select: { imagen_url: true },
  });
  await prisma.$transaction([
    prisma.perfumeTipoAroma.deleteMany({ where: { perfume_id: numId } }),
    prisma.perfumeOcasion.deleteMany({ where: { perfume_id: numId } }),
    prisma.perfumePresentacion.deleteMany({ where: { perfume_id: numId } }),
    prisma.perfume.update({
      where: { id: numId },
      data: {
        nombre:       data.nombre,
        descripcion:  data.descripcion ?? null,
        precio:       data.precio,
        duracion:     data.duracion ?? null,
        proyeccion:   data.proyeccion ?? null,
        imagen_url:   data.imagen_url ?? null,
        genero:       data.genero ?? null,
        categoria_id: data.categoria_id ?? null,
        // El form de edición no envía descuento/agotado/publicado: no hay que
        // resetearlos. Ojo con `publicado`: si se colara un valor por defecto,
        // editar un perfume lo devolvería solo a la tienda.
        ...(data.descuento !== undefined ? { descuento: data.descuento } : {}),
        ...(data.agotado !== undefined ? { agotado: data.agotado } : {}),
        ...(data.publicado !== undefined ? { publicado: data.publicado } : {}),
        ...(data.esencia_premium !== undefined ? { esencia_premium: data.esencia_premium } : {}),
        ...(data.insumo_esencia_id !== undefined ? { insumo_esencia_id: data.insumo_esencia_id ?? null } : {}),
        ...(data.tipo_producto !== undefined ? { tipo_producto: data.tipo_producto } : {}),
        ...(data.insumo_producto_id !== undefined ? { insumo_producto_id: data.insumo_producto_id ?? null } : {}),
        ...(data.ml_utiles !== undefined ? { ml_utiles: data.ml_utiles ?? null } : {}),
        tipos_aroma: {
          create: (data.tipos_aroma ?? []).map((tid) => ({ tipo_aroma_id: tid })),
        },
        ocasiones: {
          create: (data.ocasiones ?? []).map((oid) => ({ ocasion_id: oid })),
        },
        presentaciones: { create: enlacesPresentacion(data) },
      },
    }),
  ]);
  borrarImagenSiCambio(previo?.imagen_url, data.imagen_url);
  return { id };
};

export const deletePerfume = async (id: string) => {
  const borrado = await prisma.perfume.delete({ where: { id: Number(id) } });
  borrarImagenSubida(borrado.imagen_url);
  return borrado;
};

export const patchDescuentoPerfume = (id: string, descuento: number) =>
  prisma.perfume.update({ where: { id: Number(id) }, data: { descuento } });

// Un solo registro en la categoría: los perfumes heredan el % de fondo vía mapPerfume
export const patchDescuentoPorCategoria = async (categoriaId: number, descuento: number) => {
  await prisma.categoria.update({ where: { id: categoriaId }, data: { descuento } });
  return prisma.perfume.count({ where: { categoria_id: categoriaId } });
};

export const patchAgotadoPerfume = (id: string, agotado: boolean) =>
  prisma.perfume.update({ where: { id: Number(id) }, data: { agotado } });

/** Saca un perfume de la tienda o lo devuelve, sin borrar nada. */
export const patchPublicadoPerfume = (id: string, publicado: boolean) =>
  prisma.perfume.update({ where: { id: Number(id) }, data: { publicado } });

/**
 * Lo que hace falta para el aviso de "perfumes por revisar" del dashboard.
 *
 * `sin_esencia` cuenta los FABRICADOS sin esencia asignada: esos no descuentan
 * inventario al venderse y su costo entra en cero, así que la ganancia del mes
 * sale inflada. Se cuentan solo los que siguen publicados, que son los que de
 * verdad pueden venderse hoy.
 */
export const resumenPublicacion = async () => {
  const [ocultos, sinEsencia] = await Promise.all([
    prisma.perfume.count({ where: { publicado: false } }),
    prisma.perfume.count({
      where: { publicado: true, tipo_producto: 'fabricado', insumo_esencia_id: null },
    }),
  ]);
  return { ocultos, sin_esencia: sinEsencia };
};

/**
 * Asigna la misma esencia a varios perfumes de una vez.
 *
 * Existe porque hacerlo perfume por perfume son 212 visitas a la ficha, y sin
 * esencia asignada la venta no descuenta material ni el costo es real. El
 * insumo se valida contra `materia_prima`: apuntar un perfume a un envase
 * daría un costo por ml sin sentido.
 */
export const asignarEsenciaMasiva = async (perfumeIds: number[], insumoId: number | null) => {
  if (insumoId !== null) {
    const insumo = await prisma.insumoCosto.findUnique({ where: { id: insumoId } });
    if (!insumo) throw badRequest('Esa esencia no existe');
    if (insumo.tipo !== 'materia_prima') {
      throw badRequest(`"${insumo.nombre}" no es una materia prima, así que no puede ser la esencia de un perfume`);
    }
  }
  const { count } = await prisma.perfume.updateMany({
    where: { id: { in: perfumeIds } },
    data: { insumo_esencia_id: insumoId },
  });
  return count;
};

// ── Lista de precios (categoría × presentación) ─────────────────────────────

/** Toda la lista, para pintar la tabla de precios del dashboard. */
export const selectPrecios = async () => {
  const rows = await prisma.precioLista.findMany({
    include: { categoria: true, presentacion: true },
    orderBy: [{ categoria: { nombre: 'asc' } }, { presentacion: { nombre: 'asc' } }],
  });
  return rows.map((r) => ({
    categoria_id:    r.categoria_id,
    categoria:       r.categoria.nombre,
    presentacion_id: r.presentacion_id,
    presentacion:    r.presentacion.nombre,
    precio:          Number(r.precio),
  }));
};

/**
 * Fija (o borra) el precio estándar de una categoría en una presentación.
 * precio null = esa combinación deja de tener precio de lista.
 */
export const setPrecioLista = async (categoriaId: number, presentacionId: number, precio: number | null) => {
  const where = { categoria_id_presentacion_id: { categoria_id: categoriaId, presentacion_id: presentacionId } };
  if (precio == null) {
    await prisma.precioLista.deleteMany({ where: { categoria_id: categoriaId, presentacion_id: presentacionId } });
    return { borrado: true };
  }
  await prisma.precioLista.upsert({
    where,
    create: { categoria_id: categoriaId, presentacion_id: presentacionId, precio },
    update: { precio },
  });
  // Cuántos perfumes quedan cobrando este precio (los que no tienen uno propio)
  const afectados = await prisma.perfume.count({
    where: {
      categoria_id: categoriaId,
      presentaciones: { some: { presentacion_id: presentacionId, precio: null } },
    },
  });
  return { afectados };
};

export const findRelatedPerfumes = async (currentId: number, aromaNames: string[]) => {
  const candidates = await prisma.perfume.findMany({
    where: {
      id: { not: currentId },
      ...SOLO_PUBLICADOS,
      ...(aromaNames.length > 0 && {
        tipos_aroma: { some: { tipo_aroma: { nombre: { in: aromaNames } } } },
      }),
    },
    include: perfumeInclude,
    take: 20,
  });

  // Fisher-Yates shuffle
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  return candidates.slice(0, 5).map(mapPerfume);
};

/**
 * Destacados del catálogo:
 * - nuevos: perfumes con menos de 30 días. Pocos → más recientes primero;
 *   40 o más → ordenados por más vendidos y luego alfabético.
 * - mas_vendidos: top por unidades vendidas según las ventas enlazadas a perfume.
 */
export const getDestacados = async (limitVendidos = 12) => {
  const desde = new Date(Date.now() - NUEVO_DIAS * 86400000);

  // Una venta de combo enlaza varios perfumes, cada uno con su cantidad de
  // unidades; el total de la venta se reparte proporcional a esas cantidades
  // (los enlaces viejos, todos con cantidad 1, reparten en partes iguales).
  const enlaces = await prisma.ventaPerfume.findMany({
    include: { venta: { select: { cantidad_perfumes: true } } },
  });
  const unidadesPorVenta = new Map<number, number>();
  for (const e of enlaces) {
    unidadesPorVenta.set(e.venta_id, (unidadesPorVenta.get(e.venta_id) ?? 0) + e.cantidad);
  }
  const vendidosMap = new Map<number, number>();
  for (const e of enlaces) {
    const n = unidadesPorVenta.get(e.venta_id) ?? 1;
    const unidades = Math.max(1, Math.round(((e.venta.cantidad_perfumes || 1) * e.cantidad) / n));
    vendidosMap.set(e.perfume_id, (vendidosMap.get(e.perfume_id) ?? 0) + unidades);
  }

  const nuevos = await prisma.perfume.findMany({
    where: { created_at: { gte: desde }, ...SOLO_PUBLICADOS },
    include: perfumeInclude,
  });
  const nuevosOrdenados =
    nuevos.length >= 40
      ? [...nuevos].sort(
          (a, b) =>
            (vendidosMap.get(b.id) ?? 0) - (vendidosMap.get(a.id) ?? 0) ||
            a.nombre.localeCompare(b.nombre, 'es'),
        )
      : [...nuevos].sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

  const topIds = [...vendidosMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limitVendidos)
    .map(([id]) => id);
  // Los más vendidos también se filtran: un perfume que se sacó del catálogo
  // no puede seguir encabezando la home solo porque se vendió mucho antes.
  const topRows = topIds.length
    ? await prisma.perfume.findMany({
        where: { id: { in: topIds }, ...SOLO_PUBLICADOS },
        include: perfumeInclude,
      })
    : [];
  const byId = new Map(topRows.map((p) => [p.id, p]));

  return {
    // Tope de 40 para acotar el payload del home (ya vienen ordenados)
    nuevos: await conRatings(nuevosOrdenados.slice(0, 40).map(mapPerfume)),
    mas_vendidos: await conRatings(topIds
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => p != null)
      .map((p) => ({ ...mapPerfume(p), unidades_vendidas: vendidosMap.get(p.id) ?? 0 }))),
  };
};

export const findPerfumeBySlug = async (slug: string) => {
  // El slug no es reversible (pierde apóstrofes, tildes, símbolos…): se compara
  // contra el slug generado del nombre, igual que lo construye el frontend.
  // Solo publicados: si alguien guardó el enlace de un perfume que se sacó del
  // catálogo, debe responder "no existe", no abrir una ficha que ya no se vende.
  const nombres = await prisma.perfume.findMany({
    where: SOLO_PUBLICADOS,
    select: { id: true, nombre: true },
  });
  const match = nombres.find((p) => toSlug(p.nombre) === slug);
  if (!match) return null;
  const perfume = await prisma.perfume.findUnique({
    where: { id: match.id },
    include: perfumeInclude,
  });
  if (!perfume) return null;
  return (await conRatings([mapPerfume(perfume)]))[0];
};

// ── Aromas ──────────────────────────────────────────────────────────────────

export const getAllAromas = () =>
  prisma.tipoAroma.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } });

export const createAroma = async (nombre: string) => {
  const row = await prisma.tipoAroma.create({ data: { nombre } });
  return row.id;
};

export const deleteAroma = (id: string) =>
  prisma.tipoAroma.delete({ where: { id: Number(id) } });

export const updateAroma = (id: string, nombre: string) =>
  prisma.tipoAroma.update({ where: { id: Number(id) }, data: { nombre } });

// ── Ocasiones ───────────────────────────────────────────────────────────────

export const getAllOcasiones = () =>
  prisma.ocasion.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } });

export const createOcasion = async (nombre: string) => {
  const row = await prisma.ocasion.create({ data: { nombre } });
  return row.id;
};

export const deleteOcasion = (id: string) =>
  prisma.ocasion.delete({ where: { id: Number(id) } });

export const updateOcasion = (id: string, nombre: string) =>
  prisma.ocasion.update({ where: { id: Number(id) }, data: { nombre } });

// ── Categorías ──────────────────────────────────────────────────────────────

/**
 * `usos` = cuántos perfumes la tienen. El dashboard lo necesita porque borrar
 * una categoría en uso NO falla (la FK es SET NULL): dejaría esos perfumes sin
 * categoría y, como el precio sale de la lista categoría × talla, les cambiaría
 * el precio al de respaldo. Con el conteo, la interfaz obliga a mudarlos antes.
 */
export const getAllCategorias = async () => {
  const rows = await prisma.categoria.findMany({
    select: { id: true, nombre: true, descuento: true, _count: { select: { perfumes: true } } },
    orderBy: { nombre: 'asc' },
  });
  return rows.map(({ _count, ...c }) => ({ ...c, usos: _count.perfumes }));
};

/**
 * Borra la categoría mudando antes sus perfumes a `destinoId`.
 * Va en una transacción: si la mudanza falla, la categoría no se borra y nadie
 * queda huérfano. Sin destino solo se permite si no la usa ningún perfume.
 */
export const deleteCategoriaConMudanza = async (id: number, destinoId: number | null) => {
  const usos = await prisma.perfume.count({ where: { categoria_id: id } });
  if (usos > 0 && destinoId == null) {
    throw new Error(
      `${usos} perfume(s) usan esta categoría. Elige a cuál moverlos antes de eliminarla.`,
    );
  }
  if (destinoId === id) throw new Error('No puedes mover los perfumes a la categoría que vas a eliminar.');
  return prisma.$transaction(async (tx) => {
    if (usos > 0 && destinoId != null) {
      const destino = await tx.categoria.findUnique({ where: { id: destinoId } });
      if (!destino) throw new Error('La categoría de destino ya no existe.');
      await tx.perfume.updateMany({ where: { categoria_id: id }, data: { categoria_id: destinoId } });
    }
    await tx.categoria.delete({ where: { id } });
    return { movidos: destinoId != null ? usos : 0 };
  });
};

export const createCategoria = async (nombre: string) => {
  const row = await prisma.categoria.create({ data: { nombre } });
  return row.id;
};

export const deleteCategoria = (id: string) =>
  prisma.categoria.delete({ where: { id: Number(id) } });

export const updateCategoria = (id: string, nombre: string) =>
  prisma.categoria.update({ where: { id: Number(id) }, data: { nombre } });

// ── Presentaciones ─────────────────────────────────────────────────────────

export const getAllPresentaciones = () =>
  prisma.presentacion.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } });

export const createPresentacion = async (nombre: string) => {
  const row = await prisma.presentacion.create({ data: { nombre } });
  return row.id;
};

export const deletePresentacion = (id: string) =>
  prisma.presentacion.delete({ where: { id: Number(id) } });

export const updatePresentacion = (id: string, nombre: string) =>
  prisma.presentacion.update({ where: { id: Number(id) }, data: { nombre } });

/**
 * Propone qué esencia le corresponde a cada perfume, SIN aplicar nada.
 *
 * Nace de cómo el dueño cargó sus datos: cada esencia se llama
 * "‹Fragancia› – Esencia", así que el nombre ya dice a qué perfume pertenece.
 * Enlazarlas a mano serían 200+ visitas.
 *
 * Usa el MISMO matcher que las ventas, que es conservador a propósito: si un
 * nombre encaja con dos perfumes, no elige — prefiere dejarlo sin enlazar a
 * enlazarlo mal, porque un enlace equivocado descuenta la esencia de otro y el
 * costo sale falso sin que nadie lo note.
 *
 * Solo mira perfumes fabricados que AÚN no tienen esencia: nunca pisa una
 * asignación hecha a mano.
 */
export const sugerirEsencias = async () => {
  const [perfumes, esencias] = await Promise.all([
    prisma.perfume.findMany({
      where: { tipo_producto: 'fabricado', insumo_esencia_id: null },
      select: { id: true, nombre: true },
    }),
    prisma.insumoCosto.findMany({
      where: { tipo: 'materia_prima', activo: true },
      select: { id: true, nombre: true },
    }),
  ]);

  const index = buildPerfumeIndex(perfumes);
  const enlaces: { perfume_id: number; perfume: string; insumo_id: number; esencia: string }[] = [];
  const yaPropuesto = new Set<number>();

  for (const e of esencias) {
    // El nombre de la esencia lleva el del perfume delante del separador
    const corto = e.nombre.split(' – ')[0].split(' - ')[0].trim();
    if (!corto || corto.length < 3) continue;
    const perfumeId = matchPerfume(corto, index);
    if (!perfumeId || yaPropuesto.has(perfumeId)) continue;
    yaPropuesto.add(perfumeId);
    enlaces.push({
      perfume_id: perfumeId,
      perfume: perfumes.find((p) => p.id === perfumeId)!.nombre,
      insumo_id: e.id,
      esencia: e.nombre,
    });
  }

  return {
    enlaces: enlaces.sort((a, b) => a.perfume.localeCompare(b.perfume)),
    // Los que habrá que poner a mano después
    sin_sugerencia: perfumes.filter((p) => !yaPropuesto.has(p.id)).length,
    perfumes_pendientes: perfumes.length,
  };
};

/**
 * Aplica una lista de enlaces perfume→esencia de una sola vez.
 *
 * Se valida que cada insumo sea materia prima: apuntar un perfume a un envase
 * daría un costo por ml sin sentido.
 */
export const aplicarEnlacesEsencia = async (
  enlaces: { perfume_id: number; insumo_esencia_id: number }[],
) => {
  const ids = [...new Set(enlaces.map((e) => e.insumo_esencia_id))];
  const validos = await prisma.insumoCosto.findMany({
    where: { id: { in: ids }, tipo: 'materia_prima' },
    select: { id: true },
  });
  const permitidos = new Set(validos.map((v) => v.id));
  const malos = ids.filter((id) => !permitidos.has(id));
  if (malos.length > 0) {
    throw badRequest(`${malos.length} de los insumos elegidos no son materia prima`);
  }

  return prisma.$transaction(async (tx) => {
    let count = 0;
    for (const e of enlaces) {
      const r = await tx.perfume.updateMany({
        // Solo si sigue sin esencia: si alguien la puso mientras revisabas la
        // vista previa, su decisión manda sobre la sugerencia automática.
        where: { id: e.perfume_id, insumo_esencia_id: null },
        data: { insumo_esencia_id: e.insumo_esencia_id },
      });
      count += r.count;
    }
    return count;
  });
};
