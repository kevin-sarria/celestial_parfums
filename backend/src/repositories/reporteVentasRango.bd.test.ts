import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { crearCliente, crearInsumo, limpiarBase } from '../test/baseDePrueba';
import { addAbono, createCredito } from './credito.repository';
import { reporteVentasRango } from './reporteVentasRango';

/**
 * EL REPORTE DE VENTAS CUENTA SOLO LO DE SUS FECHAS.
 *
 * La aritmética está probada aparte (`reporteVentasRango.calculo.test.ts`);
 * aquí se prueba que las consultas traigan lo que deben: el rango con sus dos
 * bordes incluidos, y la deuda de un crédito descontando lo ya abonado.
 */

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const venta = (dia: string, valor: number, costo: number, pagada = true) => prisma.venta.create({
  data: {
    dia: d(dia), persona: 'Prueba', cantidad_perfumes: 1, presentacion: '30 ml',
    referencia_perfume: 'X', valor_venta: valor, pagada, costo_mercancia: costo,
  },
});

describe('reporteVentasRango', () => {
  beforeEach(limpiarBase);

  it('incluye los dos bordes del rango y nada de fuera', async () => {
    await venta('2026-08-31', 999000, 1);   // fuera
    await venta('2026-09-01', 100000, 40000); // borde de inicio
    await venta('2026-09-30', 50000, 20000);  // borde final
    await venta('2026-10-01', 999000, 1);   // fuera

    const r = await reporteVentasRango(d('2026-09-01'), d('2026-09-30'));
    expect(r.ventas.vendido).toBe(150000);
    expect(r.ventas.ganancia).toBe(90000);
    expect(r.meses.map((m) => m.mes)).toEqual(['2026-09']);
  });

  it('un crédito a medio pagar: fuera de "vendido" y en deuda por lo que falta', async () => {
    const cliente = await crearCliente(`rep-${Date.now()}@prueba.com`);
    const c = await createCredito({
      fecha: '2026-09-10', user_id: cliente.id, articulos: 'Un perfume', deuda_inicial: 240000,
    });
    await addAbono(String(c.id), 50000);

    const r = await reporteVentasRango(d('2026-09-01'), d('2026-09-30'));
    expect(r.ventas.vendido).toBe(0);
    expect(r.ventas.en_deuda).toBe(190000);
  });

  it('una merma del rango cuenta como pérdida; una entrada de inventario no', async () => {
    const ins = await crearInsumo('Esencia rep', { unidad: 'ml', precio: 500, stock: 100 });
    await prisma.movimientoInventario.createMany({ data: [
      { insumo_id: ins.id, tipo: 'merma', cantidad: -20, costo_unitario: 500, fecha: d('2026-09-10') },
      { insumo_id: ins.id, tipo: 'ajuste', cantidad: 50, costo_unitario: 500, fecha: d('2026-09-11') },
    ] });

    const r = await reporteVentasRango(d('2026-09-01'), d('2026-09-30'));
    expect(r.perdidas.mermas).toBe(10000);
    expect(r.perdidas.diferencias_conteo).toBe(0);
    expect(r.perdidas.total).toBe(10000);
  });
});
