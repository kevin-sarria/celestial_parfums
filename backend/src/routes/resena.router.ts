import { Router } from 'express';
import * as repo from '../repositories/resena.repository';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';
import { uploadMemoria } from '../config/upload';
import { uploadLimiter } from '../middleware/limiters';
import { h } from '../middleware/error.middleware';
import { badRequest } from '../utils/httpError';
import { parsePagination } from '../utils/pagination';
import { guardarVariasWebp } from '../utils/imagenWebp';
import { getPublicBaseUrl } from '../utils/publicUrl';
import { sanearUploadsConservados } from '../utils/uploadsUrl';
import { cacheClear } from '../utils/cache';

export const resenaRouter = Router();

const ESTADOS = ['pendiente', 'aprobada', 'rechazada'] as const;
type Estado = (typeof ESTADOS)[number];
const parseEstado = (v: unknown): Estado => {
  if (typeof v === 'string' && (ESTADOS as readonly string[]).includes(v)) return v as Estado;
  throw badRequest('Estado inválido');
};

// ── Público ──────────────────────────────────────────────────────────────────
resenaRouter.get('/producto/:id', h(async (req, res) => {
  res.json({ data: await repo.resenasDeProducto(Number(req.params.id)) });
}));

// ── Cliente logueado ─────────────────────────────────────────────────────────
resenaRouter.get('/mis-compras', requireAuth, h(async (req, res) => {
  res.json({ data: await repo.productosComprados(req.jwtUser!.id) });
}));

// Crea/actualiza reseña con hasta 3 fotos (se convierten a WebP livianas)
resenaRouter.post('/', requireAuth, uploadLimiter, uploadMemoria.array('imagenes', 3), h(async (req, res) => {
  const perfumeId = Number(req.body.perfume_id);
  const rating = Number(req.body.rating);
  const comentario = (req.body.comentario ?? '').toString().trim().slice(0, 2000) || null;
  const baseUrl = getPublicBaseUrl(req);
  const conservarRaw: string[] = req.body.conservar
    ? (Array.isArray(req.body.conservar) ? req.body.conservar : [req.body.conservar])
    : [];
  // Solo se conservan URLs de NUESTRO /uploads (nada externo ni inyectado)
  const conservar = sanearUploadsConservados(conservarRaw, baseUrl);
  if (!perfumeId) throw badRequest('Falta el producto');
  if (!(rating >= 1 && rating <= 5)) throw badRequest('La calificación debe ser de 1 a 5 estrellas');

  const files = (req.files as Express.Multer.File[]) ?? [];
  const nuevas = files.length ? await guardarVariasWebp(files.map((f) => f.buffer), baseUrl) : [];
  const imagenes = [...conservar, ...nuevas].slice(0, 3);

  const data = await repo.guardarResena(req.jwtUser!.id, perfumeId, rating, comentario, imagenes);
  cacheClear('parfums:'); // el promedio de estrellas se muestra en el catálogo
  res.status(201).json({ message: 'Reseña enviada; la revisaremos antes de publicarla', data });
}));

// ── Admin (moderación) ───────────────────────────────────────────────────────
resenaRouter.get('/admin', requireAdmin, h(async (req, res) => {
  const { page, limit } = parsePagination(req.query as any);
  res.json(await repo.listarAdmin(page, limit, req.query.estado as string | undefined));
}));

resenaRouter.patch('/admin/:id', requireAdmin, h(async (req, res) => {
  const data = await repo.moderarResena(Number(req.params.id), parseEstado(req.body.estado));
  cacheClear('parfums:');
  res.json({ message: 'Reseña actualizada', data });
}));

resenaRouter.delete('/admin/:id', requireAdmin, h(async (req, res) => {
  await repo.eliminarResena(Number(req.params.id));
  cacheClear('parfums:');
  res.json({ message: 'Reseña eliminada' });
}));
