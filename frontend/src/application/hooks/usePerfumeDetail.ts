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
    setLoading(true);
    setError('');

    const encoded = encodeURIComponent(slug);

    Promise.all([
      fetch(`${BASE_URL}/api/parfums/by-slug/${encoded}`).then((r) => r.json()),
      fetch(`${BASE_URL}/api/parfums/by-slug/${encoded}/related`).then((r) => r.json()),
    ])
      .then(([mainJson, relatedJson]) => {
        if (mainJson.error) { setError(mainJson.error); return; }
        setPerfume(mainJson.data);
        setRelated(relatedJson.data ?? []);
      })
      .catch(() => setError('No se pudo cargar el perfume'))
      .finally(() => setLoading(false));
  }, [slug]);

  return { perfume, related, loading, error };
}
