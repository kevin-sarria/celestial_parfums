import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { registrarProduccion } from '../src/repositories/inventario.producciones';
import { abrirDashboard, campo, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — corregir un lote sin borrarlo.
 *
 * Nace del lote 6 de Khamrah: un frasco de $74.580 colgado de la ficha del
 * perfume corriente. Hasta el 2026-08-25 el único arreglo era borrar el lote y
 * volver a escribirlo, que además recalculaba el costo al promedio de hoy y no
 * dejaba rastro de que algo se hubiera corregido.
 *
 * Lo que vigila este recorrido: que corregir NO cree un lote nuevo, que la
 * corrección quede escrita, y que el material se rehaga en vez de descontarse
 * dos veces.
 */

afterAll(cerrarNavegador);

/** Un lote de hoy, sembrado por el motor: la pantalla solo tiene que corregirlo. */
const sembrarLote = async () => {
  const formula = await prisma.formulaVolumen.findFirstOrThrow({ orderBy: { id: 'asc' } });
  const perfume = await prisma.perfume.findFirstOrThrow({ orderBy: { id: 'asc' } });
  const esencia = await prisma.insumoCosto.findFirstOrThrow({
    where: { tipo: 'materia_prima' }, orderBy: { id: 'asc' },
  });
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

  return {
    perfume,
    lote: await registrarProduccion({
      fecha: hoy,
      formula_volumen_id: formula.id,
      cantidad: 3,
      perfume_id: perfume.id,
      consumos: [{ insumo_id: esencia.id, cantidad: 30 }],
      nota: 'Lote de prueba del recorrido',
    }),
  };
};

describe('corregir un lote', () => {
  it('cambia la cantidad, no crea otro lote y deja el cambio escrito', async () => {
    const esenciaId = (await prisma.insumoCosto.findFirstOrThrow({
      where: { tipo: 'materia_prima' }, orderBy: { id: 'asc' },
    })).id;
    // El stock ANTES de que el lote existiera: contra esto se comprueba que
    // corregir devuelve lo viejo y descuenta lo nuevo, en vez de acumular.
    const esenciaAntesDelLote = Number((await prisma.insumoCosto.findUniqueOrThrow({ where: { id: esenciaId } })).stock);
    const { perfume, lote } = await sembrarLote();
    const lotesAntes = await prisma.produccion.count();

    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/producciones');
    await pagina.waitForSelector('text=Producciones');

    // La fila se busca por su lote, no por su posición: otros recorridos
    // siembran sus propios lotes en esta misma base.
    const fila = pagina.locator('tbody tr').filter({ hasText: perfume.nombre }).first();
    await fila.getByRole('button', { name: 'Corregir lote' }).click();
    await pagina.waitForSelector('text=Corregir lote');

    await campo(pagina, '¿Cuántas unidades?').fill('7');
    await pagina.screenshot({ path: path.join(os.tmpdir(), 'celestial-corregir-lote.png') });
    await pagina.getByRole('button', { name: /Guardar cambios/ }).click();
    await pagina.locator('[role=dialog]').waitFor({ state: 'detached', timeout: 30_000 });

    // 1. Es el MISMO lote, corregido: no se creó uno nuevo.
    expect(await prisma.produccion.count()).toBe(lotesAntes);
    const corregido = await prisma.produccion.findUniqueOrThrow({ where: { id: lote.id } });
    expect(corregido.cantidad).toBe(7);

    // 2. El material se REHACE, no se acumula: del lote solo queda su gasto
    //    vigente. La pantalla recalcula los consumos con la fórmula, así que se
    //    comprueba la regla —lo que el lote gasta hoy— y no una cifra fija.
    const gastoVigente = (await prisma.movimientoInventario.findMany({
      where: { tipo: 'produccion', referencia_id: lote.id, insumo_id: esenciaId },
    })).reduce((suma, m) => suma + Math.abs(Number(m.cantidad)), 0);
    const esenciaFinal = Number((await prisma.insumoCosto.findUniqueOrThrow({ where: { id: esenciaId } })).stock);
    expect(esenciaFinal).toBeCloseTo(esenciaAntesDelLote - gastoVigente, 2);

    // 3. Y queda escrito qué se cambió.
    const historial = corregido.historial as unknown as { fecha: string; texto: string }[];
    expect(historial).toHaveLength(1);
    expect(historial[0].texto).toContain('3 → 7 unidades');
    // Y se ve en la fila, no solo en la base: `toBeVisible` es de Playwright
    // Test y aquí corre Vitest, así que se espera al elemento.
    await pagina.getByText(/editado el/i).first().waitFor({ timeout: 15_000 });
    await pagina.screenshot({ path: path.join(os.tmpdir(), 'celestial-lote-corregido.png') });

    await contexto.close();
  }, 90_000);
});
