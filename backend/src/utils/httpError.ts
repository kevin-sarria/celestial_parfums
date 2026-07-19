/**
 * Error de dominio con código HTTP semántico. Los servicios lo lanzan y el
 * middleware central de errores responde con el status correcto; un Error
 * normal sigue respondiendo 400 (comportamiento histórico del API).
 */
export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg);
export const notFound = (msg: string) => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);
