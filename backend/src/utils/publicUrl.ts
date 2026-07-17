import { Request } from 'express';

/**
 * URL pública base del backend para construir enlaces a /uploads.
 *
 * Prioriza la variable BACKEND_URL (determinista en producción). Si no está,
 * la deriva del request entrante (protocolo + host), por lo que funciona en
 * cualquier dominio sin configuración extra. En localhost devuelve
 * http://localhost:4000; en producción, el dominio real que sirvió la petición.
 *
 * Requiere app.set('trust proxy', true) para que el protocolo sea https cuando
 * hay un proxy inverso (nginx, etc.) terminando el TLS.
 */
export function getPublicBaseUrl(req: Request): string {
  const configured = process.env.BACKEND_URL;
  if (configured && configured.trim()) return configured.trim().replace(/\/+$/, '');
  return `${req.protocol}://${req.get('host')}`;
}
