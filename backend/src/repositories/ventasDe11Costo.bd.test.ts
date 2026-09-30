import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { limpiarBase } from '../test/baseDePrueba';
import { corregirVentasDe11, revisarVentasDe11 } from './ventasDe11Costo';

/**
 * LAS VENTAS DE 1.1 COSTEADAS CON LA BOLSA Y EL PERFUMERO (dueño, 2026-09-29,
 * opción B). Los lotes ya se corrigieron; las ventas que salieron de ellos
 * conservaban el costo viejo. En el respaldo del 22-sep: 11 ventas, $23.250.
 */

const FECHA = new Date('2026-09-10');

const sembrar = async (opciones: { soloArmado?: boolean; ventaAntesDelLote?: boolean } = {}) => {
  const talla = await prisma.presentacion.create({ data: { nombre: '100ML', ml: 100 } });
  const perfume = await prisma.perfume.create({
    data: {
      nombre: 'Khamrah 1.1', precio: 180000, solo_armado: opciones.soloArmado ?? true,
      presentaciones: { create: { presentacion_id: talla.id } },
    },
  });
  const venta = await prisma.venta.create({
    data: {
      dia: FECHA, persona: 'Cliente', cantidad_perfumes: 1, presentacion: '100ML',
      referencia_perfume: 'Khamrah 1.1', valor_venta: 180000, costo_mercancia: 52400,
    },
  });
  const lote = { perfume_id: perfume.id, presentacion_id: talla.id, fecha: FECHA };
  // El lote ya corregido vale 50.000; la venta salió cuando valía 52.400
  const entrada = () => prisma.movimientoTerminado.create({
    data: { ...lote, tipo: 'produccion', cantidad: 1, costo_unitario: 50000, referencia_id: 1 },
  });
  const salida = () => prisma.movimientoTerminado.create({
    data: { ...lote, tipo: 'venta', cantidad: -1, costo_unitario: 52400, referencia_id: venta.id },
  });
  if (opciones.ventaAntesDelLote) { await salida(); await entrada(); } else { await entrada(); await salida(); }
  return venta;
};

const costoDe = async (ventaId: number) =>
  Number((await prisma.venta.findUniqueOrThrow({ where: { id: ventaId } })).costo_mercancia);

describe('corregir el costo de las ventas de 1.1', () => {
  beforeEach(limpiarBase);

  it('baja al costo real del frasco la venta y su movimiento, y la ganancia sube eso', async () => {
    const venta = await sembrar();

    const revision = await revisarVentasDe11();
    expect(revision.valor).toBe(2400);

    await prisma.$transaction((tx) => corregirVentasDe11(tx));

    expect(await costoDe(venta.id)).toBe(50000);
    const mov = await prisma.movimientoTerminado.findFirstOrThrow({ where: { tipo: 'venta' } });
    expect(Number(mov.costo_unitario)).toBe(50000);
  });

  it('corregir dos veces no baja dos veces', async () => {
    const venta = await sembrar();
    await prisma.$transaction((tx) => corregirVentasDe11(tx));
    const segunda = await prisma.$transaction((tx) => corregirVentasDe11(tx));
    expect(segunda.ventas).toBe(0);
    expect(await costoDe(venta.id)).toBe(50000);
  });

  it('no toca una venta que salió sin frasco armado en el libro', async () => {
    const venta = await sembrar({ ventaAntesDelLote: true });
    expect((await revisarVentasDe11()).ventas).toHaveLength(0);
    expect(await costoDe(venta.id)).toBe(52400);
  });

  it('no toca lo que no es 1.1', async () => {
    await sembrar({ soloArmado: false });
    expect((await revisarVentasDe11()).ventas).toHaveLength(0);
  });
});
