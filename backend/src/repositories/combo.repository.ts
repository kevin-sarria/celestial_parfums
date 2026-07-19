import { prisma } from '../config/prisma';
import { Prisma } from '../generated/prisma';
import { paginatedResponse } from '../utils/pagination';

type ComboRow = Prisma.ComboGetPayload<{ include: { categoria: true; presentacion: true } }>;
import { CreateComboDTO } from '../types/combo.type';

const mapCombo = (c: ComboRow) => ({
  id:              c.id,
  nombre:          c.nombre,
  descripcion:     c.descripcion ?? null,
  imagen_url:      c.imagen_url ?? null,
  categoria_id:    c.categoria_id ?? null,
  categoria:       c.categoria?.nombre ?? null,
  // Presentación de los perfumes del combo; null = cualquier tamaño
  presentacion_id: c.presentacion_id ?? null,
  presentacion:    c.presentacion?.nombre ?? null,
  cantidad:        c.cantidad,
  precio:          Number(c.precio),
  descuento:       c.descuento,
  activo:          c.activo,
});

const comboInclude = { categoria: true, presentacion: true } as const;

const comboOrderBy = [{ cantidad: 'asc' as const }, { nombre: 'asc' as const }];

export const selectAllCombos = async () => {
  const combos = await prisma.combo.findMany({
    include: comboInclude,
    orderBy: comboOrderBy,
  });
  return combos.map(mapCombo);
};

export const selectCombosPaginated = async (page: number, limit: number, search?: string) => {
  const skip = (page - 1) * limit;
  const where: Prisma.ComboWhereInput | undefined = search
    ? {
        OR: [
          { nombre: { contains: search } },
          { descripcion: { contains: search } },
          { categoria: { nombre: { contains: search } } },
        ],
      }
    : undefined;
  const [rows, total] = await Promise.all([
    prisma.combo.findMany({ where, include: comboInclude, orderBy: comboOrderBy, skip, take: limit }),
    prisma.combo.count({ where }),
  ]);
  return paginatedResponse(rows.map(mapCombo), total, page, limit);
};

export const createCombo = async (data: CreateComboDTO) => {
  const combo = await prisma.combo.create({
    data: {
      nombre:          data.nombre,
      descripcion:     data.descripcion ?? null,
      imagen_url:      data.imagen_url ?? null,
      categoria_id:    data.categoria_id ?? null,
      presentacion_id: data.presentacion_id ?? null,
      cantidad:        data.cantidad,
      precio:          data.precio,
      descuento:       data.descuento ?? 0,
      activo:          data.activo ?? true,
    },
  });
  return combo.id;
};

export const updateCombo = (id: string, data: CreateComboDTO) =>
  prisma.combo.update({
    where: { id: Number(id) },
    data: {
      nombre:          data.nombre,
      descripcion:     data.descripcion ?? null,
      imagen_url:      data.imagen_url ?? null,
      categoria_id:    data.categoria_id ?? null,
      presentacion_id: data.presentacion_id ?? null,
      cantidad:        data.cantidad,
      precio:          data.precio,
      descuento:       data.descuento ?? 0,
      activo:          data.activo ?? true,
    },
  });

export const deleteCombo = (id: string) =>
  prisma.combo.delete({ where: { id: Number(id) } });

export const patchComboDescuento = (id: string, descuento: number) =>
  prisma.combo.update({ where: { id: Number(id) }, data: { descuento } });

export const findRelatedCombos = async (currentId: number) => {
  const candidates = await prisma.combo.findMany({
    where: { id: { not: currentId }, activo: true },
    include: comboInclude,
    take: 20,
  });

  // Fisher-Yates shuffle
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  return candidates.slice(0, 5).map(mapCombo);
};

export const findComboBySlug = async (slug: string) => {
  const nombre = slug.replace(/-/g, ' ');
  const combo = await prisma.combo.findFirst({
    where: { nombre },
    include: comboInclude,
  });
  if (!combo) return null;
  return mapCombo(combo);
};
