import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { CreatePagoDTO } from '../types/pago.type';
import { paginatedResponse } from '../utils/pagination';
import {
  aBase, aplicarMovimiento, costosConFlete, desglosarIva, revertirMovimientos,
  type IvaCompra, type IvaModo,
} from './inventario.repository';
import { sanearUploadsConservados } from '../utils/uploadsUrl';

const includeEmpresa = {
  empresa: true,
  items: { include: { insumo: { select: { nombre: true, unidad: true } } } },
} as const;

const mapPago = (p: any) => ({
  id:    p.id,
  dia:   p.dia,
  empresa: {
    id:        p.empresa.id,
    nombre:    p.empresa.nombre,
    nit:       p.empresa.nit ?? null,
    telefono:  p.empresa.telefono ?? null,
    correo:    p.empresa.correo ?? null,
    direccion: p.empresa.direccion ?? null,
  },
  valor_compra:         Number(p.valor_compra),
  coste_envio:          Number(p.coste_envio),
  detalles_adicionales: p.detalles_adicionales ?? null,
  numero_factura:       p.numero_factura ?? null,
  archivos:             (p.archivos as string[] | null) ?? [],
  // Congelados al registrar: null en los pagos históricos, que no llevan detalle
  iva_modo:             p.iva_modo ?? null,
  iva_tasa:             p.iva_tasa != null ? Number(p.iva_tasa) : null,
  iva_valor:            Number(p.iva_valor ?? 0),
  items: (p.items ?? []).map((i: any) => ({
    id: i.id,
    insumo_id: i.insumo_id,
    insumo_nombre: i.insumo?.nombre ?? '',
    cantidad: Number(i.cantidad),
    unidad_compra: i.unidad_compra,
    subtotal: Number(i.subtotal),
    costo_unitario_final: Number(i.costo_unitario_final),
    base_gravable: i.base_gravable != null ? Number(i.base_gravable) : null,
    iva_valor: i.iva_valor != null ? Number(i.iva_valor) : null,
  })),
  created_at:           p.created_at,
});

/**
 * Listado paginado y, **si se piden, sus totales en la misma respuesta**.
 *
 * Mismo criterio que en ventas: la pantalla pinta lista y totales a la vez, y
 * pedirlos por separado son dos viajes al servidor para lo mismo. Aquí salen
 * en paralelo dentro del mismo `Promise.all`. Bajo petición, para que quien
 * solo quiera la lista no pague la agregación.
 */
export const getAllPagos = async (
  page: number, limit: number, search?: string, conTotales = false,
) => {
  const skip = (page - 1) * limit;
  const where = search
    ? {
        OR: [
          { detalles_adicionales: { contains: search } },
          { empresa: { nombre: { contains: search } } },
          { empresa: { nit: { contains: search } } },
        ],
      }
    : undefined;
  const [rows, total, totales] = await Promise.all([
    prisma.pagoProveedor.findMany({ where, skip, take: limit, orderBy: { dia: 'desc' }, include: includeEmpresa }),
    prisma.pagoProveedor.count({ where }),
    conTotales ? getPagoTotales() : undefined,
  ]);
  return {
    ...paginatedResponse(rows.map(mapPago), total, page, limit),
    ...(totales ? { totales } : {}),
  };
};

/** Campos de cabecera comunes a crear y editar. */
const cabecera = (data: CreatePagoDTO, baseUrl: string) => ({
  dia:                  new Date(data.dia),
  empresa_id:           data.empresa_id,
  valor_compra:         data.valor_compra,
  coste_envio:          data.coste_envio ?? 0,
  detalles_adicionales: data.detalles_adicionales ?? null,
  numero_factura:       data.numero_factura ?? null,
  // Solo se aceptan archivos de NUESTRO /uploads (nada externo inyectado)
  archivos:             sanearUploadsConservados(data.archivos ?? [], baseUrl, true),
});

/** IVA total de la factura, congelado junto con el modo y la tasa aplicados. */
const ivaCabecera = (data: CreatePagoDTO, iva: IvaCompra) => {
  const total = (data.items ?? []).reduce(
    (s, it) => s + desglosarIva(it.subtotal, iva.modo, iva.tasa).iva, 0);
  return { iva_modo: iva.modo, iva_tasa: iva.tasa, iva_valor: Math.round(total * 100) / 100 };
};

/**
 * Cómo se liquida el IVA de esta compra.
 *
 * Sale del proveedor (se configura una vez) y la factura puede corregirlo. La
 * tasa y el modo se CONGELAN en el pago: cambiarle el modo al proveedor mañana
 * no debe reescribir una compra de marzo.
 */
