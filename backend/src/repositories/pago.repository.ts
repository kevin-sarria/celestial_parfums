import { prisma } from '../config/prisma';
import { CreatePagoDTO } from '../types/pago.type';

const includeEmpresa = { empresa: true } as const;

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
  created_at:           p.created_at,
});

export const getAllPagos = async (page: number, limit: number) => {
  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    prisma.pagoProveedor.findMany({ skip, take: limit, orderBy: { dia: 'desc' }, include: includeEmpresa }),
    prisma.pagoProveedor.count(),
  ]);
  return { data: rows.map(mapPago), total, page, totalPages: Math.ceil(total / limit) };
};

export const createPago = async (data: CreatePagoDTO) => {
  const row = await prisma.pagoProveedor.create({
    data: {
      dia:                  new Date(data.dia),
      empresa_id:           data.empresa_id,
      valor_compra:         data.valor_compra,
      coste_envio:          data.coste_envio ?? 0,
      detalles_adicionales: data.detalles_adicionales ?? null,
    },
    include: includeEmpresa,
  });
  return mapPago(row);
};

export const updatePago = async (id: string, data: CreatePagoDTO) => {
  const row = await prisma.pagoProveedor.update({
    where: { id: Number(id) },
    data: {
      dia:                  new Date(data.dia),
      empresa_id:           data.empresa_id,
      valor_compra:         data.valor_compra,
      coste_envio:          data.coste_envio ?? 0,
      detalles_adicionales: data.detalles_adicionales ?? null,
    },
    include: includeEmpresa,
  });
  return mapPago(row);
};

export const deletePago = (id: string) =>
  prisma.pagoProveedor.delete({ where: { id: Number(id) } });

export const getPagoTotales = async () => {
  const agg = await prisma.pagoProveedor.aggregate({
    _sum: { valor_compra: true, coste_envio: true },
  });
  return {
    total_compras: Number(agg._sum.valor_compra ?? 0),
    total_envios:  Number(agg._sum.coste_envio ?? 0),
  };
};
