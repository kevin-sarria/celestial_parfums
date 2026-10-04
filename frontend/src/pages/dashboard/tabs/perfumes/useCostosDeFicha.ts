import { useEffect, useState } from 'react';
import { http } from '../../../../infrastructure/api/http';
import { urls } from '../../../../infrastructure/api/urls';
import type { Desglose } from '../preciosOriginales/filas';

/**
 * "TE CUESTA" DE CADA TALLA DE UN ORIGINAL, calculado por el servidor
 * (2026-10-04). Antes la ficha hacía su propia cuenta y le faltaban el frasco
 * de la receta y el empaque: decía un costo distinto al de Precios de
 * originales. Ahora es UNA sola cuenta (`costosDeFicha` en el servidor), que
 * se repite al cambiar la botella, las tallas o un frasco, con una pausa corta
 * para no preguntar con cada tecla.
 */
export function useCostosDeFicha(
  botellaId: number | null,
  tallas: { presentacion_id: number; envase_insumo_id: number | null }[],
) {
  const [costos, setCostos] = useState<Map<number, Desglose | null>>(new Map());
  const firma = JSON.stringify([botellaId, tallas]);

  useEffect(() => {
    if (!botellaId || tallas.length === 0) { setCostos(new Map()); return; }
    let vigente = true;
    const t = setTimeout(async () => {
      try {
        const res = await http.post<{ data: { presentacion_id: number; costo: Desglose | null }[] }>(
          urls.preciosOriginales.costos, { insumo_producto_id: botellaId, tallas },
        );
        if (vigente && res.ok && res.cuerpo) setCostos(new Map(res.cuerpo.data.map(c => [c.presentacion_id, c.costo])));
      } catch { /* sin costo, la ficha sigue: solo no muestra "te cuesta" */ }
    }, 300);
    return () => { vigente = false; clearTimeout(t); };
  }, [firma]); // eslint-disable-line react-hooks/exhaustive-deps

  return costos;
}
