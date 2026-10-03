import { useEffect, useLayoutEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Una tabla que abre ya filtrada: si la URL trae `?buscar=texto`, se escribe
 * ese texto en su buscador y se quita de la URL.
 *
 * Lo usa el buscador general del panel (2026-10-02): al elegir "Venta #812 ·
 * Ana" lleva a Ventas con "Ana" ya buscado, en vez de dejar al dueño en la
 * pestaña con la lista entera. Se quita de la URL para que recargar o volver
 * atrás no lo vuelva a escribir encima de lo que ya cambió a mano.
 * Sin el parámetro, no hace nada.
 */
export function useBuscarDeUrl(aplicar: (texto: string) => void) {
  const [params, setParams] = useSearchParams();
  const buscar = params.get('buscar');
  const aplicarRef = useRef(aplicar);
  useLayoutEffect(() => { aplicarRef.current = aplicar; });

  useEffect(() => {
    if (buscar == null) return;
    aplicarRef.current(buscar);
    setParams((p) => { p.delete('buscar'); return p; }, { replace: true });
  }, [buscar, setParams]);
}
