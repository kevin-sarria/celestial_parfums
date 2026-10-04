import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { limpiarBase } from '../test/baseDePrueba';
import { precioNormalDelPedido } from './precioPedido';

/**
 * El precio que el servidor considera normal: el de cada talla con el
 * descuento de la página, y el combo cuando sale más barato. Fija los mismos
 * casos que `useComboDetector.test.ts` del frontend, para notar si se separan.
 */
const sembrar = async () => {
  const cat = await prisma.categoria.create({ data: { nombre: 'Contratipo' } });
  const t30 = await prisma.presentacion.create({ data: { nombre: '30ML', ml: 30 } });
  const nuevo = (nombre: string, extra: object = {}) => prisma.perfume.create({
    data: { nombre, precio: 22000, categoria_id: cat.id, presentaciones: { create: { presentacion_id: t30.id } }, ...extra },
  });
  const a = await nuevo('A');
  const b = await nuevo('B');
  const conDescuento = await nuevo('C', { descuento: 10 });
  await prisma.combo.create({ data: { nombre: 'Duo', cantidad: 2, precio: 42000, categoria_id: cat.id, presentacion_id: t30.id } });
  return { a, b, conDescuento };
};

describe('el precio normal de un pedido', () => {
  beforeEach(limpiarBase);

  it('dos de 30 ml arman el Duo: 42.000 y no 44.000', async () => {
    const { a, b } = await sembrar();
    expect(await precioNormalDelPedido([{ perfume_id: a.id, ml: 30, cantidad: 1 }, { perfume_id: b.id, ml: 30, cantidad: 1 }])).toBe(42000);
  });

  it('uno solo va a su precio; el que tiene descuento propio no entra al combo', async () => {
    const { a, conDescuento } = await sembrar();
    expect(await precioNormalDelPedido([{ perfume_id: a.id, ml: 30, cantidad: 1 }])).toBe(22000);
    // 22.000 + 19.800 (con su 10 %): no se acumulan descuentos
    expect(await precioNormalDelPedido([{ perfume_id: a.id, ml: 30, cantidad: 1 }, { perfume_id: conDescuento.id, ml: 30, cantidad: 1 }])).toBe(41800);
  });
});
