/**
 * Micro-caché en memoria para respuestas públicas costosas (catálogo completo,
 * destacados). En un servidor pequeño evita repetir las mismas consultas con
 * joins en cada visita. Sin dependencias: un Map con TTL.
 *
 * Las mutaciones del admin deben invalidar con cacheClear('prefijo') para que
 * los cambios se vean de inmediato.
 */

const store = new Map<string, { data: unknown; expira: number }>();

export const cacheGet = <T>(key: string): T | undefined => {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expira) {
    store.delete(key);
    return undefined;
  }
  return hit.data as T;
};

export const cacheSet = (key: string, data: unknown, ttlMs = 60_000) => {
  store.set(key, { data, expira: Date.now() + ttlMs });
};

/** Borra todas las entradas cuyo key empiece por el prefijo (o todo si se omite). */
export const cacheClear = (prefix?: string) => {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
};