const resolverIva = async (
  tx: Prisma.TransactionClient, data: CreatePagoDTO,
): Promise<IvaCompra> => {
  const [empresa, config] = await Promise.all([
    tx.empresa.findUnique({ where: { id: data.empresa_id }, select: { iva_modo: true } }),
    tx.negocioConfig.findFirst(),
  ]);
  return {
    modo: (data.iva_modo ?? empresa?.iva_modo ?? 'incluido') as IvaModo,
    tasa: data.iva_tasa ?? Number(config?.iva_tasa ?? 0.19),
    descontable: config?.responsable_iva ?? false,
  };
};

/**
 * Crea las líneas de la compra y mete el material al inventario.
 * El flete y el IVA se reparten proporcional entre las líneas antes de valorar
 * la entrada: los dos son parte de lo que costó el material.
 */
const registrarItems = async (
  tx: Prisma.TransactionClient, pagoId: number, data: CreatePagoDTO, iva: IvaCompra,
) => {
  const items = data.items ?? [];
  if (items.length === 0) return;
  const costos = costosConFlete(items, data.coste_envio ?? 0, iva);
  const fecha = new Date(data.dia);

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    // Se guarda el desglose aunque hoy no se descuente: sin base y valor por
    // línea no se puede declarar ni, más adelante, facturar electrónicamente.
    const d = desglosarIva(it.subtotal, iva.modo, iva.tasa);
    await tx.compraItem.create({
      data: {
        pago_id: pagoId,
        insumo_id: it.insumo_id,
        cantidad: it.cantidad,
        unidad_compra: it.unidad_compra,
        subtotal: it.subtotal,
        costo_unitario_final: costos[i],
        base_gravable: d.base,
        iva_valor: d.iva,
      },
    });
    await aplicarMovimiento(tx, {
      insumo_id: it.insumo_id,
      tipo: 'compra',
      // Al inventario entra en la unidad base: 20 L de alcohol son 20.000 ml
      cantidad: aBase(it.cantidad, it.unidad_compra),
      costo_unitario: costos[i],
      fecha,
      referencia_id: pagoId,
      nota: data.numero_factura ? `Factura ${data.numero_factura}` : null,
    });
  }
};

export const createPago = async (data: CreatePagoDTO, baseUrl: string) => {
  const row = await prisma.$transaction(async (tx) => {
    const iva = await resolverIva(tx, data);
    const creado = await tx.pagoProveedor.create({
      data: { ...cabecera(data, baseUrl), ...ivaCabecera(data, iva) },
    });
    await registrarItems(tx, creado.id, data, iva);
    return tx.pagoProveedor.findUniqueOrThrow({ where: { id: creado.id }, include: includeEmpresa });
  });
  return mapPago(row);
};

export const updatePago = async (id: string, data: CreatePagoDTO, baseUrl: string) => {
  const pagoId = Number(id);
  const row = await prisma.$transaction(async (tx) => {
    // Se deshace el movimiento anterior y se vuelve a aplicar: editar una
    // compra sin revertir dejaría el stock contado dos veces.
    await revertirMovimientos(tx, 'compra', pagoId);
    await tx.compraItem.deleteMany({ where: { pago_id: pagoId } });
    const iva = await resolverIva(tx, data);
    await tx.pagoProveedor.update({
      where: { id: pagoId },
      data: { ...cabecera(data, baseUrl), ...ivaCabecera(data, iva) },
    });
    await registrarItems(tx, pagoId, data, iva);
    return tx.pagoProveedor.findUniqueOrThrow({ where: { id: pagoId }, include: includeEmpresa });
  });
  return mapPago(row);
};

export const deletePago = async (id: string) => {
  const pagoId = Number(id);
  return prisma.$transaction(async (tx) => {
    // Borrar la compra saca del inventario lo que había entrado con ella
    await revertirMovimientos(tx, 'compra', pagoId);
    return tx.pagoProveedor.delete({ where: { id: pagoId } });
  });
};

export const getPagoTotales = async () => {
  const agg = await prisma.pagoProveedor.aggregate({
    _sum: { valor_compra: true, coste_envio: true },
  });
  return {
    total_compras: Number(agg._sum.valor_compra ?? 0),
    total_envios:  Number(agg._sum.coste_envio ?? 0),
  };
};

/**
 * Configuración tributaria del negocio (fila única).
 *
 * La tasa no va quemada en código: cambia por ley. Se lee de aquí y se CONGELA
 * en cada compra, así que ajustarla mañana no reescribe la historia.
 */
export const getConfigTributaria = async () => {
  const c = await prisma.negocioConfig.findFirst();
  return {
    responsable_iva: c?.responsable_iva ?? false,
    iva_tasa: Number(c?.iva_tasa ?? 0.19),
  };
};

export const setConfigTributaria = async (data: { responsable_iva?: boolean; iva_tasa?: number }) => {
  const row = await prisma.negocioConfig.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, responsable_iva: data.responsable_iva ?? false, iva_tasa: data.iva_tasa ?? 0.19 },
  });
  return { responsable_iva: row.responsable_iva, iva_tasa: Number(row.iva_tasa) };
};
