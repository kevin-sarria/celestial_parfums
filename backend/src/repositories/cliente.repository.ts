import { prisma } from '../config/prisma';
import { CreateClienteDTO } from '../types/cliente.type';

const mapCliente = (c: any) => ({
  id:        c.id,
  nombre:    c.nombre,
  apellido:  c.apellido,
  correo:    c.correo ?? null,
  telefono:  c.telefono ?? null,
  direccion: c.direccion ?? null,
  created_at: c.created_at,
});

export const getAllClientes = async () => {
  const rows = await prisma.cliente.findMany({ orderBy: { apellido: 'asc' } });
  return rows.map(mapCliente);
};

export const createCliente = async (data: CreateClienteDTO) => {
  const row = await prisma.cliente.create({
    data: {
      nombre:    data.nombre,
      apellido:  data.apellido,
      correo:    data.correo ?? null,
      telefono:  data.telefono ?? null,
      direccion: data.direccion ?? null,
    },
  });
  return mapCliente(row);
};

export const updateCliente = async (id: string, data: CreateClienteDTO) => {
  const row = await prisma.cliente.update({
    where: { id: Number(id) },
    data: {
      nombre:    data.nombre,
      apellido:  data.apellido,
      correo:    data.correo ?? null,
      telefono:  data.telefono ?? null,
      direccion: data.direccion ?? null,
    },
  });
  return mapCliente(row);
};

export const deleteCliente = (id: string) =>
  prisma.cliente.delete({ where: { id: Number(id) } });
