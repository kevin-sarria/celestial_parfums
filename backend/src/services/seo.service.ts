import fs from 'fs';
import path from 'path';
import { prisma } from '../config/prisma';
import { cacheGet, cacheSet } from '../utils/cache';
import { toSlug } from '../utils/slug';
import * as perfumeService from './perfume.service';
import * as comboService from './combo.service';

/**
 * SEO server-side para la SPA: en producción nginx manda /perfume/*, /combo/*,
 * /sitemap.xml y /robots.txt al backend, que responde el index.html compilado
 * del frontend con <title>, descripción, Open Graph y JSON-LD del producto.
 * Los rastreadores de WhatsApp/Google no ejecutan JavaScript: estas etiquetas
 * son las que hacen que un link compartido muestre foto, nombre y precio.
 */

const SITE_NAME = 'Celestial Parfums';

// Carpeta del frontend compilado (en el servidor ambos viven juntos)
const distDir = () =>
  process.env.FRONTEND_DIST || path.resolve(__dirname, '../../../frontend/dist');

/** index.html compilado, cacheado 5 min (los deploys lo refrescan solos). */
const getIndexHtml = (): string | null => {
  const hit = cacheGet<string>('seo:index');
  if (hit) return hit;
  try {
    const html = fs.readFileSync(path.join(distDir(), 'index.html'), 'utf8');
    cacheSet('seo:index', html, 5 * 60_000);
    return html;
  } catch {
    return null; // sin build del frontend (entorno dev): el router responde 404
  }
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Descripción compacta para buscadores (una línea, sin saltos, ~160 chars). */
const resumen = (texto: string, max = 160) => {
  const plano = texto.replace(/\s+/g, ' ').trim();
  return plano.length <= max ? plano : `${plano.slice(0, max - 1).trimEnd()}…`;
};

interface MetaPagina {
  titulo: string;
  descripcion: string;
  url: string;
  imagen?: string | null;
  tipo?: 'website' | 'product';
  jsonLd?: object;
}

/** Inyecta las etiquetas de la página sobre el index.html compilado. */
export const renderPagina = (meta: MetaPagina): string | null => {
  const base = getIndexHtml();
  if (!base) return null;
  const t = escapeHtml(meta.titulo);
  const d = escapeHtml(meta.descripcion);
  const u = escapeHtml(meta.url);
  const tags = [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<link rel="canonical" href="${u}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="${meta.tipo ?? 'website'}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:url" content="${u}" />`,
    ...(meta.imagen
      ? [
          `<meta property="og:image" content="${escapeHtml(meta.imagen)}" />`,
          `<meta name="twitter:card" content="summary_large_image" />`,
          `<meta name="twitter:image" content="${escapeHtml(meta.imagen)}" />`,
        ]
      : [`<meta name="twitter:card" content="summary" />`]),
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    ...(meta.jsonLd ? [`<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>`] : []),
  ].join('\n    ');
  return base
    // Fuera el título y las etiquetas estáticas del template (quedarían duplicadas)
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/<meta name="description"[^>]*>\s*/i, '')
    .replace(/<meta property="og:[^>]*>\s*/gi, '')
    .replace(/<meta name="twitter:[^>]*>\s*/gi, '')
    .replace('</head>', `  ${tags}\n  </head>`);
};

const imagenAbsoluta = (imagen: string | null, baseUrl: string) =>
  imagen ? (imagen.startsWith('http') ? imagen : `${baseUrl}${imagen}`) : null;

const precioFinal = (precio: number, descuento: number) =>
  Math.round(precio * (1 - descuento / 100));

/** Página de detalle de un perfume con Open Graph + JSON-LD de producto. */
export const paginaPerfume = async (slug: string, baseUrl: string) => {
  const p = await perfumeService.getPerfumeBySlug(slug).catch(() => null);
  if (!p) return null;
  const partes = [
    p.categoria && `perfume ${p.categoria.toLowerCase()}`,
    p.genero && `para ${p.genero}`,
    p.tipos_aroma.length && `notas ${p.tipos_aroma.slice(0, 3).join(', ').toLowerCase()}`,
  ].filter(Boolean);
  const descripcion = resumen(
    p.descripcion || `${p.nombre}: ${partes.join(' · ') || 'fragancia'} en ${SITE_NAME}. Pide el tuyo por WhatsApp.`,
  );
  const url = `${baseUrl}/perfume/${toSlug(p.nombre)}`;
  const imagen = imagenAbsoluta(p.imagen_url, baseUrl);
  return renderPagina({
    titulo: `${p.nombre} — ${SITE_NAME}`,
    descripcion,
    url,
    imagen,
    tipo: 'product',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.nombre,
      description: descripcion,
      ...(imagen ? { image: imagen } : {}),
      ...(p.categoria ? { category: p.categoria } : {}),
      brand: { '@type': 'Brand', name: SITE_NAME },
      offers: {
        '@type': 'Offer',
        url,
        priceCurrency: 'COP',
        price: precioFinal(p.precio, p.descuento),
        availability: p.agotado ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      },
    },
  });
};

/** Página de detalle de un combo. */
export const paginaCombo = async (slug: string, baseUrl: string) => {
  const c = await comboService.getComboBySlug(slug).catch(() => null);
  if (!c || !c.activo) return null;
  const descripcion = resumen(
    c.descripcion || `${c.nombre}: combo de ${c.cantidad} perfumes en ${SITE_NAME}. Pide el tuyo por WhatsApp.`,
  );
  const url = `${baseUrl}/combo/${toSlug(c.nombre)}`;
  const imagen = imagenAbsoluta(c.imagen_url, baseUrl);
  return renderPagina({
    titulo: `${c.nombre} — ${SITE_NAME}`,
    descripcion,
    url,
    imagen,
    tipo: 'product',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: c.nombre,
      description: descripcion,
      ...(imagen ? { image: imagen } : {}),
      brand: { '@type': 'Brand', name: SITE_NAME },
      offers: {
        '@type': 'Offer',
        url,
        priceCurrency: 'COP',
        price: precioFinal(c.precio, c.descuento),
        availability: 'https://schema.org/InStock',
      },
    },
  });
};

