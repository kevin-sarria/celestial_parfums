/**
 * Las cuentas de un ranking de reporte: qué filas se ven, cuánto pesa cada una y
 * qué tan larga es la cola.
 *
 * Nació de un problema medido en el respaldo del dueño (2026-10-04): el reporte
 * de compras pintaba **127 insumos** y el de ventas **~170 fragancias**, todos
 * seguidos. Con el primero pesando el 4,7 % —y los diez primeros, el 25 %—, la
 * lista no dejaba leer nada y se volvía un scroll interminable.
 */

export interface FilaRanking {
  nombre: string;
  valor: number;
  detalle?: string;
}

/** Cuántas filas se ven antes de agrupar la cola. */
export const TOPE_POR_DEFECTO = 8;

export interface ParteRanking {
  /** Las filas que se pintan. */
  visibles: FilaRanking[];
  /** El mayor valor: es el que manda la escala de la barra. */
  mayor: number;
  /** La suma de TODAS las filas, no solo de las visibles. */
  total: number;
  /** La cola agrupada. null = la lista cabe entera y no se pinta la fila "Otros". */
  cola: { cuantas: number; total: number } | null;
}

export const partirRanking = (filas: FilaRanking[], cuantas = TOPE_POR_DEFECTO): ParteRanking => {
  const total = filas.reduce((s, f) => s + f.valor, 0);
  const visibles = filas.slice(0, Math.max(cuantas, 1));
  const resto = filas.slice(visibles.length);
  return {
    visibles,
    total,
    // Piso 1 para que una lista de puros ceros no divida entre cero.
    mayor: Math.max(...filas.map((f) => f.valor), 1),
    cola: resto.length ? { cuantas: resto.length, total: resto.reduce((s, f) => s + f.valor, 0) } : null,
  };
};

/**
 * El porcentaje sobre el total, con un decimal.
 *
 * Ojo: se mide sobre el TOTAL y no sobre el mayor. La barra compara contra el
 * primero (para aprovechar el ancho), pero el número que sirve para decidir es
 * "esto es el 41 % de lo que gasté", no "esto es la mitad del primero".
 */
export const porcentajeTexto = (parte: number, total: number) => {
  if (total <= 0) return '0 %';
  const crudo = (parte / total) * 100;
  // Un 0,04 % no es "0 %": es "menos de una décima", y la diferencia importa.
  if (crudo > 0 && crudo < 0.1) return '<0,1 %';
  return `${(Math.round(crudo * 10) / 10).toLocaleString('es-CO')} %`;
};
