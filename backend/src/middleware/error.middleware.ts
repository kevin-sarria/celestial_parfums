import { NextFunction, Request, RequestHandler, Response } from 'express';
import logger from '../config/logger';
import { HttpError } from '../utils/httpError';
import { esErrorInterno, mensajeSeguro } from '../utils/errorSeguro';

/**
 * Envuelve un handler async para que cualquier error (throw o promesa
 * rechazada) llegue al middleware central en vez de repetir try/catch
 * en cada endpoint.
 */
export const h =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

/**
 * Middleware central de errores (último app.use): HttpError responde con su
 * status; un Error normal mantiene el 400 histórico de los servicios.
 *
 * Los errores INTERNOS (base caída, bug) nunca salen tal cual: se registran en
 * el log y afuera va un mensaje genérico con 500 — devolver el texto de Prisma
 * expone rutas del servidor y el host de la base.
 */
export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (esErrorInterno(err)) {
    res.status(500).json({ error: mensajeSeguro(err) });
    return;
  }
  const status = err instanceof HttpError ? err.status : 400;
  const message = (err as Error).message;
  if (status >= 500) logger.error('Error no controlado', { error: message });
  res.status(status).json({ error: message });
};
