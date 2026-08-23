import { useEffect, useState } from 'react';
import { http } from '../../infrastructure/api/http';

/** Las dos rutas de una ficha. Se pasa un objeto ESTABLE (definido fuera del
 *  componente): si se crea en cada render, el efecto se dispara sin parar. */
export interface RutasDetalle {
  uno: (slug: string) => string;
  relacionados: (slug: string) => string;
}

/**
 * La ficha pública de un producto y sus relacionados, buscados por slug.
 *
 * Existe porque `usePerfumeDetail` y `useComboDetail` eran EXACTAMENTE el mismo
 * archivo dos veces: las dos peticiones en paralelo, el mismo manejo del error y
 * el mismo cuidado con la respuesta que llega tarde. Lo único distinto eran la
 * entidad y sus dos rutas, así que eso es lo único que se recibe por parámetro.
 * Cada hook sigue existiendo como envoltorio de tres líneas, para que las
 * pantallas sigan leyendo `perfume` y `combo` y no un `item` genérico.
 */
export function useDetallePorSlug<T>(slug: string | undefined, rutas: RutasDetalle) {
  const [item, setItem] = useState<T | null>(null);
  const [related, setRelated] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    const ac = new AbortController();
    setLoading(true);
    setError('');

    (async () => {
      const [uno, rel] = await Promise.all([
        http.get<{ data: T | null }>(rutas.uno(slug), { signal: ac.signal }),
        http.get<{ data: T[] }>(rutas.relacionados(slug), { signal: ac.signal }),
      ]);
      /**
       * Cancelada: el visitante ya cambió de ficha o se fue de la pantalla.
       * Sin esta guarda le pintaríamos el error de una petición que él mismo
       * anuló, y encima sobre el producto que está mirando AHORA.
       */
      if (ac.signal.aborted) return;

      if (!uno.ok) { setError(uno.error); setLoading(false); return; }
      setItem(uno.cuerpo?.data ?? null);
      // Los relacionados son un extra: si fallan solos, la ficha se ve igual.
      setRelated(rel.cuerpo?.data ?? []);
      setLoading(false);
    })();

    return () => ac.abort();
  }, [slug, rutas]);

  return { item, related, loading, error };
}
