export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

/**
 * Lo que Express entrega en `req.query`: el valor de cada clave puede ser un
 * texto, un arreglo, otro objeto o nada — quien lo lea tiene que comprobarlo.
 * Escribirlo como `string` era mentira, y por eso cada llamada traía un
 * `as any` que apagaba el chequeo entero del objeto.
 */
export type ConsultaUrl = Record<string, unknown>;

export function parsePagination(query: ConsultaUrl): PaginationParams {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

/** Término de búsqueda global saneado (o undefined si viene vacío). */
export function parseSearch(query: ConsultaUrl): string | undefined {
  const s = typeof query.search === 'string' ? query.search.trim().slice(0, 100) : '';
  return s || undefined;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

export function paginatedResponse<T>(data: T[], total: number, page: number, limit: number): PaginatedResult<T> {
  return { data, total, page, totalPages: Math.ceil(total / limit) };
}
