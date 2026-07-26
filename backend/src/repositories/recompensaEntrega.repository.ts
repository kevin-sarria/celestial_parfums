import { prisma } from '../config/prisma';
import { paginatedResponse } from '../utils/pagination';
import { borrarImagenSubida } from '../utils/imagenes';

/**
 * Entregas de premios de fidelidad con fotos para la galería pública de
 * "ganadores". Cada entrega la crea `entregarPremio`; el admin o el propio
 * cliente le suben fotos, y aparece pública solo si el admin la aprueba.
 */

const imgs = (v: any): string[] => (Array.isArray(v) ? v : []);

const mapEntrega = (e: any) => ({
  id: e.id,
  user_id: e.user_id,
  cliente: e.user ? `${e.user.nombre} ${e.user.apellido}` : '',
  premio: e.premio,
  imagenes: imgs(e.imagenes),
  estado: e.estado,
  fecha: e.created_at,
});

/** Añade fotos a una entrega (reemplaza el set). `userId` = si lo sube el cliente. */
export const subirFotosEntrega = async (entregaId: number, imagenes: string[], userId?: number) => {
  const e = await prisma.recompensaEntrega.findUnique({ where: { id: entregaId } });
  if (!e) throw new Error('Entrega no encontrada');
  if (userId != null && e.user_id !== userId) throw new Error('Esta entrega no es tuya');
  imgs(e.imagenes).filter((u) => !imagenes.includes(u)).forEach(borrarImagenSubida);
  // Si sube fotos el cliente, vuelve a quedar pendiente de aprobación
  const row = await prisma.recompensaEntrega.update({
    where: { id: entregaId },
    data: { imagenes, ...(userId != null ? { estado: 'pendiente' } : {}) },
    include: { user: { select: { nombre: true, apellido: true } } },
  });
  return mapEntrega(row);
};

/** Entregas del cliente logueado (para que suba sus fotos). */
export const misEntregas = async (userId: number) => {
  const rows = await prisma.recompensaEntrega.findMany({
    where: { user_id: userId }, orderBy: { created_at: 'desc' },
    include: { user: { select: { nombre: true, apellido: true } } },
  });
  return rows.map(mapEntrega);
};

/** Galería pública: entregas aprobadas y con al menos una foto. */
export const galeriaGanadores = async () => {
  const rows = await prisma.recompensaEntrega.findMany({
    where: { estado: 'aprobada' }, orderBy: { created_at: 'desc' }, take: 60,
    include: { user: { select: { nombre: true, apellido: true } } },
  });
  return rows.map(mapEntrega).filter((e) => e.imagenes.length > 0);
};

// ── Admin ────────────────────────────────────────────────────────────────────
export const listarEntregasAdmin = async (page: number, limit: number, estado?: string) => {
  const where = estado === 'pendiente' || estado === 'aprobada' || estado === 'rechazada'
    ? { estado: estado as 'pendiente' | 'aprobada' | 'rechazada' } : undefined;
  const [rows, total] = await Promise.all([
    prisma.recompensaEntrega.findMany({
      where, skip: (page - 1) * limit, take: limit, orderBy: { created_at: 'desc' },
      include: { user: { select: { nombre: true, apellido: true } } },
    }),
    prisma.recompensaEntrega.count({ where }),
  ]);
  return paginatedResponse(rows.map(mapEntrega), total, page, limit);
};

export const moderarEntrega = (id: number, estado: 'aprobada' | 'rechazada' | 'pendiente') =>
  prisma.recompensaEntrega.update({
    where: { id }, data: { estado }, include: { user: { select: { nombre: true, apellido: true } } },
  }).then(mapEntrega);

export const eliminarEntrega = async (id: number) => {
  const row = await prisma.recompensaEntrega.delete({ where: { id } });
  imgs(row.imagenes).forEach(borrarImagenSubida);
};
