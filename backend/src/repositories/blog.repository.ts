import sanitizeHtml from 'sanitize-html';
import type { Post } from '@prisma/client';
import { prisma } from '../config/prisma';
import { toSlug } from '../utils/slug';
import { paginatedResponse } from '../utils/pagination';

/**
 * Blog. El contenido llega como HTML del editor y SIEMPRE se sanea en el backend
 * antes de guardar (anti-XSS): solo se permiten etiquetas de formato seguras, sin
 * scripts, estilos ni manejadores de eventos. Nunca se confía en el cliente.
 */
const OPCIONES_SANEO: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h2', 'h3', 'h4',
    'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'hr'],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  // Fuerza rel seguro en enlaces que abren en otra pestaña
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow' }),
  },
};

export const sanearHtml = (html: string) => sanitizeHtml(html ?? '', OPCIONES_SANEO);

const mapPost = (p: Post) => ({
  id: p.id,
  titulo: p.titulo,
  slug: p.slug,
  resumen: p.resumen ?? '',
  contenido: p.contenido,
  portada: p.portada ?? null,
  publicado: p.publicado,
  fecha: p.created_at,
});

/** Slug único a partir del título (agrega -2, -3… si choca). */
const slugUnico = async (titulo: string, ignoreId?: number) => {
  const base = toSlug(titulo) || 'post';
  let slug = base;
  for (let i = 2; ; i++) {
    const existe = await prisma.post.findFirst({ where: { slug, NOT: ignoreId ? { id: ignoreId } : undefined } });
    if (!existe) return slug;
    slug = `${base}-${i}`;
  }
};

// ── Público ──────────────────────────────────────────────────────────────────
export const listarPublicos = async (page: number, limit: number) => {
  const [rows, total] = await Promise.all([
    prisma.post.findMany({
      where: { publicado: true }, orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit, take: limit,
    }),
    prisma.post.count({ where: { publicado: true } }),
  ]);
  // La lista no manda el HTML completo (más liviano)
  return paginatedResponse(rows.map((p) => ({ ...mapPost(p), contenido: undefined })), total, page, limit);
};

export const getPublicoPorSlug = async (slug: string) => {
  const p = await prisma.post.findFirst({ where: { slug, publicado: true } });
  return p ? mapPost(p) : null;
};

// ── Admin ────────────────────────────────────────────────────────────────────
export const listarAdmin = async (page: number, limit: number) => {
  const [rows, total] = await Promise.all([
    prisma.post.findMany({ orderBy: { created_at: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.post.count(),
  ]);
  return paginatedResponse(rows.map(mapPost), total, page, limit);
};

export const getAdmin = (id: number) => prisma.post.findUnique({ where: { id } }).then((p) => (p ? mapPost(p) : null));

export interface PostInput {
  titulo: string;
  resumen?: string;
  contenido: string;
  portada?: string | null;
  publicado?: boolean;
}

export const crearPost = async (data: PostInput) => {
  const row = await prisma.post.create({
    data: {
      titulo: data.titulo.trim(),
      slug: await slugUnico(data.titulo),
      resumen: data.resumen?.trim() || null,
      contenido: sanearHtml(data.contenido),
      portada: data.portada ?? null,
      publicado: data.publicado ?? false,
    },
  });
  return mapPost(row);
};

export const actualizarPost = async (id: number, data: PostInput) => {
  const row = await prisma.post.update({
    where: { id },
    data: {
      titulo: data.titulo.trim(),
      slug: await slugUnico(data.titulo, id),
      resumen: data.resumen?.trim() || null,
      contenido: sanearHtml(data.contenido),
      portada: data.portada ?? null,
      publicado: data.publicado ?? false,
    },
  });
  return mapPost(row);
};

export const eliminarPost = (id: number) => prisma.post.delete({ where: { id } });
