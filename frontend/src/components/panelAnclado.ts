import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

/** Aire entre el campo y el panel. */
const MARGEN = 4;
/** Aire mínimo contra los bordes de la pantalla. */
const AIRE_BORDE = 12;
/**
 * Hasta cuánto puede crecer el panel de un campo CHICO para que su texto quepa.
 *
 * El 2026-09-27 se dejó crecer el panel hasta el ancho de su texto, para que el
 * campo "Filas" (80 px) no cortara "25" en "2…". En un campo ancho eso sacaba
 * la lista por fuera del campo —"+ Crear producto nuevo (no está en el
 * catálogo)" la estiraba hasta el borde de la pantalla— y el dueño lo vio como
 * un desfase (2026-09-28). Ahora solo crece un campo más angosto que esto; uno
 * más ancho mide exactamente lo que su campo.
 */
const ANCHO_CAMPO_CHICO = 176;

interface Caja { top: number; left: number; width: number; anchoMax: number; alto: number; arriba: boolean }

/**
 * Un panel que flota pegado a un campo: el desplegable y el calendario.
 *
 * Salió de `BuscadorSelect` cuando llegó el selector de fecha (2026-09-28):
 * los dos necesitan lo mismo —colgarse del diálogo, colocarse a mano, seguir
 * al campo al desplazar, cerrarse con un clic fuera— y copiar esas reglas
 * habría dejado dos versiones que el primer arreglo separaría.
 *
 * @param alto  Alto máximo del panel; se acota al hueco que haya en pantalla.
 * @param ancho Ancho FIJO (el calendario). Sin él, el ancho del campo.
 */
