import { Router } from 'express';
import { h } from '../middleware/error.middleware';
import { getPublicBaseUrl } from '../utils/publicUrl';
import * as seo from '../services/seo.service';

/**
 * Rutas SEO servidas por el backend (nginx las manda aquí en producción):
 * el index.html del frontend con las etiquetas del producto inyectadas, más
 * sitemap y robots. Montado ANTES del rate limiter: los rastreadores de
 * Google/WhatsApp no deben gastar el cupo de la API.
 */
export const seoRouter = Router();

seoRouter.get('/perfume/:slug', h(async (req, res) => {
  const html = await seo.paginaPerfume(String(req.params.slug), getPublicBaseUrl(req));
  if (!html) { res.status(404).send('No encontrado'); return; }
  res.type('html').send(html);
}));

seoRouter.get('/combo/:slug', h(async (req, res) => {
  const html = await seo.paginaCombo(String(req.params.slug), getPublicBaseUrl(req));
  if (!html) { res.status(404).send('No encontrado'); return; }
  res.type('html').send(html);
}));

seoRouter.get('/sitemap.xml', h(async (req, res) => {
  res.type('application/xml').send(await seo.sitemap(getPublicBaseUrl(req)));
}));

seoRouter.get('/robots.txt', h(async (req, res) => {
  res.type('text/plain').send(seo.robotsTxt(getPublicBaseUrl(req)));
}));
