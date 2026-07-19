import { NextFunction, Request, RequestHandler, Response } from 'express';
import logger from '../config/logger';
import { HttpError } from '../utils/httpError';

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
 */
export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = err instanceof HttpError ? err.status : 400;
  const message = err instanceof Error ? err.message : 'Error inesperado';
  if (status >= 500) logger.error('Error no controlado', { error: message });
  res.status(status).json({ error: message });
};
