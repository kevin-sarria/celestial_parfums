import { Prisma } from '../generated/prisma';
import { prisma } from '../config/prisma';
import { CreatePagoDTO } from '../types/pago.type';
import { paginatedResponse } from '../utils/pagination';
import { aBase, aplicarMovimiento, costosConFlete, revertirMovimientos } from './inventario.repository';
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
  items: (p.items ?? []).map((i: any) => ({
    id: i.id,
    insumo_id: i.insumo_id,
    insumo_nombre: i.insumo?.nombre ?? '',
    cantidad: Number(i.cantidad),
    unidad_compra: i.unidad_compra,
    subtotal: Number(i.subtotal),
    costo_unitario_final: Number(i.costo_unitario_final),
  })),
  created_at:           p.created_at,
});

export const getAllPagos = async (page: number, limit: number, search?: string) => {
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
  const [rows, total] = await Promise.all([
    prisma.pagoProveedor.findMany({ where, skip, take: limit, orderBy: { dia: 'desc' }, include: includeEmpresa }),
    prisma.pagoProveedor.count({ where }),
  ]);
  return paginatedResponse(rows.map(mapPago), total, page, limit);
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

/**
 * Crea las líneas de la compra y mete el material al inventario.
 * El flete se reparte proporcional entre las líneas antes de valorar la
 * entrada: el transporte es parte de lo que costó el material.
 */
const registrarItems = async (
  tx: Prisma.TransactionClient, pagoId: number, data: CreatePagoDTO,
) => {
  const items = data.items ?? [];
  if (items.length === 0) return;
  const costos = costosConFlete(items, data.coste_envio ?? 0);
  const fecha = new Date(data.dia);

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    await tx.compraItem.create({
      data: {
        pago_id: pagoId,
        insumo_id: it.insumo_id,
        cantidad: it.cantidad,
        unidad_compra: it.unidad_compra,
        subtotal: it.subtotal,
        costo_unitario_final: costos[i],
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
    const creado = await tx.pagoProveedor.create({ data: cabecera(data, baseUrl) });
    await registrarItems(tx, creado.id, data);
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
    await tx.pagoProveedor.update({ where: { id: pagoId }, data: cabecera(data, baseUrl) });
    await registrarItems(tx, pagoId, data);
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
