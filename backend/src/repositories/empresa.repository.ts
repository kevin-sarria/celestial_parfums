import type { Empresa } from '@prisma/client';
import { prisma } from '../config/prisma';
import { CreateEmpresaDTO } from '../types/empresa.type';

const mapEmpresa = (e: Empresa) => ({
  id:        e.id,
  nombre:    e.nombre,
  nit:       e.nit ?? null,
  telefono:  e.telefono ?? null,
  correo:    e.correo ?? null,
  direccion: e.direccion ?? null,
  /// Cómo factura el IVA: define el costo real de todo lo que se le compra.
  iva_modo:  e.iva_modo ?? 'incluido',
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
      iva_modo:  data.iva_modo ?? 'incluido',
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
      ...(data.iva_modo ? { iva_modo: data.iva_modo } : {}),
    },
  });
  return mapEmpresa(row);
};

export const deleteEmpresa = (id: string) =>
  prisma.empresa.delete({ where: { id: Number(id) } });
