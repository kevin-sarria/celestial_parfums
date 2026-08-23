/**
 * Comprobar un texto contra un enum de Prisma.
 *
 * Antes esto se hacía con `tipo as any`, y ese cast no es un detalle de
 * estilo: es justo **la validación apagada**. Un Excel con la columna "tipo"
 * mal escrita pasaba el `as any` sin chistar y reventaba en la base con un
 * error de MySQL — feo de leer y ya con la fila a medio importar.
 *
 * Prisma genera cada enum como un objeto (`InsumoTipo.envase === 'envase'`),
 * así que sus valores se pueden mirar en tiempo de ejecución. Estos dos
 * ayudantes hacen eso, y devuelven el valor YA con el tipo del enum: quien
 * llama no necesita ningún cast.
 */

/** Los valores del enum, como texto, para armar mensajes de error. */
export const valoresDeEnum = (miembros: Record<string, string>): string[] => Object.values(miembros);

/**
 * Devuelve el valor del enum si `texto` es uno de sus miembros; `null` si no.
 * Compara en minúsculas y cambiando los espacios por guion bajo, porque casi
 * siempre viene de un Excel escrito a mano: quien teclea "Materia Prima" está
 * diciendo `materia_prima`, y ningún miembro de un enum lleva espacios, así
 * que la traducción no puede confundir a uno con otro.
 */
export const aEnum = <T extends Record<string, string>>(
  miembros: T,
  texto: unknown,
): T[keyof T] | null => {
  const limpio = String(texto ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  return valoresDeEnum(miembros).includes(limpio) ? (limpio as T[keyof T]) : null;
};
