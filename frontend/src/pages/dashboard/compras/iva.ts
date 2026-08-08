import type { IvaModo } from '../types';

/**
 * Cómo se le llama a cada modo en el idioma del dueño, no del sistema.
 *
 * Vive aparte del componente a propósito: un archivo que exporta un componente
 * Y constantes rompe la recarga en caliente de Vite.
 */
export const IVA_MODOS: { valor: IvaModo; etiqueta: string; ayuda: string }[] = [
  { valor: 'incluido', etiqueta: 'El precio ya trae el IVA', ayuda: 'Lo que te cobran es el total final.' },
  { valor: 'agregado', etiqueta: 'Se le suma el IVA', ayuda: 'Te dan el parcial y el impuesto aparte.' },
  { valor: 'sin_iva', etiqueta: 'No cobra IVA', ayuda: 'Compras al exterior o a persona natural.' },
];

/**
 * Base gravable e IVA de un valor, según cómo factura el proveedor.
 *
 * Es SOLO para mostrar la cuenta antes de guardar: el número que manda es el
 * que calcula el servidor (`desglosarIva` en inventario.repository), que además
 * lo congela en la compra.
 */
export const desglosarIva = (valor: number, modo: IvaModo, tasa: number) => {
  if (modo === 'sin_iva' || tasa <= 0) return { base: valor, iva: 0, total: valor };
  if (modo === 'agregado') return { base: valor, iva: valor * tasa, total: valor * (1 + tasa) };
  const base = valor / (1 + tasa);
  return { base, iva: valor - base, total: valor };
};
