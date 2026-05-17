import { prisma } from '../config/prisma';
import { CreateCreditoDTO } from '../types/credito.type';

const includeCliente = { cliente: true } as const;

const mapCredito = (c: any) => {
  const abonos = [
    c.abono_1, c.abono_2, c.abono_3, c.abono_4, c.abono_5,
    c.abono_6, c.abono_7, c.abono_8, c.abono_9, c.abono_10,
  ].map((a) => (a !== null ? Number(a) : null));

  const totalAbonado = abonos.reduce<number>((acc, a) => acc + (a ?? 0), 0);
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
    articulos:     c.articulos,
    deuda_inicial: deudaInicial,
    abono_1:       abonos[0],
    abono_2:       abonos[1],
    abono_3:       abonos[2],
    abono_4:       abonos[3],
    abono_5:       abonos[4],
    abono_6:       abonos[5],
    abono_7:       abonos[6],
    abono_8:       abonos[7],
    abono_9:       abonos[8],
    abono_10:      abonos[9],
    total_en_deuda: Math.max(0, deudaInicial - totalAbonado),
    created_at:    c.created_at,
  };
};

export const getAllCreditos = async (page: number, limit: number) => {
  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    prisma.credito.findMany({ skip, take: limit, orderBy: { fecha: 'desc' }, include: includeCliente }),
    prisma.credito.count(),
  ]);
  return { data: rows.map(mapCredito), total, page, totalPages: Math.ceil(total / limit) };
};

export const createCredito = async (data: CreateCreditoDTO) => {
  const row = await prisma.credito.create({
    data: {
      fecha:         new Date(data.fecha),
      cliente_id:    data.cliente_id,
      articulos:     data.articulos,
      deuda_inicial: data.deuda_inicial,
    },
    include: includeCliente,
  });
  return mapCredito(row);
};

export const addAbono = async (id: string, monto: number) => {
  const credito = await prisma.credito.findUnique({ where: { id: Number(id) } });
  if (!credito) throw new Error('Crédito no encontrado');

  const abonoFields = [
    'abono_1','abono_2','abono_3','abono_4','abono_5',
    'abono_6','abono_7','abono_8','abono_9','abono_10',
  ] as const;

  const campoLibre = abonoFields.find((f) => credito[f] === null);
  if (!campoLibre) throw new Error('Ya se registraron los 10 abonos máximos');

  const row = await prisma.credito.update({
    where: { id: Number(id) },
    data: { [campoLibre]: monto },
    include: includeCliente,
  });
  return mapCredito(row);
};

export const deleteCredito = (id: string) =>
  prisma.credito.delete({ where: { id: Number(id) } });
