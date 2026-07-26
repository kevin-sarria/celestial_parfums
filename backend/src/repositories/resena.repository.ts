import { prisma } from '../config/prisma';
import { paginatedResponse } from '../utils/pagination';
import { borrarImagenSubida } from '../utils/imagenes';

/** ¿El cliente compró (pagó) ese perfume alguna vez? Reseña = compra verificada. */
export const haComprado = async (userId: number, perfumeId: number) => {
  const n = await prisma.ventaPerfume.count({
    where: { perfume_id: perfumeId, venta: { user_id: userId, pagada: true } },
  });
  return n > 0;
};

const imgs = (v: any): string[] => (Array.isArray(v) ? v : []);

const mapResena = (r: any) => ({
  id: r.id,
  perfume_id: r.perfume_id,
  perfume: r.perfume ? { id: r.perfume.id, nombre: r.perfume.nombre, imagen_url: r.perfume.imagen_url ?? null } : undefined,
  autor: r.user ? r.user.nombre : '',
  rating: r.rating,
  comentario: r.comentario ?? '',
  imagenes: imgs(r.imagenes),
  estado: r.estado,
  fecha: r.created_at,
});

/** Perfumes que el cliente compró, con su reseña si ya la hizo (para "Mis compras"). */
export const productosComprados = async (userId: number) => {
  const links = await prisma.ventaPerfume.findMany({
    where: { venta: { user_id: userId, pagada: true } },
    select: { perfume: { select: { id: true, nombre: true, imagen_url: true } } },
    distinct: ['perfume_id'],
    orderBy: { perfume_id: 'asc' },
  });
  const perfumeIds = links.map((l) => l.perfume.id);
  const mias = await prisma.resena.findMany({ where: { user_id: userId, perfume_id: { in: perfumeIds } } });
  const porPerfume = new Map(mias.map((r) => [r.perfume_id, r]));
  return links.map((l) => {
    const r = porPerfume.get(l.perfume.id);
    return {
      id: l.perfume.id,
      nombre: l.perfume.nombre,
      imagen_url: l.perfume.imagen_url ?? null,
      resena: r ? { rating: r.rating, comentario: r.comentario ?? '', imagenes: imgs(r.imagenes), estado: r.estado } : null,
    };
  });
};

/** Crea o actualiza la reseña del cliente para un perfume (vuelve a 'pendiente'). */
export const guardarResena = async (
  userId: number, perfumeId: number, rating: number, comentario: string | null, imagenes: string[],
) => {
  if (!(await haComprado(userId, perfumeId))) throw new Error('Solo puedes reseñar productos que compraste');
  const previa = await prisma.resena.findUnique({ where: { user_id_perfume_id: { user_id: userId, perfume_id: perfumeId } } });
  // Borra del disco las fotos anteriores que ya no están en la reseña nueva
  if (previa) imgs(previa.imagenes).filter((u) => !imagenes.includes(u)).forEach(borrarImagenSubida);
  const row = await prisma.resena.upsert({
    where: { user_id_perfume_id: { user_id: userId, perfume_id: perfumeId } },
    create: { user_id: userId, perfume_id: perfumeId, rating, comentario, imagenes, estado: 'pendiente' },
    update: { rating, comentario, imagenes, estado: 'pendiente' },
  });
  return mapResena(row);
};

/** Reseñas APROBADAS de un producto (público). */
export const resenasDeProducto = async (perfumeId: number) => {
  const rows = await prisma.resena.findMany({
    where: { perfume_id: perfumeId, estado: 'aprobada' },
    include: { user: { select: { nombre: true } } },
    orderBy: { created_at: 'desc' },
  });
  return rows.map(mapResena);
};

/** Promedio y total de reseñas aprobadas de varios perfumes (para cards/detalle). */
export const resumenRatings = async (perfumeIds: number[]): Promise<Map<number, { promedio: number; total: number }>> => {
  if (!perfumeIds.length) return new Map();
  const g = await prisma.resena.groupBy({
    by: ['perfume_id'],
    where: { perfume_id: { in: perfumeIds }, estado: 'aprobada' },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return new Map(g.map((x) => [x.perfume_id, { promedio: Math.round((x._avg.rating ?? 0) * 10) / 10, total: x._count._all }]));
};

// ── Admin (moderación) ──────────────────────────────────────────────────────
export const listarAdmin = async (page: number, limit: number, estado?: string) => {
  const where = estado === 'pendiente' || estado === 'aprobada' || estado === 'rechazada'
    ? { estado: estado as 'pendiente' | 'aprobada' | 'rechazada' } : undefined;
  const [rows, total] = await Promise.all([
    prisma.resena.findMany({
      where, skip: (page - 1) * limit, take: limit, orderBy: { created_at: 'desc' },
      include: { user: { select: { nombre: true } }, perfume: { select: { id: true, nombre: true, imagen_url: true } } },
    }),
    prisma.resena.count({ where }),
  ]);
  return paginatedResponse(rows.map(mapResena), total, page, limit);
};

export const moderarResena = (id: number, estado: 'aprobada' | 'rechazada' | 'pendiente') =>
  prisma.resena.update({ where: { id }, data: { estado } }).then(mapResena);

export const eliminarResena = async (id: number) => {
  const row = await prisma.resena.delete({ where: { id } });
  imgs(row.imagenes).forEach(borrarImagenSubida);
};
