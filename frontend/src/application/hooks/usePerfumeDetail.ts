import { useEffect, useState } from 'react';
import type { Perfume } from '../../domain/entities/perfume.schema';
import { BASE_URL } from '../../infrastructure/api/client';

export function usePerfumeDetail(slug: string | undefined) {
  const [perfume, setPerfume] = useState<Perfume | null>(null);
  const [related, setRelated] = useState<Perfume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    const ac = new AbortController();
    setLoading(true);
    setError('');

    const encoded = encodeURIComponent(slug);

    Promise.all([
      fetch(`${BASE_URL}/api/parfums/by-slug/${encoded}`, { signal: ac.signal }).then((r) => r.json()),
      fetch(`${BASE_URL}/api/parfums/by-slug/${encoded}/related`, { signal: ac.signal }).then((r) => r.json()),
    ])
      .then(([mainJson, relatedJson]) => {
        if (mainJson.error) { setError(mainJson.error); return; }
        setPerfume(mainJson.data);
        setRelated(relatedJson.data ?? []);
      })
      .catch((e) => { if (e.name !== 'AbortError') setError('No se pudo cargar el perfume'); })
      .finally(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => ac.abort();
  }, [slug]);

  return { perfume, related, loading, error };
}
