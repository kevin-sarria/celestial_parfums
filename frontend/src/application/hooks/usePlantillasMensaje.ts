import { useEffect, useState } from 'react';
import { http } from '../../infrastructure/api/http';
import { urls } from '../../infrastructure/api/urls';
import type { PlantillaMensaje } from '../mensajes';

/**
 * Los mensajes que el dueño escribió para un caso, cacheados.
 *
 * Los piden dos sitios: la lista de créditos —para saber si el botón de recordar
 * tiene qué mandar— y el modal que lo manda. Van con `getCacheado` y no con
 * `get` para que abrir el modal no repita la petición que ya hizo la pantalla.
 */
export function usePlantillasMensaje(caso: string) {
  const [plantillas, setPlantillas] = useState<PlantillaMensaje[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await http.getCacheado<{ data?: PlantillaMensaje[] }>(
          `${urls.mensajes.lista}?caso=${caso}`,
        );
        if (vivo) setPlantillas(res.cuerpo?.data ?? []);
      } catch {
        // Sin mensajes el botón sale apagado y lo explica: no hay nada que romper.
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, [caso]);

  return { plantillas, cargando };
}
