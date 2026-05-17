import { prisma } from '../config/prisma';
import { CreateVentaDTO } from '../types/venta.type';

const mapVenta = (v: any) => ({
  id:                 v.id,
  dia:                v.dia,
  persona:            v.persona,
  cantidad_perfumes:  v.cantidad_perfumes,
  presentacion:       v.presentacion,
  referencia_perfume: v.referencia_perfume,
  valor_venta:        Number(v.valor_venta),
  datos_adicionales:  v.datos_adicionales ?? null,
  created_at:         v.created_at,
});

export const getAllVentas = async (page: number, limit: number) => {
  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    prisma.venta.findMany({ skip, take: limit, orderBy: { dia: 'desc' } }),
    prisma.venta.count(),
  ]);
  return { data: rows.map(mapVenta), total, page, totalPages: Math.ceil(total / limit) };
};

export const createVenta = async (data: CreateVentaDTO) => {
  const row = await prisma.venta.create({
    data: {
      dia:                new Date(data.dia),
      persona:            data.persona,
      cantidad_perfumes:  data.cantidad_perfumes,
      presentacion:       data.presentacion,
      referencia_perfume: data.referencia_perfume,
      valor_venta:        data.valor_venta,
      datos_adicionales:  data.datos_adicionales ?? null,
    },
  });
  return mapVenta(row);
};

export const updateVenta = async (id: string, data: CreateVentaDTO) => {
  const row = await prisma.venta.update({
    where: { id: Number(id) },
    data: {
      dia:                new Date(data.dia),
      persona:            data.persona,
      cantidad_perfumes:  data.cantidad_perfumes,
      presentacion:       data.presentacion,
      referencia_perfume: data.referencia_perfume,
      valor_venta:        data.valor_venta,
      datos_adicionales:  data.datos_adicionales ?? null,
    },
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
