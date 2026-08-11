import { useCallback, useEffect, useMemo, useState } from 'react';

const CLAVE = 'celestial:pedido-sugerido:ajustes';

interface Ajustes {
  /** Cantidad tecleada a mano, por id de material. Pisa a la sugerida. */
  cantidades: Record<number, number>;
  /** Materiales que el dueño sacó de ESTE pedido (siguen bajo mínimo). */
  quitados: number[];
}

const VACIO: Ajustes = { cantidades: {}, quitados: [] };

const leer = (): Ajustes => {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return VACIO;
    const dato = JSON.parse(crudo);
    return {
      cantidades: dato?.cantidades ?? {},
      quitados: Array.isArray(dato?.quitados) ? dato.quitados : [],
    };
  } catch {
    // Un JSON corrupto no puede dejar la pantalla inservible
    return VACIO;
  }
};

/**
 * Los retoques del dueño sobre el pedido sugerido: cuánto pedir de verdad de
 * cada material y qué sacar de esta vuelta.
 *
 * **Por qué vive en el navegador y no en la base**: el pedido sugerido es una
 * pantalla que se recalcula del inventario cada vez que se abre, y guardar los
 * ajustes en el servidor la convertiría en otra cosa — un documento de "orden de
 * compra" con su ciclo de vida, que es un módulo aparte y el dueño no lo pidió.
 * En `localStorage` sobreviven a cerrar la pestaña, que es lo que hacía falta:
 * ajustar cantidades, salir, y al día siguiente copiar la lista tal como quedó.
 *
 * **Quitar no es lo mismo que resolver**: el material sigue bajo mínimo y sigue
 * contando en la alerta. Solo no entra en ESTE pedido.
 *
 * Los ajustes se **podan** contra los materiales que hoy están en la lista: uno
 * que ya se repuso deja de estar bajo mínimo y su ajuste viejo no debe revivir
 * si vuelve a bajar dentro de tres meses.
 */
export function useAjustesPedido(idsEnLista: number[]) {
  const [ajustes, setAjustes] = useState<Ajustes>(leer);

  const idsVigentes = useMemo(() => new Set(idsEnLista), [idsEnLista]);

  // Solo escribe; no toca el estado, así que no encadena renders
  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(ajustes));
    } catch {
      // Sin espacio o en modo privado: perder los ajustes no puede romper la pantalla
    }
  }, [ajustes]);

  /** Poda al guardar: lo que ya no está en la lista deja de ocupar sitio. */
  const podar = useCallback((a: Ajustes): Ajustes => ({
    cantidades: Object.fromEntries(
      Object.entries(a.cantidades).filter(([id]) => idsVigentes.has(Number(id))),
    ),
    quitados: a.quitados.filter((id) => idsVigentes.has(id)),
  }), [idsVigentes]);

  const fijarCantidad = useCallback((id: number, cantidad: number | null) => {
    setAjustes((a) => {
      const cantidades = { ...a.cantidades };
      // null = "vuelve a lo que sugiere el sistema"
      if (cantidad == null || !Number.isFinite(cantidad)) delete cantidades[id];
      else cantidades[id] = Math.max(0, cantidad);
      return podar({ ...a, cantidades });
    });
  }, [podar]);

  const quitar = useCallback((id: number) => {
    setAjustes((a) => podar({ ...a, quitados: [...new Set([...a.quitados, id])] }));
  }, [podar]);

  const devolver = useCallback((id: number) => {
    setAjustes((a) => podar({ ...a, quitados: a.quitados.filter((x) => x !== id) }));
  }, [podar]);

  const empezarDeCero = useCallback(() => setAjustes(VACIO), []);

  const cantidadDe = useCallback(
    (id: number, sugerido: number) => ajustes.cantidades[id] ?? sugerido,
    [ajustes.cantidades],
  );

  const fueTocado = useCallback((id: number) => id in ajustes.cantidades, [ajustes.cantidades]);
  const estaQuitado = useCallback((id: number) => ajustes.quitados.includes(id), [ajustes.quitados]);

  const quitadosVigentes = useMemo(
    () => ajustes.quitados.filter((id) => idsVigentes.has(id)),
    [ajustes.quitados, idsVigentes],
  );

  const hayAjustes = Object.keys(ajustes.cantidades).length > 0 || quitadosVigentes.length > 0;

  return {
    cantidadDe, fueTocado, estaQuitado, quitadosVigentes, hayAjustes,
    fijarCantidad, quitar, devolver, empezarDeCero,
  };
}
