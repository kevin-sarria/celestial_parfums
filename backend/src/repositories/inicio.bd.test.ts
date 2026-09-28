import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { crearVenta, limpiarBase } from '../test/baseDePrueba';
import { hoyEnColombia } from '../utils/fechas';
import { resumenInicio } from './inicio.repository';

/**
 * INICIO no calcula por su cuenta: reúne lo de otras pantallas. Aquí se
 * comprueba lo único que es suyo: qué 1.1 hay que armar.
 */
describe('Inicio', () => {
  beforeEach(limpiarBase);

  it('un 1.1 que se vende y no tiene frascos armados sale primero en "sin armar"', async () => {
    const categoria = await prisma.categoria.create({ data: { nombre: '1.1 Inicio' } });
    const base = { precio: 150000, categoria_id: categoria.id, solo_armado: true, publicado: true };
    const vendido = await prisma.perfume.create({ data: { ...base, nombre: 'Khamrah 1.1' } });
    await prisma.perfume.create({ data: { ...base, nombre: 'Aventus 1.1' } });
    // Uno que no está en la tienda no cuenta
    await prisma.perfume.create({ data: { ...base, nombre: 'Oculto 1.1', publicado: false } });

    const venta = await crearVenta({ dia: hoyEnColombia() });
    await prisma.ventaPerfume.create({ data: { venta_id: venta.id, perfume_id: vendido.id, ml: 100, cantidad: 2 } });

    const r = await resumenInicio();
    expect(r.frascos_11.referencias).toBe(2);
    expect(r.frascos_11.sin_armar.map((f) => f.nombre)).toEqual(['Khamrah 1.1', 'Aventus 1.1']);
    expect(r.frascos_11.sin_armar[0].vendidos).toBe(2);
    // Y la venta entra en el mes, con la misma cuenta del reporte de ventas
    expect(r.mes.ventas.num_ventas).toBe(1);
  });
});
