import { prisma } from '../config/prisma';
import { Prisma } from '../generated/prisma';
import { CreatePerfumeDTO } from '../types/perfume.type';

type PerfumeRow = Prisma.PerfumeGetPayload<{
  include: {
    categoria:      true;
    tipos_aroma:    { include: { tipo_aroma: true } };
    ocasiones:      { include: { ocasion: true } };
    presentaciones: { include: { presentacion: true } };
  };
}>;

const mapPerfume = (p: PerfumeRow) => ({
  id:           p.id,
  nombre:       p.nombre,
  descripcion:  p.descripcion ?? null,
  precio:       Number(p.precio),
  duracion:     p.duracion ?? null,
  proyeccion:   p.proyeccion ?? null,
  imagen_url:   p.imagen_url ?? null,
  genero:       p.genero ?? null,
  categoria:    p.categoria?.nombre ?? null,
  categoria_id: p.categoria_id ?? null,
  descuento:    p.descuento,
  agotado:      p.agotado,
  tipos_aroma:    p.tipos_aroma.map((r) => r.tipo_aroma.nombre),
  ocasiones:      p.ocasiones.map((r) => r.ocasion.nombre),
  presentaciones: p.presentaciones.map((r) => r.presentacion.nombre),
});

const perfumeInclude = {
  categoria:      true,
  tipos_aroma:    { include: { tipo_aroma: true } },
  ocasiones:      { include: { ocasion: true } },
  presentaciones: { include: { presentacion: true } },
} as const;

export const selectAllParfums = async () => {
  const perfumes = await prisma.perfume.findMany({
    include: perfumeInclude,
    orderBy: { nombre: 'asc' },
  });
  return { data: perfumes.map(mapPerfume) };
};

export const selectParfumsPaginated = async (page: number, limit: number) => {
  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    prisma.perfume.findMany({ include: perfumeInclude, orderBy: { nombre: 'asc' }, skip, take: limit }),
    prisma.perfume.count(),
  ]);
  return { data: rows.map(mapPerfume), total, page, totalPages: Math.ceil(total / limit) };
};

export const createPerfume = async (data: CreatePerfumeDTO) => {
  const perfume = await prisma.perfume.create({
    data: {
      nombre:       data.nombre,
      descripcion:  data.descripcion ?? null,
      precio:       data.precio,
      duracion:     data.duracion ?? null,
      proyeccion:   data.proyeccion ?? null,
      imagen_url:   data.imagen_url ?? null,
      genero:       data.genero ?? null,
      categoria_id: data.categoria_id ?? null,
      descuento:    data.descuento ?? 0,
      agotado:      data.agotado ?? false,
      tipos_aroma: {
        create: (data.tipos_aroma ?? []).map((id) => ({ tipo_aroma_id: id })),
      },
      ocasiones: {
        create: (data.ocasiones ?? []).map((id) => ({ ocasion_id: id })),
      },
      presentaciones: {
        create: (data.presentaciones ?? []).map((id) => ({ presentacion_id: id })),
      },
    },
  });
  return { id: perfume.id };
};

export const editPerfume = async (id: string, data: CreatePerfumeDTO) => {
  const numId = Number(id);
  await prisma.$transaction([
    prisma.perfumeTipoAroma.deleteMany({ where: { perfume_id: numId } }),
    prisma.perfumeOcasion.deleteMany({ where: { perfume_id: numId } }),
    prisma.perfumePresentacion.deleteMany({ where: { perfume_id: numId } }),
    prisma.perfume.update({
      where: { id: numId },
      data: {
        nombre:       data.nombre,
        descripcion:  data.descripcion ?? null,
        precio:       data.precio,
        duracion:     data.duracion ?? null,
        proyeccion:   data.proyeccion ?? null,
        imagen_url:   data.imagen_url ?? null,
        genero:       data.genero ?? null,
        categoria_id: data.categoria_id ?? null,
        descuento:    data.descuento ?? 0,
        agotado:      data.agotado ?? false,
        tipos_aroma: {
          create: (data.tipos_aroma ?? []).map((tid) => ({ tipo_aroma_id: tid })),
        },
        ocasiones: {
          create: (data.ocasiones ?? []).map((oid) => ({ ocasion_id: oid })),
        },
        presentaciones: {
          create: (data.presentaciones ?? []).map((pid) => ({ presentacion_id: pid })),
        },
      },
    }),
  ]);
  return { id };
};

export const deletePerfume = (id: string) =>
  prisma.perfume.delete({ where: { id: Number(id) } });

export const patchDescuentoPerfume = (id: string, descuento: number) =>
  prisma.perfume.update({ where: { id: Number(id) }, data: { descuento } });

export const patchAgotadoPerfume = (id: string, agotado: boolean) =>
  prisma.perfume.update({ where: { id: Number(id) }, data: { agotado } });

export const findRelatedPerfumes = async (currentId: number, aromaNames: string[]) => {
  const candidates = await prisma.perfume.findMany({
    where: {
      id: { not: currentId },
      ...(aromaNames.length > 0 && {
        tipos_aroma: { some: { tipo_aroma: { nombre: { in: aromaNames } } } },
      }),
    },
    include: perfumeInclude,
    take: 20,
  });

  return candidates
    .sort(() => Math.random() - 0.5)
    .slice(0, 5)
    .map(mapPerfume);
};

export const findPerfumeBySlug = async (slug: string) => {
  const nombre = slug.replace(/-/g, ' ');
  const perfume = await prisma.perfume.findFirst({
    where: { nombre },
    include: perfumeInclude,
  });
  if (!perfume) return null;
  return mapPerfume(perfume);
};

// ── Aromas ──────────────────────────────────────────────────────────────────

export const getAllAromas = () =>
  prisma.tipoAroma.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } });

export const createAroma = async (nombre: string) => {
  const row = await prisma.tipoAroma.create({ data: { nombre } });
  return row.id;
};

export const deleteAroma = (id: string) =>
  prisma.tipoAroma.delete({ where: { id: Number(id) } });

// ── Ocasiones ───────────────────────────────────────────────────────────────

export const getAllOcasiones = () =>
  prisma.ocasion.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } });

export const createOcasion = async (nombre: string) => {
  const row = await prisma.ocasion.create({ data: { nombre } });
  return row.id;
};

export const deleteOcasion = (id: string) =>
  prisma.ocasion.delete({ where: { id: Number(id) } });

// ── Categorías ──────────────────────────────────────────────────────────────

export const getAllCategorias = () =>
  prisma.categoria.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } });

export const createCategoria = async (nombre: string) => {
  const row = await prisma.categoria.create({ data: { nombre } });
  return row.id;
};

export const deleteCategoria = (id: string) =>
  prisma.categoria.delete({ where: { id: Number(id) } });

// ── Presentaciones ─────────────────────────────────────────────────────────

export const getAllPresentaciones = () =>
  prisma.presentacion.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } });

export const createPresentacion = async (nombre: string) => {
  const row = await prisma.presentacion.create({ data: { nombre } });
  return row.id;
};

export const deletePresentacion = (id: string) =>
  prisma.presentacion.delete({ where: { id: Number(id) } });
