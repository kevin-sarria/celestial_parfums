import { useEffect, useState } from 'react';
import type { Perfume } from '../../domain/entities/perfume.schema';
import { BASE_URL } from '../../infrastructure/api/client';

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
    const ac = new AbortController();
    fetch(`${BASE_URL}/api/parfums/destacados`, { signal: ac.signal })
      .then((r) => r.json())
      .then((json) => {
        setNuevos(json.data?.nuevos ?? []);
        setMasVendidos(json.data?.mas_vendidos ?? []);
      })
      .catch(() => {}); // sección opcional: si falla, el home sigue funcionando
    return () => ac.abort();
  }, []);

  return { nuevos, masVendidos };
}
