import { prisma } from '../config/prisma';
import { CreateCreditoDTO } from '../types/credito.type';
import { paginatedResponse } from '../utils/pagination';

const includeAll = { cliente: true, abonos: { orderBy: { created_at: 'asc' as const } } } as const;

const mapCredito = (c: any) => {
  const abonos = (c.abonos ?? []).map((a: any) => ({
    id: a.id,
    monto: Number(a.monto),
    fecha: a.fecha,
  }));

  const totalAbonado = abonos.reduce((acc: number, a: any) => acc + a.monto, 0);
  const deudaInicial = Number(c.deuda_inicial);

  return {
    id:            c.id,
    fecha:         c.fecha,
    cliente: {
      id:        c.cliente.id,
      nombre:    c.cliente.nombre,
      apellido:  c.cliente.apellido,
      telefono:  c.cliente.telefono ?? null,
      correo:    c.cliente.correo ?? null,
      direccion: c.cliente.direccion ?? null,
    },
    articulos:      c.articulos,
    deuda_inicial:  deudaInicial,
    abonos,
    total_abonado:  totalAbonado,
    total_en_deuda: Math.max(0, deudaInicial - totalAbonado),
    created_at:     c.created_at,
  };
};

export const getAllCreditos = async (page: number, limit: number) => {
  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    prisma.credito.findMany({ skip, take: limit, orderBy: { fecha: 'desc' }, include: includeAll }),
    prisma.credito.count(),
  ]);
  return paginatedResponse(rows.map(mapCredito), total, page, limit);
};

export const createCredito = async (data: CreateCreditoDTO) => {
  const row = await prisma.credito.create({
    data: {
      fecha:         new Date(data.fecha),
      cliente_id:    data.cliente_id,
      articulos:     data.articulos,
      deuda_inicial: data.deuda_inicial,
    },
    include: includeAll,
  });
  return mapCredito(row);
};

export const addAbono = async (id: string, monto: number) => {
  const credito = await prisma.credito.findUnique({ where: { id: Number(id) } });
  if (!credito) throw new Error('Crédito no encontrado');

  await prisma.creditoAbono.create({
    data: {
      credito_id: Number(id),
      monto,
      fecha: new Date(),
    },
  });

  const row = await prisma.credito.findUnique({
    where: { id: Number(id) },
    include: includeAll,
  });
  return mapCredito(row);
};

export const deleteAbono = async (abonoId: string) => {
  await prisma.creditoAbono.delete({ where: { id: Number(abonoId) } });
};

export const deleteCredito = (id: string) =>
  prisma.credito.delete({ where: { id: Number(id) } });
