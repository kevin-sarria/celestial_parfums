import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { crearInsumo } from '../src/test/baseDePrueba';
import { hoyEnColombia } from '../src/utils/fechas';
import { abrirDashboard, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — el reporte de compras agrupa por FAMILIA y corta la cola.
 *
 * Medido en el respaldo del dueño (2026-10-04): un año de compras son **127
 * insumos distintos** y el que más pesa es el **4,7 %** —los diez primeros, el
 * 25 %—, así que el panel insumo por insumo no dejaba leer nada. Agrupado son
 * cuatro filas que sí, y la mayor delata las botellas de originales.
 *
 * Aquí se siembran tres familias muy desparejas (una botella de original, una
 * esencia, un envase) más una cola de doce insumos chicos, y se mira la pantalla.
 */

afterAll(cerrarNavegador);

const foto = (n: string) => path.join(os.tmpdir(), `celestial-reporte-compras-${n}.png`);
const haceDias = (n: number) => new Date(hoyEnColombia().getTime() - n * 86_400_000);

describe('el reporte de compras', () => {
  it('agrupa el gasto por familia y no pinta una lista sin fin', async () => {
    const gama = await prisma.gamaEsencia.upsert({
      where: { nombre: 'Árabe' }, update: {}, create: { nombre: 'Árabe' },
    });
    const esencia = await crearInsumo('Esencia del recorrido de compras', { precio: 400, stock: 0, gama_id: gama.id });
    const envase = await crearInsumo('Envase del recorrido de compras', { tipo: 'envase', precio: 2850, stock: 0 });
    // La botella de un original se reconoce por `ml_botella`, no por el nombre.
    const botella = await prisma.insumoCosto.create({
      data: {
        nombre: 'Botella del recorrido – Original 100 ml', tipo: 'materia_prima',
        unidad: 'ml', precio: 2000, stock: 0, ml_botella: 100,
      },
    });

    await prisma.movimientoInventario.createMany({
      data: [
        { insumo_id: botella.id, tipo: 'compra', cantidad: 500, costo_unitario: 2000, fecha: haceDias(22) }, // $1.000.000
        { insumo_id: esencia.id, tipo: 'compra', cantidad: 1000, costo_unitario: 400, fecha: haceDias(20) }, // $400.000
        { insumo_id: envase.id, tipo: 'compra', cantidad: 100, costo_unitario: 2850, fecha: haceDias(18) },  // $285.000
      ],
    });

    // Una cola larga y menuda, para comprobar que se agrupa en "Otros".
    const cola = await Promise.all([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) =>
      crearInsumo(`Insumo menor ${n} del recorrido`, { precio: 100, stock: 0 })));
    await prisma.movimientoInventario.createMany({
      data: cola.map((i, k) => ({
        insumo_id: i.id, tipo: 'compra', cantidad: 10, costo_unitario: 100, fecha: haceDias(10 + k),
      })),
    });

    const empresa = await prisma.empresa.create({ data: { nombre: 'Distribuidora del recorrido' } });
    await prisma.pagoProveedor.create({
      data: { dia: haceDias(20), empresa_id: empresa.id, valor_compra: 1685000 },
    });

    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/rep_compras');
    await pagina.waitForSelector('text=En qué se va la plata', { timeout: 30_000 });

    // Las familias: cuatro filas que dicen algo, con su peso sobre el total.
    const familias = (await pagina.locator('div', { hasText: 'En qué se va la plata' }).last().innerText())
      .replace(/\s+/g, ' ');
    expect(familias).toContain('Botellas de originales');
    expect(familias).toContain('Esencias');
    expect(familias).toContain('Envases y frascos');
    // $1.000.000 de $1.697.000 = 58,9 %
    expect(familias).toContain('58,9 %');

    // Y el detalle ya no son 15 renglones: se ve el top y el resto en UNA fila.
    const insumos = (await pagina.locator('div', { hasText: 'Los insumos que más pesan' }).last().innerText())
      .replace(/\s+/g, ' ');
    expect(insumos).toContain('Otros 5');

    await pagina.screenshot({ path: foto('escritorio') });

    // Y en el celular: el reporte no puede sacarse del ancho.
    await pagina.setViewportSize({ width: 390, height: 844 });
    await pagina.waitForSelector('text=En qué se va la plata');
    const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
    expect(ancho).toBeLessThanOrEqual(390);
    await pagina.screenshot({ path: foto('celular') });

    await contexto.close();
  }, 120_000);
});
