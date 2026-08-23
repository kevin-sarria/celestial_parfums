import { Router } from 'express';
import * as repo from '../repositories/blog.repository';
import { requireAdmin } from '../middleware/auth.middleware';
import { uploadMemoria } from '../config/upload';
import { h } from '../middleware/error.middleware';
import { badRequest, notFound } from '../utils/httpError';
import { parsePagination } from '../utils/pagination';
import { guardarWebp } from '../utils/imagenWebp';
import { getPublicBaseUrl } from '../utils/publicUrl';

export const blogRouter = Router();

/**
 * El cuerpo de una petición es lo que el navegador quiso mandar: se mira campo
 * por campo antes de creerle. Con `body: any` daba igual escribir `body.titluo`
 * —compilaba— y el post salía sin título.
 */
const texto = (v: unknown) => (typeof v === 'string' ? v : '');

const validarPost = (body: Record<string, unknown>): repo.PostInput => {
  const titulo = texto(body?.titulo).trim();
  const contenido = texto(body?.contenido);
  if (!titulo) throw badRequest('El título es obligatorio');
  if (!contenido.trim()) throw badRequest('El contenido no puede estar vacío');
  return {
    titulo,
    contenido,
    resumen: texto(body?.resumen) || undefined,
    portada: texto(body?.portada) || null,
    publicado: !!body?.publicado,
  };
};

// ── Público ──────────────────────────────────────────────────────────────────
blogRouter.get('/', h(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  res.json(await repo.listarPublicos(page, limit));
}));

// ── Admin ── (antes de /:slug para que no lo capture) ─────────────────────────
blogRouter.get('/admin', requireAdmin, h(async (req, res) => {
  const { page, limit } = parsePagination(req.query);
  res.json(await repo.listarAdmin(page, limit));
}));

blogRouter.get('/admin/:id', requireAdmin, h(async (req, res) => {
  const post = await repo.getAdmin(Number(req.params.id));
  if (!post) throw notFound('Entrada no encontrada');
  res.json({ data: post });
}));

blogRouter.post('/admin', requireAdmin, h(async (req, res) => {
  res.status(201).json({ message: 'Entrada creada', data: await repo.crearPost(validarPost(req.body)) });
}));

blogRouter.patch('/admin/:id', requireAdmin, h(async (req, res) => {
  res.json({ message: 'Entrada actualizada', data: await repo.actualizarPost(Number(req.params.id), validarPost(req.body)) });
}));

blogRouter.delete('/admin/:id', requireAdmin, h(async (req, res) => {
  await repo.eliminarPost(Number(req.params.id));
  res.json({ message: 'Entrada eliminada' });
}));

blogRouter.post('/admin/portada', requireAdmin, uploadMemoria.single('imagen'), h(async (req, res) => {
  if (!req.file) throw badRequest('Adjunta una imagen');
  const url = await guardarWebp(req.file.buffer, getPublicBaseUrl(req));
  res.json({ data: { url } });
}));

// ── Público: entrada por slug (va al final) ──────────────────────────────────
blogRouter.get('/:slug', h(async (req, res) => {
  const post = await repo.getPublicoPorSlug(String(req.params.slug));
  if (!post) throw notFound('Entrada no encontrada');
  res.json({ data: post });
}));
