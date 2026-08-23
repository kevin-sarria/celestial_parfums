import { r3, r4 } from '../utils/redondeo';

/**
 * Cuánto cuesta de verdad lo que compraste: la unidad en que te facturan, el
 * IVA y el flete repartido.
 *
 * Salió de `inventario.repository.ts` (iba en 683 líneas) porque es **cálculo
 * puro**: no toca la base de datos ni sabe qué es un movimiento. Eso lo hace
 * fácil de probar solo con números —`inventario.iva.test.ts` no necesita
 * MySQL— y es justo lo que se quiere de lo que toca dinero.
 */

/**
 * Cuánto vale UNA unidad de compra en la unidad base del insumo (ml o piezas).
 *
 * Los proveedores facturan ml y gramos **1 a 1** (así lo maneja el sector), por
 * eso `g` no lleva densidad. Los **litros SÍ multiplican por 1000**: sin esto,
 * teclear "20 L" de alcohol se registraba como 20 ml y el costo por ml quedaba
 * mil veces inflado — con el diluyente siendo casi la mitad del volumen de un
 * frasco, eso solo daba costos de producción absurdos.
 */
export const FACTOR_UNIDAD: Record<string, number> = {
  ml: 1,
  g: 1,
  l: 1000,
  kg: 1000,
  unidad: 1,
};

export const aBase = (cantidad: number, unidad: string) =>
  r3(cantidad * (FACTOR_UNIDAD[unidad] ?? 1));

export type IvaModo = 'incluido' | 'agregado' | 'sin_iva';

/** Cómo se liquida el IVA de una compra, resuelto contra el proveedor. */
export interface IvaCompra {
  modo: IvaModo;
  tasa: number;
  /** true = el negocio lo descuenta ante la DIAN, así que NO es costo. */
  descontable: boolean;
}

/**
 * Parte un valor de línea en base gravable e IVA, según cómo factura ESE proveedor.
 *
 * Existe porque el IVA no es global: el distribuidor principal entrega el precio
 * ya con impuesto, otros lo suman aparte y las compras al exterior no lo cobran.
 * Aplicarle 19% a todos contaría el impuesto dos veces con el proveedor más grande.
 */
export const desglosarIva = (subtotal: number, modo: IvaModo, tasa: number) => {
  if (modo === 'sin_iva' || tasa <= 0) return { base: r4(subtotal), iva: 0 };
  if (modo === 'agregado') return { base: r4(subtotal), iva: r4(subtotal * tasa) };
  const base = subtotal / (1 + tasa); // 'incluido': el valor ya lo trae dentro
  return { base: r4(base), iva: r4(subtotal - base) };
};

/**
 * Cuánto cuesta de verdad una unidad de cada línea de la compra.
 *
 * Suma lo que se pagó: el material, su IVA (cuando no se descuenta) y la parte
 * proporcional del flete. El prorrateo del transporte se hace sobre el valor CON
 * impuesto, que es lo que de verdad pesa cada línea en la factura.
 *
 * Devuelve el costo por unidad BASE (por ml, no por litro), que es como se valora
 * el inventario y como lo consumen las fórmulas.
 *
 * `iva` es opcional: sin él se comporta exactamente igual que antes.
 */
export const costosConFlete = (
  lineas: { cantidad: number; subtotal: number; unidad_compra?: string }[],
  flete: number,
  iva?: IvaCompra,
): number[] => {
  // Costo = base gravable + el IVA SOLO si no se descuenta.
  // Ojo: no es `subtotal + iva`. Con el modo `incluido` el subtotal ya trae el
  // impuesto dentro, así que sumárselo lo contaría dos veces — que es
  // precisamente el error que esta función existe para evitar.
  const valores = lineas.map((l) => {
    if (!iva) return l.subtotal;
    const { base, iva: impuesto } = desglosarIva(l.subtotal, iva.modo, iva.tasa);
    return iva.descontable ? base : base + impuesto;
  });
  const total = valores.reduce((s, v) => s + v, 0);
  return lineas.map((l, i) => {
    const base = aBase(l.cantidad, l.unidad_compra ?? 'unidad');
    if (base <= 0) return 0;
    const parteFlete = total > 0 ? (valores[i] / total) * flete : 0;
    return r4((valores[i] + parteFlete) / base);
  });
};
