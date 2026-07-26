import { prisma } from '../config/prisma';
import { Prisma } from '../generated/prisma';
import { CreatePerfumeDTO } from '../types/perfume.type';
import { paginatedResponse } from '../utils/pagination';
import { toSlug } from '../utils/slug';
import { borrarImagenSiCambio, borrarImagenSubida } from '../utils/imagenes';
import { resumenRatings } from './resena.repository';

type PerfumeRow = Prisma.PerfumeGetPayload<{
  include: {
    categoria:      { include: { precios: true } };
    tipos_aroma:    { include: { tipo_aroma: true } };
    ocasiones:      { include: { ocasion: true } };
    presentaciones: { include: { presentacion: true } };
  };
}>;

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
    precio: Number(r.precio ?? lista.get(r.presentacion_id) ?? p.precio),
    /** true = ese precio es exclusivo del perfume, no viene de la lista */
    propio: r.precio != null,
  }));
};

export const mapPerfume = (p: PerfumeRow) => {
  const precios = resolverPrecios(p);
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
    agotado:      p.agotado,
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
  presentaciones: { include: { presentacion: true } },
} as const;

/** Rellena el promedio/total de reseñas aprobadas de una lista ya mapeada. */
export const conRatings = async <T extends { id: number }>(perfumes: T[]): Promise<T[]> => {
  const resumen = await resumenRatings(perfumes.map((p) => p.id));
  return perfumes.map((p) => {
    const r = resumen.get(p.id);
    return r ? { ...p, rating_promedio: r.promedio, rating_total: r.total } : p;
  });
};

export const selectAllParfums = async () => {
  const perfumes = await prisma.perfume.findMany({
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
) => {
  const skip = (page - 1) * limit;
  const and: Prisma.PerfumeWhereInput[] = [];
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
  const rows = await prisma.perfume.findMany({ where: { id: { in: ids } }, include: perfumeInclude });
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
  return (data.presentaciones ?? []).map((id) => ({
    presentacion_id: id,
    precio: propios.get(id) ?? null,
  }));
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
      esencia_premium:  data.esencia_premium ?? false,
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
        // El form de edición no envía descuento/agotado: no hay que resetearlos
        ...(data.descuento !== undefined ? { descuento: data.descuento } : {}),
        ...(data.agotado !== undefined ? { agotado: data.agotado } : {}),
        ...(data.esencia_premium !== undefined ? { esencia_premium: data.esencia_premium } : {}),
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
    where: { created_at: { gte: desde } },
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
  const topRows = topIds.length
    ? await prisma.perfume.findMany({ where: { id: { in: topIds } }, include: perfumeInclude })
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
  const nombres = await prisma.perfume.findMany({ select: { id: true, nombre: true } });
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

export const getAllCategorias = () =>
  prisma.categoria.findMany({
    select: { id: true, nombre: true, descuento: true },
    orderBy: { nombre: 'asc' },
  });

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
