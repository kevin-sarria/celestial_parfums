import { useEffect, useState } from 'react';
import type { Perfume } from '../../domain/entities/perfume.schema';
import { BASE_URL } from '../../infrastructure/api/client';
import { fetchJsonCached } from '../../infrastructure/api/cachedFetch';

export interface PerfumeVendido extends Perfume {
  unidades_vendidas: number;
}

/**
 * Destacados del catálogo: nuevos lanzamientos (<30 días) y los más vendidos
 * (calculados automáticamente de las ventas enlazadas a perfumes).
 */
export function useDestacados() {
  const [nuevos, setNuevos] = useState<Perfume[]>([]);
  const [masVendidos, setMasVendidos] = useState<PerfumeVendido[]>([]);

  useEffect(() => {
    let vivo = true;
    fetchJsonCached<{ data?: { nuevos?: Perfume[]; mas_vendidos?: PerfumeVendido[] } }>(
      `${BASE_URL}/api/parfums/destacados`,
    )
      .then((json) => {
        if (!vivo) return;
        setNuevos(json.data?.nuevos ?? []);
        setMasVendidos(json.data?.mas_vendidos ?? []);
      })
      .catch(() => {}); // sección opcional: si falla, el home sigue funcionando
    return () => { vivo = false; };
  }, []);

  return { nuevos, masVendidos };
}
