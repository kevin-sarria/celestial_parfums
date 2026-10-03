import { prisma } from '../config/prisma';
import { paginatedResponse } from '../utils/pagination';

/**
 * Lectura del historial de cambios (lo escribe `middleware/registroCambios.ts`).
 * Lo más reciente primero; se busca por quién, por módulo o por lo que dice
 * el resumen ("Khamrah", "#812").
 */
export const listarCambios = async (page: number, limit: number, search?: string) => {
  const where = search
    ? { OR: [{ usuario: { contains: search } }, { modulo: { contains: search } }, { resumen: { contains: search } }] }
    : {};
  const [filas, total] = await Promise.all([
    prisma.registroCambio.findMany({ where, orderBy: { id: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.registroCambio.count({ where }),
  ]);
  return paginatedResponse(filas, total, page, limit);
};
