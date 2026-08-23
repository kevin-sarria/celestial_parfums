import { createContext, useContext, useEffect, useId } from 'react';

/**
 * El puente entre la etiqueta de un campo y su control.
 *
 * El problema que resuelve: `Field` (dashboard/ui.tsx) pintaba un `<label>`
 * suelto, sin `htmlFor`, así que **ni el navegador ni un lector de pantalla lo
 * asociaban al campo**. Se perdían dos cosas: hacer clic en "Nombre" no llevaba
 * el cursor a su casilla, y quien navega a ciegas oía "cuadro de edición" sin
 * saber de qué.
 *
 * Se hizo al revés de lo obvio —**el control avisa hacia arriba, la etiqueta no
 * manda hacia abajo**— por dos razones:
 *
 * 1. Los 230 usos de `Field` no cambian ni una línea. Con la etiqueta mandando
 *    el id, cada control tendría que recibirlo y colocarlo a mano.
 * 2. **Nunca queda un `htmlFor` que apunte al vacío.** Hay campos que envuelven
 *    un grupo (las casillas de aromas, el editor de HTML) donde no existe un
 *    control al que enlazarse; ahí sencillamente no se registra nadie y la
 *    etiqueta se queda como estaba. Un `htmlFor` roto es peor que ninguno:
 *    promete una relación que no existe.
 *
 * Si un campo lleva varios controles (fecha desde/hasta, el color y su hex),
 * **se queda con la etiqueta el primero**, que es el orden en que se leen.
 */
export interface RegistroDeCampo {
  /** El `id` del `<label>`, para los controles que necesitan citarlo. */
  idEtiqueta: string;
  registrar: (id: string) => void;
  soltar: (id: string) => void;
}

export const CampoEtiquetaContext = createContext<RegistroDeCampo | null>(null);

/**
 * Devuelve el `id` con el que este control se enlaza a la etiqueta de su campo,
 * y lo anuncia hacia arriba. Un `id` puesto a mano en la pantalla siempre gana.
 *
 * Fuera de un `Field` no hay a quién avisar: devuelve un id propio y ya.
 */
export function useIdDeCampo(idPropio?: string): string {
  const generado = useId();
  const id = idPropio ?? generado;
  const campo = useContext(CampoEtiquetaContext);

  useEffect(() => {
    if (!campo) return;
    campo.registrar(id);
    return () => campo.soltar(id);
  }, [campo, id]);

  return id;
}

/**
 * El `id` del `<label>` del campo, para un control que **no puede dejar que la
 * etiqueta le robe el nombre**.
 *
 * Pasa con los desplegables: el nombre de un `<button>` sale de su texto —el
 * valor elegido, "Sin asignar"—, pero una etiqueta enlazada lo pisa y manda
 * ella. El resultado sería un lector de pantalla diciendo "Esencia, botón" sin
 * decir NUNCA qué hay elegido. Citando `"<etiqueta> <control>"` se anuncian las
 * dos cosas: "Esencia, Sin asignar".
 */
export function useIdDeEtiqueta(): string | undefined {
  return useContext(CampoEtiquetaContext)?.idEtiqueta;
}
