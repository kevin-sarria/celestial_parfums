import { toast } from 'sonner';

/**
 * LO QUE EL SERVIDOR AVISA DESPUÉS DE GUARDAR UNA VENTA O UN CRÉDITO.
 *
 * Son cosas que no impiden guardar pero que el dueño tiene que saber: vendió un
 * 1.1 sin tenerlo armado, o una línea no se pudo costear. El servidor las
 * devuelve en `avisos` y aquí se enseñan.
 *
 * Existe porque antes se calculaban y **nadie las leía**: `consumirPorVenta` ya
 * devolvía la lista y quien llamaba se quedaba solo con el costo. Una venta que
 * no descontó nada se veía exactamente igual de bien que una normal.
 *
 * Van como `toast.warning` y con más tiempo del normal: es información que hay
 * que alcanzar a leer, no un "guardado" que se puede perder.
 */
/** La parte de la respuesta que interesa aquí: el resto lo ignora quien llama. */
export interface Respuesta { avisos?: string[] }

export const mostrarAvisos = (cuerpo: Respuesta | null | undefined) => {
  const avisos = cuerpo?.avisos ?? [];
  avisos.forEach((texto, i) => {
    toast.warning(texto, { id: `aviso-inventario-${i}`, duration: 12_000 });
  });
  return avisos.length;
};
