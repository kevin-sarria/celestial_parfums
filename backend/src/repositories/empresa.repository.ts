import { prisma } from '../config/prisma';
import { CreateEmpresaDTO } from '../types/empresa.type';

const mapEmpresa = (e: any) => ({
  id:        e.id,
  nombre:    e.nombre,
  nit:       e.nit ?? null,
  telefono:  e.telefono ?? null,
  correo:    e.correo ?? null,
  direccion: e.direccion ?? null,
  created_at: e.created_at,
});

export const getAllEmpresas = async () => {
  const rows = await prisma.empresa.findMany({ orderBy: { nombre: 'asc' } });
  return rows.map(mapEmpresa);
};

export const createEmpresa = async (data: CreateEmpresaDTO) => {
  const row = await prisma.empresa.create({
    data: {
      nombre:    data.nombre,
      nit:       data.nit ?? null,
      telefono:  data.telefono ?? null,
      correo:    data.correo ?? null,
      direccion: data.direccion ?? null,
    },
  });
  return mapEmpresa(row);
};

export const updateEmpresa = async (id: string, data: CreateEmpresaDTO) => {
  const row = await prisma.empresa.update({
    where: { id: Number(id) },
    data: {
      nombre:    data.nombre,
      nit:       data.nit ?? null,
      telefono:  data.telefono ?? null,
      correo:    data.correo ?? null,
      direccion: data.direccion ?? null,
    },
  });
  return mapEmpresa(row);
};

export const deleteEmpresa = (id: string) =>
  prisma.empresa.delete({ where: { id: Number(id) } });
