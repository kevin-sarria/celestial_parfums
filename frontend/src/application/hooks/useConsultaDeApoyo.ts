import { useCallback, useEffect, useState } from 'react';
import { http } from '../../infrastructure/api/http';

/**
 * UNA CONSULTA DE APOYO: la que alimenta un aviso o una caja que se esconde
 * sola cuando no hay nada que decir.
 *
 * ## Por qué existe (2026-08-29, y costó una semana)
 *
 * Estas secciones se escribían todas igual: pedir, y si algo falla, devolver
 * `null` "porque es información de apoyo y la pantalla principal sigue
 * sirviendo". Suena razonable y **es lo que hizo invisible un despliegue a
 * medias**: el servidor respondía error por una columna que faltaba, el dueño
 * veía una pantalla perfectamente normal sin ningún aviso, y concluyó que la
 * función estaba mal hecha. Estuvo días así.
 *
 * La regla que sale de ahí, y que este hook obliga a cumplir:
 *
 * > Una sección puede callarse cuando **no hay nada que mostrar**. Nunca cuando
 * > **no pudo preguntarlo**. Son dos estados distintos y hay que pintarlos
 * > distinto.
 *
 * Por eso devuelve `fallo` aparte de `dato`: quien lo usa tiene que decidir qué
 * hacer con él, y no puede confundirlo con "no hay nada".
 */
export function useConsultaDeApoyo<T>(url: string, recargarCon?: unknown) {
  const [dato, setDato] = useState<T | null>(null);
  const [fallo, setFallo] = useState(false);
  const [cargando, setCargando] = useState(true);

  const consultar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await http.get<{ data?: T }>(url);
      if (!r.ok) throw new Error(r.error);
      setDato(r.cuerpo?.data ?? null);
      setFallo(false);
    } catch {
      setDato(null);
      setFallo(true);
    } finally {
      setCargando(false);
    }
  }, [url]);

  useEffect(() => {
    let vivo = true;
    // El guarda evita pintar con datos de una consulta que ya no interesa
    // cuando el componente se desmonta a mitad de camino.
    (async () => { if (vivo) await consultar(); })();
    return () => { vivo = false; };
  }, [consultar, recargarCon]);

  return { dato, fallo, cargando, recargar: consultar };
}
