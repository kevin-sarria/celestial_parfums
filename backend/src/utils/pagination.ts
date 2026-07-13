export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export function parsePagination(query: { page?: string; limit?: string }): PaginationParams {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

/** Término de búsqueda global saneado (o undefined si viene vacío). */
export function parseSearch(query: { search?: string }): string | undefined {
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
