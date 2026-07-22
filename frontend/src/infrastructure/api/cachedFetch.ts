/**
 * GET público con caché en memoria y deduplicación de peticiones en vuelo.
 * Al navegar entre páginas los hooks se re-montan, pero los datos casi
 * estáticos (lookups, combos, destacados, anuncios) no cambian entre página
 * y página: se sirven de memoria durante un TTL corto. Y si dos hooks piden
 * la misma URL a la vez (pasa en el home), viaja UNA sola petición.
 */
const memoria = new Map<string, { exp: number; data: unknown }>();
const enVuelo = new Map<string, Promise<unknown>>();

const TTL_DEFECTO = 4 * 60 * 1000;

export function fetchJsonCached<T = unknown>(url: string, ttlMs: number = TTL_DEFECTO): Promise<T> {
  const hit = memoria.get(url);
  if (hit && hit.exp > Date.now()) return Promise.resolve(hit.data as T);

  const pendiente = enVuelo.get(url);
  if (pendiente) return pendiente as Promise<T>;

  const promesa = (async () => {
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (res.ok) memoria.set(url, { exp: Date.now() + ttlMs, data: json });
      return json;
    } finally {
      enVuelo.delete(url);
    }
  })();
  enVuelo.set(url, promesa);
  return promesa as Promise<T>;
}
