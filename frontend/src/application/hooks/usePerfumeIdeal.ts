import { useCallback, useEffect, useState } from 'react';
import { BASE_URL, authFetchWithRefresh } from '../../infrastructure/api/client';
import { useAuthContext } from '../context/useAuthContext';
import type { Perfume } from '../../domain/entities/perfume.schema';

/** Respuestas del quiz "Tu perfume ideal" (todo opcional). */
export interface FiltrosIdeal {
  genero: 'dama' | 'caballero' | 'unisex' | null;
  edad: '18-25' | '26-35' | '36-50' | '50+' | null;
  ocasiones: number[];
  aromas: number[];
  categorias: number[];
  presupuesto: number | null;
  intensidad: 'suave' | 'media' | 'fuerte' | null;
}

export const filtrosVacios = (): FiltrosIdeal => ({
  genero: null, edad: null, ocasiones: [], aromas: [], categorias: [],
  presupuesto: null, intensidad: null,
});

export interface PerfumeRecomendado extends Perfume {
  /** Afinidad 0-100 con el perfil de la persona. */
  puntaje: number;
  razones: string[];
}

export interface RecomendacionGuardada {
  filtros: FiltrosIdeal;
  calculado_en: string;
  items: PerfumeRecomendado[];
}

/**
 * "Tu perfume ideal" (solo registrados): el cálculo queda guardado por usuario,
 * así que al volver al apartado se muestra de una vez sin recalcular; solo se
 * recalcula cuando la persona cambia sus respuestas.
 */
export function usePerfumeIdeal() {
  const { user } = useAuthContext();
  const [guardada, setGuardada] = useState<RecomendacionGuardada | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let vivo = true;
    (async () => {
      try {
        const res = await authFetchWithRefresh(`${BASE_URL}/api/recomendaciones`);
        const json = await res.json();
        if (vivo) setGuardada(json.data ?? null);
      } catch { /* sin guardado: la página arranca en el quiz */ }
      finally { if (vivo) setLoading(false); }
    })();
    return () => { vivo = false; };
  }, [user]);

  /** Calcula (o recalcula) y guarda el resultado en el perfil. */
  const calcular = useCallback(async (filtros: FiltrosIdeal): Promise<RecomendacionGuardada> => {
    const res = await authFetchWithRefresh(`${BASE_URL}/api/recomendaciones`, {
      method: 'POST',
      body: JSON.stringify(filtros),
      headers: { 'Content-Type': 'application/json' },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'No se pudo calcular tu perfume ideal');
    setGuardada(json.data);
    return json.data;
  }, []);

  return { guardada, loading, calcular };
}
