/**
 * Los dos redondeos del inventario. Viven aquí porque los usan el libro mayor,
 * el consumo por venta y el costeo de una compra, y tres copias de la misma
 * decisión terminan con tres criterios distintos el día que alguien ajuste uno.
 */

/** Los ml de una fórmula no necesitan más de 3 decimales. */
export const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** El costo unitario sí lleva 4: a $0,0001/ml × 30 ml importa. */
export const r4 = (n: number) => Math.round(n * 10000) / 10000;
