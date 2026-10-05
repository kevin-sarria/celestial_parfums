import { useEffect, useState } from 'react';
import type { Combo } from '../../domain/entities/combo.schema';
import { http } from '../../infrastructure/api/http';
import { urls } from '../../infrastructure/api/urls';

/**
 * Los combos activos del catálogo, cacheados.
 *
 * Vive aparte porque lo piden DOS sitios: el carrito (para detectar el combo que
 * ya se armó) y la ficha de un perfume (para ofrecerlo ANTES de agregar el segundo).
 * `habilitado` existe para que el carrito no lo pida hasta que haga falta.
 */
export function useCombosActivos(habilitado = true) {
  const [combos, setCombos] = useState<Combo[]>([]);

  useEffect(() => {
    if (!habilitado || combos.length > 0) return;
    let vivo = true;
    (async () => {
      // Sin combos no hay detección y la pantalla sigue normal, a precio de lista.
      const res = await http.getCacheado<{ data?: Combo[] }>(urls.combos.todos);
      if (vivo) setCombos((res.cuerpo?.data ?? []).filter((c) => c.activo));
    })();
    return () => { vivo = false; };
  }, [habilitado, combos.length]);

  return combos;
}
