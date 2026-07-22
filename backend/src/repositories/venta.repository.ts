import { prisma } from '../config/prisma';
import { CreateVentaDTO } from '../types/venta.type';
import { paginatedResponse } from '../utils/pagination';
import { agruparEnlaces, buildPerfumeIndex, matchPerfumes } from '../utils/perfumeMatcher';
import { aplicarCodigoAVenta, liberarCodigoDeVenta, validarCodigoParaVenta } from '../services/anuncio.service';

const includeRel = {
  user: { select: { id: true, nombre: true, apellido: true, telefono: true, email: true } },
  perfumes: { include: { perfume: { select: { id: true, nombre: true } } } },
  codigo: { include: { anuncio: { select: { titulo: true, descuento_pct: true } } } },
} as const;

const mapVenta = (v: any) => ({
  id:                 v.id,
  dia:                v.dia,
  persona:            v.persona,
  user_id:            v.user_id ?? null,
  user:               v.user
    ? { id: v.user.id, nombre: v.user.nombre, apellido: v.user.apellido, telefono: v.user.telefono ?? null, email: v.user.email }
    : null,
  cantidad_perfumes:  v.cantidad_perfumes,
  presentacion:       v.presentacion,
  referencia_perfume: v.referencia_perfume,
  // Una venta de combo puede llevar varios perfumes del catálogo enlazados
  perfumes:           (v.perfumes ?? []).map((vp: any) => ({ id: vp.perfume.id, nombre: vp.perfume.nombre, cantidad: vp.cantidad ?? 1 })),
  valor_venta:        Number(v.valor_venta),
  datos_adicionales:  v.datos_adicionales ?? null,
  pagada:             v.pagada,
  codigo:             v.codigo
    ? {
        codigo: v.codigo.codigo,
        estado: v.codigo.estado,
        titulo: v.codigo.anuncio?.titulo ?? '',
        descuento_pct: v.codigo.anuncio?.descuento_pct ?? 0,
      }
    : null,
  created_at:         v.created_at,
});

export const getAllVentas = async (page: number, limit: number, search?: string) => {
  const skip = (page - 1) * limit;
  const where = search
    ? {
        OR: [
          { persona: { contains: search } },
          { referencia_perfume: { contains: search } },
          { presentacion: { contains: search } },
          { datos_adicionales: { contains: search } },
          { user: { nombre: { contains: search } } },
          { user: { apellido: { contains: search } } },
          { user: { telefono: { contains: search } } },
        ],
      }
    : undefined;
  const [rows, total] = await Promise.all([
    prisma.venta.findMany({ where, skip, take: limit, orderBy: { dia: 'desc' }, include: includeRel }),
    prisma.venta.count({ where }),
  ]);
  return paginatedResponse(rows.map(mapVenta), total, page, limit);
};

/**
 * La referencia visible se construye con los nombres reales del catálogo.
 * Un id repetido significa varias unidades de la misma fragancia ("2× Eros").
 */
const referenciaFromIds = async (perfumeIds: number[]) => {
  const enlaces = agruparEnlaces(perfumeIds);
  const perfumes = await prisma.perfume.findMany({
    where: { id: { in: enlaces.map((e) => e.perfume_id) } },
    select: { id: true, nombre: true },
  });
  if (perfumes.length !== enlaces.length) {
    throw new Error('Alguno de los perfumes seleccionados ya no existe en el catálogo');
  }
  const nombreById = new Map(perfumes.map((p) => [p.id, p.nombre]));
  return enlaces
    .map((e) => (e.cantidad > 1 ? `${e.cantidad}× ${nombreById.get(e.perfume_id)}` : nombreById.get(e.perfume_id)))
    .join(', ');
};

export const createVenta = async (data: CreateVentaDTO) => {
  const referencia = await referenciaFromIds(data.perfume_ids);
  const pagada = data.pagada ?? true;
  const codigo = data.codigo_descuento?.trim() || null;
  // Validar el código ANTES de crear para no dejar una venta a medias
  if (codigo) await validarCodigoParaVenta(codigo, null);
  const row = await prisma.venta.create({
    data: {
      dia:                new Date(data.dia),
      persona:            data.persona,
      user_id:            data.user_id ?? null,
      cantidad_perfumes:  data.cantidad_perfumes,
      presentacion:       data.presentacion,
      referencia_perfume: referencia,
      perfumes:           { create: agruparEnlaces(data.perfume_ids) },
      valor_venta:        data.valor_venta,
      datos_adicionales:  data.datos_adicionales ?? null,
      pagada,
    },
    include: includeRel,
  });
  if (codigo) {
    await aplicarCodigoAVenta(codigo, row.id, pagada);
    return mapVenta(await prisma.venta.findUnique({ where: { id: row.id }, include: includeRel }));
  }
  return mapVenta(row);
};

