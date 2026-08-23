import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { paginatedResponse } from '../utils/pagination';
import type { CotizacionInput } from '../schemas/cotizacion.schema';

/**
 * Cotizaciones mayoristas. Los totales y el desglose de costos llegan ya
 * calculados del frontend (motor `costeoCotizacion.ts`) y se guardan tal cual:
 * congelar las cifras evita que una cotización vieja cambie de rentabilidad
 * cuando mañana suba el precio de un insumo (mismo criterio que los créditos).
 */

const num = (v: unknown) => Number(v);

const incluirItems = {
  items: {
    orderBy: { orden: 'asc' as const },
    include: { perfume: { select: { imagen_url: true } } },
  },
} as const;

/** Las filas tal como las trae la consulta de arriba; no se escriben a mano. */
type CotizacionRow = Prisma.CotizacionGetPayload<{ include: typeof incluirItems }>;
type ItemRow = CotizacionRow['items'][number];

const mapItem = (i: ItemRow) => ({
  id: i.id,
  perfume_id: i.perfume_id,
  perfume_nombre: i.perfume_nombre,
  perfume_imagen: i.perfume?.imagen_url ?? null,
  formula_volumen_id: i.formula_volumen_id,
  volumen_nombre: i.volumen_nombre,
  cantidad: i.cantidad,
  accesorios_seleccionados: i.accesorios_seleccionados ?? [],
  desglose_costo: i.desglose_costo ?? {},
  precio_unitario: num(i.precio_unitario),
  subtotal: num(i.subtotal),
  orden: i.orden,
});

const mapCotizacion = (c: CotizacionRow) => ({
  id: c.id,
  numero: c.numero,
  tipo: c.tipo,
  lista_precios: c.lista_precios ?? null,
  extras_pedido: c.extras_pedido ?? [],
  cliente_nombre: c.cliente_nombre,
  cliente_empresa: c.cliente_empresa,
  cliente_telefono: c.cliente_telefono,
  cliente_email: c.cliente_email,
  cliente_nit: c.cliente_nit,
  plantilla_id: c.plantilla_id,
  subtotal: num(c.subtotal),
  descuento_pct: num(c.descuento_pct),
  total: num(c.total),
  vigencia_dias: c.vigencia_dias,
  fecha_vigencia: c.fecha_vigencia,
  condiciones_comerciales: c.condiciones_comerciales ?? {},
  observaciones: c.observaciones,
  estado: c.estado,
  fecha: c.created_at,
  items: (c.items ?? []).map(mapItem),
});

/** Consecutivo legible por año: COT-2026-0007. */
const siguienteNumero = async () => {
  const anio = new Date().getFullYear();
  const prefijo = `COT-${anio}-`;
  const ultima = await prisma.cotizacion.findFirst({
    where: { numero: { startsWith: prefijo } },
    orderBy: { numero: 'desc' },
    select: { numero: true },
  });
  const consecutivo = ultima ? Number(ultima.numero.slice(prefijo.length)) + 1 : 1;
  return `${prefijo}${String(consecutivo).padStart(4, '0')}`;
};

/** Totales del encabezado a partir de las líneas (nunca se confía en el cliente). */
const calcularTotales = (items: CotizacionInput['items'], descuentoPct: number) => {
  const subtotal = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  const total = Math.round(subtotal * (1 - descuentoPct / 100));
  return { subtotal: Math.round(subtotal), total };
};

const filasItems = (items: CotizacionInput['items']) =>
  items.map((i, idx) => ({
    perfume_id: i.perfume_id,
    perfume_nombre: i.perfume_nombre,
    formula_volumen_id: i.formula_volumen_id,
    volumen_nombre: i.volumen_nombre,
    cantidad: i.cantidad,
    accesorios_seleccionados: i.accesorios_seleccionados,
    desglose_costo: i.desglose_costo,
    precio_unitario: i.precio_unitario,
    subtotal: i.cantidad * i.precio_unitario,
    orden: idx,
  }));

