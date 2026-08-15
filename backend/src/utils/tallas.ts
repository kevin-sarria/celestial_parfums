/**
 * La talla, leída como NÚMERO.
 *
 * Desde el 2026-08-01 el catálogo (`presentaciones`) y el costeo
 * (`formulas_volumen`) se enlazan por el número de mililitros, no por el texto:
 * el mismo tamaño estaba escrito de cinco formas ("30ML", "30 ML", "30ml") y
 * nada casaba. Una talla sin `ml` el sistema la trata como "no es un tamaño" y
 * **no la costea**.
 */

/**
 * Mililitros que dice el nombre de una talla, o null si no dice ninguno.
 *
 * Es EL MISMO corte de la migración `20260801140000_tallas_en_ml`
 * (`^[0-9]+ *[mM][lL]`) y tiene que seguir siéndolo: dos formas de leer el
 * mismo nombre acabarían dando dos números distintos para la misma talla.
 *
 * Devuelve null a propósito en lo que NO es un tamaño:
 *  - `"200/250ML"` es un apaño para marcar splash de 200 **y** de 250; se
 *    separa a mano en dos tallas reales, no se adivina cuál de las dos es.
 *  - `"Combo Personalizado"` no es una talla.
 */
export const mlDelNombre = (nombre: string): number | null => {
  const encontrado = /^(\d+) *ml/i.exec(nombre.trim());
  return encontrado ? Number(encontrado[1]) : null;
};
