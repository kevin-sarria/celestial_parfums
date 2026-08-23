import { useCallback, useEffect, useState } from 'react';
import { http } from '../../infrastructure/api/http';
import { urls } from '../../infrastructure/api/urls';
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
      // Sin guardado la página arranca en el quiz, que es un comienzo válido y
      // no una mentira: por eso este no avisa. El que sí avisa es `calcular`.
      const res = await http.get<{ data?: RecomendacionGuardada }>(urls.recomendaciones);
      if (!vivo) return;
      setGuardada(res.cuerpo?.data ?? null);
      setLoading(false);
    })();
    return () => { vivo = false; };
  }, [user]);

  /** Calcula (o recalcula) y guarda el resultado en el perfil. */
  const calcular = useCallback(async (filtros: FiltrosIdeal): Promise<RecomendacionGuardada> => {
    const res = await http.post<{ data: RecomendacionGuardada }>(urls.recomendaciones, filtros);
    /**
     * Este SÍ lanza, al revés que el resto de la casa. Es el contrato que ya
     * espera `PerfumeIdealPage`, que lo envuelve en try/catch y enseña el
     * mensaje en su propio recuadro en vez de un toast — el resultado del quiz
     * es la pantalla entera, no un aviso de paso.
     */
    if (!res.ok || !res.cuerpo?.data) throw new Error(res.error || 'No se pudo calcular tu perfume ideal');
    setGuardada(res.cuerpo.data);
    return res.cuerpo.data;
  }, []);

  return { guardada, loading, calcular };
}
