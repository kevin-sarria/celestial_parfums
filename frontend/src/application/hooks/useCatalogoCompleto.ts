import { useEffect, useState } from 'react';
import { http } from '../../infrastructure/api/http';
import { urls } from '../../infrastructure/api/urls';
import type { Perfume } from '../../domain/entities/perfume.schema';

/**
 * El catálogo ENTERO del dashboard —publicado o no—, para los buscadores que
 * eligen un producto: el kit de un combo, "copiar la ficha de…".
 *
 * Va cacheado (`getCacheado`): varias piezas lo piden en la misma pantalla y el
 * catálogo no cambia mientras se llena un formulario. `activo = false` no pide
 * nada, para los formularios que solo lo necesitan en una de sus ramas.
 *
 * `perfumes` es null mientras carga; `error` dice si falló, para que la pieza
 * lo explique en vez de quedarse en "Cargando…".
 */
export function useCatalogoCompleto(activo = true) {
  const [perfumes, setPerfumes] = useState<Perfume[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    (async () => {
      try {
        const res = await http.getCacheado<{ data: { data: Perfume[] } | Perfume[] }>(urls.perfumes.todosConOcultos);
        // /api/parfums sin paginar responde { data: { data: [...] } }
        const pf = res.cuerpo?.data;
        const lista = Array.isArray(pf) ? pf : (pf?.data ?? []);
        if (vivo) setPerfumes([...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
      } catch { if (vivo) setError(true); }
    })();
    return () => { vivo = false; };
  }, [activo]);

  return { perfumes, error };
}
