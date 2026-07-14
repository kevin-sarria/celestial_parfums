import { prisma } from '../config/prisma';
import { CreateVentaDTO } from '../types/venta.type';
import { paginatedResponse } from '../utils/pagination';

const includeCliente = { cliente: true } as const;

const mapVenta = (v: any) => ({
  id:                 v.id,
  dia:                v.dia,
  persona:            v.persona,
  cliente_id:         v.cliente_id ?? null,
  cliente:            v.cliente
    ? { id: v.cliente.id, nombre: v.cliente.nombre, apellido: v.cliente.apellido, telefono: v.cliente.telefono ?? null }
    : null,
  cantidad_perfumes:  v.cantidad_perfumes,
  presentacion:       v.presentacion,
  referencia_perfume: v.referencia_perfume,
  valor_venta:        Number(v.valor_venta),
  datos_adicionales:  v.datos_adicionales ?? null,
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
          { cliente: { nombre: { contains: search } } },
          { cliente: { apellido: { contains: search } } },
          { cliente: { telefono: { contains: search } } },
        ],
      }
    : undefined;
  const [rows, total] = await Promise.all([
    prisma.venta.findMany({ where, skip, take: limit, orderBy: { dia: 'desc' }, include: includeCliente }),
    prisma.venta.count({ where }),
  ]);
  return paginatedResponse(rows.map(mapVenta), total, page, limit);
};

export const createVenta = async (data: CreateVentaDTO) => {
  const row = await prisma.venta.create({
    data: {
      dia:                new Date(data.dia),
      persona:            data.persona,
      cliente_id:         data.cliente_id ?? null,
      cantidad_perfumes:  data.cantidad_perfumes,
      presentacion:       data.presentacion,
      referencia_perfume: data.referencia_perfume,
      valor_venta:        data.valor_venta,
      datos_adicionales:  data.datos_adicionales ?? null,
    },
    include: includeCliente,
  });
  return mapVenta(row);
};

export const updateVenta = async (id: string, data: CreateVentaDTO) => {
  const row = await prisma.venta.update({
    where: { id: Number(id) },
    data: {
      dia:                new Date(data.dia),
      persona:            data.persona,
      cliente_id:         data.cliente_id ?? null,
      cantidad_perfumes:  data.cantidad_perfumes,
      presentacion:       data.presentacion,
      referencia_perfume: data.referencia_perfume,
      valor_venta:        data.valor_venta,
      datos_adicionales:  data.datos_adicionales ?? null,
    },
    include: includeCliente,
  });
  return mapVenta(row);
};

export const deleteVenta = (id: string) =>
  prisma.venta.delete({ where: { id: Number(id) } });

export const getVentaTotales = async () => {
  const agg = await prisma.venta.aggregate({
    _sum: { cantidad_perfumes: true, valor_venta: true },
  });
  return {
    total_unidades: agg._sum.cantidad_perfumes ?? 0,
    total_dinero:   Number(agg._sum.valor_venta ?? 0),
  };
};