export const listarCotizaciones = async (page: number, limit: number, search?: string) => {
  const where = search
    ? {
        OR: [
          { numero: { contains: search } },
          { cliente_nombre: { contains: search } },
          { cliente_empresa: { contains: search } },
        ],
      }
    : undefined;
  const [rows, total] = await Promise.all([
    prisma.cotizacion.findMany({
      where, skip: (page - 1) * limit, take: limit,
      orderBy: { created_at: 'desc' },
      include: incluirItems,
    }),
    prisma.cotizacion.count({ where }),
  ]);
  return paginatedResponse(rows.map(mapCotizacion), total, page, limit);
};

export const obtenerCotizacion = async (id: number) => {
  const row = await prisma.cotizacion.findUnique({ where: { id }, include: incluirItems });
  return row ? mapCotizacion(row) : null;
};

export const crearCotizacion = async (data: CotizacionInput) => {
  const { subtotal, total } = calcularTotales(data.items, data.descuento_pct);
  const fechaVigencia = new Date();
  fechaVigencia.setDate(fechaVigencia.getDate() + data.vigencia_dias);

  const row = await prisma.cotizacion.create({
    data: {
      numero: await siguienteNumero(),
      tipo: data.tipo,
      lista_precios: data.lista_precios ?? undefined,
      extras_pedido: data.extras_pedido ?? [],
      cliente_nombre: data.cliente_nombre,
      cliente_empresa: data.cliente_empresa ?? null,
      cliente_telefono: data.cliente_telefono ?? null,
      cliente_email: data.cliente_email ?? null,
      cliente_nit: data.cliente_nit ?? null,
      plantilla_id: data.plantilla_id ?? null,
      subtotal,
      descuento_pct: data.descuento_pct,
      total,
      vigencia_dias: data.vigencia_dias,
      fecha_vigencia: fechaVigencia,
      condiciones_comerciales: data.condiciones_comerciales,
      observaciones: data.observaciones ?? null,
      estado: data.estado ?? 'borrador',
      items: { create: filasItems(data.items) },
    },
    include: incluirItems,
  });
  return mapCotizacion(row);
};

/** Editar reemplaza las líneas por completo (más simple y sin estados a medias). */
export const actualizarCotizacion = async (id: number, data: CotizacionInput) => {
  const { subtotal, total } = calcularTotales(data.items, data.descuento_pct);
  const fechaVigencia = new Date();
  fechaVigencia.setDate(fechaVigencia.getDate() + data.vigencia_dias);

  await prisma.$transaction([
    prisma.cotizacionItem.deleteMany({ where: { cotizacion_id: id } }),
    prisma.cotizacion.update({
      where: { id },
      data: {
        tipo: data.tipo,
        lista_precios: data.lista_precios ?? undefined,
        extras_pedido: data.extras_pedido ?? [],
        cliente_nombre: data.cliente_nombre,
        cliente_empresa: data.cliente_empresa ?? null,
        cliente_telefono: data.cliente_telefono ?? null,
        cliente_email: data.cliente_email ?? null,
        cliente_nit: data.cliente_nit ?? null,
        plantilla_id: data.plantilla_id ?? null,
        subtotal,
        descuento_pct: data.descuento_pct,
        total,
        vigencia_dias: data.vigencia_dias,
        fecha_vigencia: fechaVigencia,
        condiciones_comerciales: data.condiciones_comerciales,
        observaciones: data.observaciones ?? null,
        ...(data.estado ? { estado: data.estado } : {}),
        items: { create: filasItems(data.items) },
      },
    }),
  ]);
  return obtenerCotizacion(id);
};

/**
 * El `include` NO es adorno: sin él la respuesta salía con `items: []` —el
 * mapeador rellenaba el hueco— y la pantalla se quedaba con una cotización sin
 * líneas al marcarla como enviada. Se veía como "se borraron los productos".
 */
export const marcarEstado = (id: number, estado: 'borrador' | 'enviada') =>
  prisma.cotizacion.update({ where: { id }, data: { estado }, include: incluirItems })
    .then(mapCotizacion);

export const eliminarCotizacion = (id: number) => prisma.cotizacion.delete({ where: { id } });