export function usePanelAnclado({ alto, ancho }: { alto: number; ancho?: number }) {
  const contRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [caja, setCaja] = useState<Caja>({ top: 0, left: 0, width: 0, anchoMax: 0, alto, arriba: false });
  /**
   * Dónde se cuelga el panel: dentro del diálogo si lo hay, si no en el <body>.
   *
   * **Dentro de un modal tiene que ser el diálogo, y no es cosmético.** Radix
   * atrapa el foco dentro del diálogo: colgando del <body>, al escribir en el
   * buscador Radix devolvía el foco al campo anterior y las letras se iban ahí
   * — en un recorrido el nombre del cliente quedó guardado como
   * "Cliente del recorridoVentas 1".
   *
   * Se resuelve al ABRIR, en el manejador del clic, y no en un efecto
   * posterior: React agrupa ese `setState` con el de abrir, así que el panel ya
   * nace en su sitio definitivo. Calculado después, se montaba primero en el
   * <body> y se remontaba en el diálogo — y al remontarse, el campo de búsqueda
   * es otro nodo del DOM y el foco se perdía.
   */
  const [anfitrion, setAnfitrion] = useState<HTMLElement | null>(null);

  const abrir = () => {
    setAnfitrion(contRef.current?.closest<HTMLElement>('[data-slot="dialog-content"]') ?? null);
    setAbierto(true);
  };
  const cerrar = () => setAbierto(false);

  /**
   * Dónde pintar el panel. Se calcula a mano porque el panel se pinta FUERA
   * del formulario (en un portal) y no puede colocarse solo respecto al campo.
   */
  const recolocar = useCallback(() => {
    const r = contRef.current?.getBoundingClientRect();
    if (!r) return;
    // Colgado del diálogo, las coordenadas van respecto a ÉL, no a la pantalla.
    const origen = contRef.current?.closest<HTMLElement>('[data-slot="dialog-content"]')?.getBoundingClientRect();
    const dx = origen?.left ?? 0;
    const dy = origen?.top ?? 0;

    // El hueco se mide contra lo que de verdad se VE: en el iPhone el teclado
    // tapa media pantalla sin cambiar `innerHeight`; `visualViewport` sí se encoge.
    const vista = window.visualViewport;
    const techo = vista?.offsetTop ?? 0;
    const piso = vista ? vista.offsetTop + vista.height : window.innerHeight;
    const abajo = piso - r.bottom - MARGEN - AIRE_BORDE;
    const arriba = r.top - techo - MARGEN - AIRE_BORDE;
    // Hacia arriba solo si abajo no cabe y arriba se ve más.
    const haciaArriba = abajo < alto && arriba > abajo;

    const pantalla = window.innerWidth;
    // Ancho fijo: nunca más que la pantalla, y corrido a la izquierda si por
    // la derecha no cabe (un calendario pegado al borde derecho de un modal).
    const width = ancho ? Math.min(Math.max(r.width, ancho), pantalla - 2 * AIRE_BORDE) : r.width;
    const left = ancho ? Math.max(AIRE_BORDE, Math.min(r.left, pantalla - AIRE_BORDE - width)) : r.left;

    setCaja({
      top: (haciaArriba ? r.top - MARGEN : r.bottom + MARGEN) - dy,
      left: left - dx,
      width,
      anchoMax: ancho
        ? width
        : Math.max(r.width, Math.min(ANCHO_CAMPO_CHICO, pantalla - r.left - AIRE_BORDE)),
      alto: Math.max(120, Math.min(alto, haciaArriba ? arriba : abajo)),
      arriba: haciaArriba,
    });
  }, [alto, ancho]);

  // Antes de pintar: el panel nace en su sitio, sin un cuadro en (0,0).
  useLayoutEffect(() => { if (abierto) recolocar(); }, [abierto, recolocar]);

  /**
   * Mientras está abierto, el panel sigue al campo. El `true` captura el scroll
   * de CUALQUIER contenedor (un modal que se desplaza), no solo el de la ventana.
   */
  useEffect(() => {
    if (!abierto) return;
    const vista = window.visualViewport;
    window.addEventListener('scroll', recolocar, true);
    window.addEventListener('resize', recolocar);
    vista?.addEventListener('resize', recolocar);
    vista?.addEventListener('scroll', recolocar);
    return () => {
      window.removeEventListener('scroll', recolocar, true);
      window.removeEventListener('resize', recolocar);
      vista?.removeEventListener('resize', recolocar);
      vista?.removeEventListener('scroll', recolocar);
    };
  }, [abierto, recolocar]);

  // Clic fuera: se cierra. El panel cuenta como "dentro" aunque viva en otra
  // parte del documento; si no, elegir una opción lo cerraría antes de tiempo.
  useEffect(() => {
    if (!abierto) return;
    const onDoc = (e: PointerEvent) => {
      const destino = e.target as Node;
      if (contRef.current?.contains(destino) || panelRef.current?.contains(destino)) return;
      setAbierto(false);
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [abierto]);

  const estiloPanel: CSSProperties = {
    // `absolute` dentro del diálogo (que ya es su bloque contenedor) y `fixed`
    // cuando cuelga del documento.
    position: anfitrion ? 'absolute' : 'fixed',
    top: caja.top,
    left: caja.left,
    ...(ancho
      ? { width: caja.width }
      : { minWidth: caja.width, width: 'max-content', maxWidth: caja.anchoMax }),
    maxHeight: caja.alto,
    // Hacia arriba: se ancla por abajo para crecer en esa dirección.
    transform: caja.arriba ? 'translateY(-100%)' : undefined,
    // IMPRESCINDIBLE en un modal: Radix apaga los clics de todo lo que cuelga
    // del <body> fuera del diálogo, y el panel se VEÍA pero no se podía tocar.
    pointerEvents: 'auto',
  };

  return {
    contRef, panelRef, abierto, abrir, cerrar, estiloPanel,
    /** Dónde montar el portal. */
    destino: () => anfitrion ?? document.body,
  };
}

/**
 * Por encima de CUALQUIER cosa que lo contenga: un modal (z-50), el filtro de
 * una columna o el tooltip de la tabla (z-100). Con z-60 el desplegable que vive
 * dentro del filtro de "Referencia" se abría tapado por el propio recuadro.
 */
export const CAPA_PANEL = 'z-[110]';
