/**
 * Cuánto de lo regalado en cada línea ES el empaque que le toca al pedido.
 *
 * Regalar la bolsa y el perfumero que corresponden no es un descuento: es lo
 * que la venta lleva (dueño, 2026-10-04). Regalar más de eso, o regalar un
 * perfume, sí lo es y espera su aprobación (`controlPrecio.ts`).
 *
 * El cupo se reparte en el orden de las líneas: dos líneas del mismo accesorio
 * comparten el mismo cupo, no lo duplican.
 */
export const regaloDeEmpaque = (
  lineas: { perfume_id: number; regalo: number }[],
  permitido: Map<number, number>,
): number[] => {
  const queda = new Map(permitido);
  return lineas.map((l) => {
    const cupo = queda.get(l.perfume_id) ?? 0;
    const cubre = Math.min(l.regalo, cupo);
    if (cubre > 0) queda.set(l.perfume_id, cupo - cubre);
    return cubre;
  });
};