export const updateVenta = async (id: string, data: CreateVentaDTO) => {
  const referencia = await referenciaFromIds(data.perfume_ids);
  const ventaId = Number(id);
  const pagada = data.pagada ?? true;
  const codigo = data.codigo_descuento?.trim() || null;
  if (codigo) await validarCodigoParaVenta(codigo, ventaId);
  await prisma.venta.update({
    where: { id: ventaId },
    data: {
      dia:                new Date(data.dia),
      persona:            data.persona,
      user_id:            data.user_id ?? null,
      cantidad_perfumes:  data.cantidad_perfumes,
      presentacion:       data.presentacion,
      referencia_perfume: referencia,
      perfumes:           { deleteMany: {}, create: agruparEnlaces(data.perfume_ids) },
      valor_venta:        data.valor_venta,
      datos_adicionales:  data.datos_adicionales ?? null,
      pagada,
    },
  });
  // Si el código cambió o se quitó, el anterior vuelve a quedar activo
  await liberarCodigoDeVenta(ventaId, codigo);
  if (codigo) await aplicarCodigoAVenta(codigo, ventaId, pagada);
  return mapVenta(await prisma.venta.findUnique({ where: { id: ventaId }, include: includeRel }));
};

/**
 * Reintenta el enlace venta→perfumes de las ventas importadas sin ningún
 * enlace (la referencia libre del Excel se compara contra el catálogo).
 */
export const relinkVentasPerfume = async () => {
  const [perfumes, ventas] = await Promise.all([
    prisma.perfume.findMany({ select: { id: true, nombre: true } }),
    prisma.venta.findMany({
      where: { perfumes: { none: {} } },
      select: { id: true, referencia_perfume: true },
    }),
  ]);
  const index = buildPerfumeIndex(perfumes);
  let enlazadas = 0;
  for (const v of ventas) {
    const ids = matchPerfumes(v.referencia_perfume, index);
    if (ids.length) {
      await prisma.ventaPerfume.createMany({
        data: agruparEnlaces(ids).map((e) => ({ venta_id: v.id, ...e })),
        skipDuplicates: true,
      });
      enlazadas++;
    }
  }
  return { revisadas: ventas.length, enlazadas };
};

export const deleteVenta = async (id: string) => {
  // El código enlazado vuelve a estar activo: la venta ya no existe
  await liberarCodigoDeVenta(Number(id));
  return prisma.venta.delete({ where: { id: Number(id) } });
};

export const getVentaTotales = async () => {
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  // Ingresos del mes = plata que entró de verdad este mes:
  //  - ventas de contado (sin crédito enlazado) pagadas, por su fecha de venta
  //  - abonos de créditos, por su fecha de abono (así el crédito de un mes
  //    pagado al siguiente cuenta en el mes en que se recibió el dinero)
  // La venta enlazada a un crédito NUNCA suma aquí: su plata entra vía abonos.
  const [agg, contadoMes, abonosMes] = await Promise.all([
    prisma.venta.aggregate({ _sum: { cantidad_perfumes: true, valor_venta: true } }),
    prisma.venta.aggregate({
      _sum: { valor_venta: true },
      where: { pagada: true, credito: null, dia: { gte: inicioMes } },
    }),
    prisma.creditoAbono.aggregate({
      _sum: { monto: true },
      where: { fecha: { gte: inicioMes } },
    }),
  ]);
  const abonos = Number(abonosMes._sum.monto ?? 0);
  return {
    total_unidades: agg._sum.cantidad_perfumes ?? 0,
    total_dinero:   Number(agg._sum.valor_venta ?? 0),
    ingresos_mes:   Number(contadoMes._sum.valor_venta ?? 0) + abonos,
    abonos_mes:     abonos,
  };
};
