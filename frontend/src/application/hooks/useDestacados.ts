import { useEffect, useState } from 'react';
import type { Perfume } from '../../domain/entities/perfume.schema';
import { http } from '../../infrastructure/api/http';
import { urls } from '../../infrastructure/api/urls';

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
    (async () => {
      // Sección opcional: si falla, el home sigue funcionando y las dos franjas
      // simplemente no aparecen. No lleva aviso a propósito — es la primera
      // pantalla de la tienda y no afirma nada que pueda ser mentira.
      const res = await http.getCacheado<{
        data?: { nuevos?: Perfume[]; mas_vendidos?: PerfumeVendido[] };
      }>(urls.perfumes.destacados);
      if (!vivo) return;
      setNuevos(res.cuerpo?.data?.nuevos ?? []);
      setMasVendidos(res.cuerpo?.data?.mas_vendidos ?? []);
    })();
    return () => { vivo = false; };
  }, []);

  return { nuevos, masVendidos };
}
