import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

const includeRel = { rol: true } as const;

/**
 * El usuario con su rol y —solo en el listado del admin— sus cupones sin
 * canjear. Por eso `codigos_descuento` es opcional: las demás consultas no los
 * traen y el mapeador sirve para todas.
 */
type UserRow = Prisma.UserGetPayload<{ include: typeof includeRel }> & {
  codigos_descuento?: { codigo: string; anuncio: { titulo: string; descuento_pct: number } | null }[];
};

const mapUser = (u: UserRow) => ({
  id: u.id,
  nombre: u.nombre,
  apellido: u.apellido,
  email: u.email,
  rol_id: u.rol_id,
  rol: u.rol?.nombre ?? null,
  activo: u.activo,
  telefono: u.telefono ?? null,
  direccion: u.direccion ?? null,
  cupo_base: Number(u.cupo_base ?? 0),
  // true = ficha creada por el admin sin acceso web todavía
  sin_cuenta: u.sin_cuenta,
  // Códigos de descuento emitidos y aún sin canjear (solo en el listado admin)
  codigos_activos: (u.codigos_descuento ?? []).map((c) => ({
    codigo: c.codigo,
    titulo: c.anuncio?.titulo ?? '',
    descuento_pct: c.anuncio?.descuento_pct ?? 0,
  })),
  created_at: u.created_at,
});

export const getAllUsers = async () => {
  const rows = await prisma.user.findMany({
    include: {
      ...includeRel,
      codigos_descuento: {
        where: { estado: 'activo' },
        select: { codigo: true, anuncio: { select: { titulo: true, descuento_pct: true } } },
      },
    },
    orderBy: [{ rol_id: 'asc' }, { apellido: 'asc' }, { nombre: 'asc' }],
  });
  return rows.map(mapUser);
};

export const findUserById = (id: number) => prisma.user.findUnique({ where: { id } });

export const findUserByEmailExcept = (email: string, exceptId: number) =>
  prisma.user.findFirst({ where: { email, id: { not: exceptId } } });

export const findUserByEmail = (email: string) => prisma.user.findFirst({ where: { email } });

/** Ficha creada por el admin: sin acceso web (activo=false, password inservible). */
export const createFicha = async (data: {
  nombre: string; apellido: string; email: string;
  telefono?: string | null; direccion?: string | null; cupo_base?: number;
}) => {
  const row = await prisma.user.create({
    data: {
      nombre: data.nombre,
      apellido: data.apellido,
      email: data.email,
      password: '!sin-acceso!',
      rol_id: 2,
      activo: false,
      sin_cuenta: true,
      telefono: data.telefono ?? null,
      direccion: data.direccion ?? null,
      cupo_base: data.cupo_base ?? 0,
    },
    include: includeRel,
  });
  return mapUser(row);
};

export const updateUser = async (
  id: number,
  data: {
    nombre: string; apellido: string; email: string; activo?: boolean;
    hashedPassword?: string; telefono?: string | null; direccion?: string | null; cupo_base?: number;
  },
) => {
  const row = await prisma.user.update({
    where: { id },
    data: {
      nombre: data.nombre,
      apellido: data.apellido,
      email: data.email,
      ...(data.activo !== undefined ? { activo: data.activo } : {}),
      ...(data.hashedPassword ? { password: data.hashedPassword } : {}),
      ...(data.telefono !== undefined ? { telefono: data.telefono } : {}),
      ...(data.direccion !== undefined ? { direccion: data.direccion } : {}),
      ...(data.cupo_base !== undefined ? { cupo_base: data.cupo_base } : {}),
    },
    include: includeRel,
  });
  return mapUser(row);
};

export const countCreditosByUser = (id: number) => prisma.credito.count({ where: { user_id: id } });

export const deleteUser = (id: number) =>
  // ventas.user_id queda en null (SetNull); solicitudes se borran en cascada.
  prisma.user.delete({ where: { id } });
