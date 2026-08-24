import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';
import { CreatePerfumeDTO } from '../types/perfume.type';
import { paginatedResponse } from '../utils/pagination';
import { toSlug } from '../utils/slug';
import { borrarImagenSiCambio, borrarImagenSubida } from '../utils/imagenes';
import { resumenRatings } from './resena.repository';
import { badRequest } from '../utils/httpError';
import { filtroEnum, filtroNumero, filtroTexto, type MapaFiltros } from '../utils/filtros';
// Cómo se lee un perfume (precio efectivo, agotado, frascos armados) vive en su
// propio archivo: aquí solo se consulta y se escribe.
import { mapPerfume, perfumeInclude, NUEVO_DIAS } from './perfume.mapeo';

/**
 * Este archivo es SOLO el perfume: consultarlo, crearlo y editarlo. Lo que colgaba de él y no era eso ya se fue a su sitio:
 *
 * - `perfume.mapeo.ts` — cómo se LEE (precio en cascada, agotado, armados).
 * - `clasificacion.repository.ts` — aromas, ocasiones, categorías y tallas.
 * - `precio.repository.ts` — la lista de precios por categoría × talla.
 * - `emparejarEsencias.repository.ts` — qué esencia le toca a cada perfume.
 *
 * Se partió en dos tandas por la misma razón: iba en 912 líneas y luego en 713,
 * y un archivo así nadie lo lee entero — se le agrega al final y las reglas
 * terminan repetidas.
 */

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

/**
 * LAS DOS FAMILIAS DEL DASHBOARD.
 *
 * Una sola pregunta decide de qué lado cae cada ficha: ¿existe ANTES de que lo
 * vendas, o se fabrica en el momento de venderlo? Es una regla que el sistema
 * evalúa solo, no una lista que el dueño mantenga a mano — el día que se marque
 * un producto mal, la lista no avisa; la regla sí.
 *
 * Ojo: el 212 VIP Black con frascos armados NO es "productos". Es un fabricado
 * que casualmente tiene stock, y se queda en Perfumes. Se descartó a propósito
 * el criterio "lo que tenga unidades hoy": un producto que entra y sale de una
 * pantalla según el stock es de lo que más confunde con el tiempo.
 */
export type FamiliaProducto = 'fabricadas' | 'productos';

const ES_PRODUCTO: Prisma.PerfumeWhereInput = {
  OR: [{ solo_armado: true }, { tipo_producto: 'comprado' }],
};

export const WHERE_FAMILIA: Record<FamiliaProducto, Prisma.PerfumeWhereInput> = {
  productos: ES_PRODUCTO,
  // Perfumes es el COMPLEMENTO EXACTO, no una segunda lista: dos listas paralelas
  // se desincronizan el día que el enum crezca, y lo que caiga en el hueco
  // desaparece de las dos pestañas sin avisar. Pasó en la primera versión con
  // `fraccionado`. Un decant va aquí porque no existe antes de venderse: se corta
  // de la botella grande en el momento de la venta (ver inventario.consumoVenta.ts).
  fabricadas: { NOT: ES_PRODUCTO },
};

export const esFamilia = (v: string): v is FamiliaProducto =>
  Object.prototype.hasOwnProperty.call(WHERE_FAMILIA, v);

/**
 * Columnas filtrables de la tabla de Perfumes del dashboard. "Estado" no está:
 * combina publicado/agotado/`faltaParaVender` en el navegador (`columns.tsx`),
 * y esa regla no tiene traducción directa a un `WHERE` — queda `filterable:
 * false` en la columna, a propósito, para no ofrecer un embudo que no filtra.
 */
export const mapaFiltrosPerfumes: MapaFiltros = {
  nombre: filtroTexto('nombre'),
  precio: filtroNumero('precio'),
  genero: filtroEnum('genero'),
  categoria: (f) => (f.type === 'string' && f.value.trim()
    ? { categoria: { nombre: { contains: f.value.trim() } } } : null),
  tipos_aroma: (f) => (f.type === 'string' && f.value.trim()
    ? { tipos_aroma: { some: { tipo_aroma: { nombre: { contains: f.value.trim() } } } } } : null),
  duracion: filtroTexto('duracion'),
};

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