/** Sitemap con las páginas fijas + todos los perfumes y combos activos. */
export const sitemap = async (baseUrl: string) => {
  const hit = cacheGet<string>('parfums:sitemap');
  if (hit) return hit;
  const [perfumes, combos] = await Promise.all([
    prisma.perfume.findMany({ select: { nombre: true, updated_at: true } }),
    prisma.combo.findMany({ where: { activo: true }, select: { nombre: true, updated_at: true } }),
  ]);
  const urlTag = (loc: string, lastmod?: Date) =>
    `  <url><loc>${escapeHtml(loc)}</loc>${lastmod ? `<lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : ''}</url>`;
  const fijas = ['', '/perfumes', '/combos', '/contactame'].map((r) => urlTag(`${baseUrl}${r}`));
  const productos = [
    ...perfumes.map((p) => urlTag(`${baseUrl}/perfume/${toSlug(p.nombre)}`, p.updated_at)),
    ...combos.map((c) => urlTag(`${baseUrl}/combo/${toSlug(c.nombre)}`, c.updated_at)),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...fijas, ...productos].join('\n')}\n</urlset>\n`;
  cacheSet('parfums:sitemap', xml, 60 * 60_000);
  return xml;
};

/** robots.txt: rastrear el catálogo, no las zonas privadas. */
export const robotsTxt = (baseUrl: string) =>
  [
    'User-agent: *',
    'Allow: /',
    'Disallow: /dashboard',
    'Disallow: /login',
    'Disallow: /register',
    'Disallow: /verify',
    'Disallow: /mi-credito',
    'Disallow: /perfume-ideal',
    'Disallow: /api/',
    '',
    `Sitemap: ${baseUrl}/sitemap.xml`,
    '',
  ].join('\n');
