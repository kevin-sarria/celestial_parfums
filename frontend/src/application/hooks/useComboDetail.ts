import { useEffect, useState } from 'react';
import type { Combo } from '../../domain/entities/combo.schema';
import { BASE_URL } from '../../infrastructure/api/client';

export function useComboDetail(slug: string | undefined) {
  const [combo, setCombo] = useState<Combo | null>(null);
  const [related, setRelated] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError('');

    const encoded = encodeURIComponent(slug);

    Promise.all([
      fetch(`${BASE_URL}/api/combos/by-slug/${encoded}`).then((r) => r.json()),
      fetch(`${BASE_URL}/api/combos/by-slug/${encoded}/related`).then((r) => r.json()),
    ])
      .then(([mainJson, relatedJson]) => {
        if (mainJson.error) { setError(mainJson.error); return; }
        setCombo(mainJson.data);
        setRelated(relatedJson.data ?? []);
      })
      .catch(() => setError('No se pudo cargar el combo'))
      .finally(() => setLoading(false));
  }, [slug]);

  return { combo, related, loading, error };
}