/**
 * ¿El `?sort=` que llegó por la URL es un orden que existe?
 *
 * La lista de órdenes válidos sale del mapa de aquí arriba, no de una copia en
 * el controlador: eran dos listas que había que acordarse de mover a la vez.
 * Se usa `hasOwnProperty` y no `in` porque `'toString' in ORDEN_CATALOGO` es
 * verdadero —lo hereda del prototipo— y colaría un orden que no existe.
 */
export const esOrdenCatalogo = (v: string): v is OrdenCatalogo =>
  Object.prototype.hasOwnProperty.call(ORDEN_CATALOGO, v);

export const selectParfumsPaginated = async (
  page: number,
  limit: number,
  search?: string,
  filtros?: CatalogoFiltros,
  /** Solo el dashboard: incluir también los que están fuera de la tienda. */
  todos = false,
  /** Filtros de columna de la tabla del dashboard (ver `mapaFiltrosPerfumes`). */
  columnasAnd?: object[],
  /** Solo el dashboard: parte el catálogo en Perfumes / Productos. */
  familia?: FamiliaProducto,
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
  if (columnasAnd?.length) and.push(...(columnasAnd as Prisma.PerfumeWhereInput[]));
  if (familia) and.push(WHERE_FAMILIA[familia]);
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
      solo_armado: data.solo_armado ?? false,
      es_accesorio: data.es_accesorio ?? false,
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

  /**
   * Las tallas se SINCRONIZAN, no se borran y se vuelven a crear.
   *
   * Esa fila ya no es solo un precio: lleva los **frascos armados** y su costo
   * congelado. Rehacerla en cada guardado hacía que cambiarle la descripción a
   * un perfume borrara los frascos que hay en la caja, sin avisar y sin dejar
   * rastro. Ahora la que sigue se actualiza y conserva su stock.
   */
  const enlaces = enlacesPresentacion(data);
  const quedan = enlaces.map((e) => e.presentacion_id);
  const seVan = await prisma.perfumePresentacion.findMany({
    where: { perfume_id: numId, presentacion_id: { notIn: quedan } },
    include: { presentacion: { select: { nombre: true } } },
  });
  // Quitar una talla que todavía tiene frascos armados se rechaza: primero se
  // venden o se ajustan. Dejarlo pasar tiraría a la basura producto que existe.
  const conArmados = seVan.filter((r) => Number(r.stock) !== 0);
  if (conArmados.length) {
    const detalle = conArmados
      .map((r) => `${r.presentacion.nombre} (${Number(r.stock)})`)
      .join(', ');
    throw badRequest(
      `No puedes quitar esta talla: todavía hay frascos armados en ${detalle}. `
      + 'Véndelos o ajústalos en Inventario y vuelve a guardar.',
    );
  }

  await prisma.$transaction([
    prisma.perfumeTipoAroma.deleteMany({ where: { perfume_id: numId } }),
    prisma.perfumeOcasion.deleteMany({ where: { perfume_id: numId } }),
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
        ...(data.solo_armado !== undefined ? { solo_armado: data.solo_armado } : {}),
        ...(data.es_accesorio !== undefined ? { es_accesorio: data.es_accesorio } : {}),
        tipos_aroma: {
          create: (data.tipos_aroma ?? []).map((tid) => ({ tipo_aroma_id: tid })),
        },
        ocasiones: {
          create: (data.ocasiones ?? []).map((oid) => ({ ocasion_id: oid })),
        },
        presentaciones: {
          deleteMany: { presentacion_id: { notIn: quedan } },
          upsert: enlaces.map((e) => ({
            where: { perfume_id_presentacion_id: { perfume_id: numId, presentacion_id: e.presentacion_id } },
            create: e,
            // Se toca solo lo que el formulario manda; `stock` y `costo_promedio`
            // ni se mencionan, que es justo lo que los deja intactos.
            update: {
              precio: e.precio,
              envase_insumo_id: e.envase_insumo_id,
              accesorios: e.accesorios ?? Prisma.DbNull,
            },
          })),
        },
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
