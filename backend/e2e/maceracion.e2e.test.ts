import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { abrirDashboard, campo, cerrarNavegador, elegirProducto, irA } from './navegador';

/**
 * RECORRIDO — producir son DOS momentos: macerar y, semanas después, envasar.
 *
 * Sale del lote real del dueño del 11 de agosto: el sistema creía que eran 5
 * frascos de 100 ml listos, y en la repisa había ~500 ml reposando en un frasco
 * de un litro con los 5 envases todavía vacíos al lado. Textual suyo: *"hice una
 * cosa rara"* — y no la hizo: hizo lo único que el sistema le dejaba.
 *
 * Lo que vigila el recorrido es **que el líquido no se cuente dos veces**:
 *
 * 1. Macerar gasta esencia y diluyente, y NO toca los envases.
 * 2. Envasar gasta el envase y saca ml del granel, sin volver a tocar la esencia.
 * 3. Vender ese frasco sale de lo armado, y tampoco descuenta esencia.
 *
 * Si alguien vuelve a juntar los dos momentos en uno, esta cadena se rompe.
 */

const foto = (nombre: string) => path.join(os.tmpdir(), `celestial-${nombre}.png`);

const stockDe = async (nombre: string) =>
  Number((await prisma.insumoCosto.findFirstOrThrow({ where: { nombre } })).stock);

afterAll(cerrarNavegador);

describe('macerar y envasar', () => {
  it('el líquido sale UNA vez: al macerar, no al envasar ni al vender', async () => {
    const marca = Date.now();
    const perfume = 'Ventas 1';
    const esencia = `${perfume} – Esencia`;

    const antes = {
      esencia: await stockDe(esencia),
      diluyente: await stockDe('Diluyente'),
      frasco: await stockDe('Frasco 30 ml'),
    };

    const { contexto, pagina } = await abrirDashboard();

    // ── 1. PUSE A MACERAR ────────────────────────────────────────────────────
    await irA(pagina, '/dashboard/inventario');
    await pagina.waitForSelector('text=Registrar uso');
    await pagina.getByRole('button', { name: /^Registrar uso$/ }).click();
    await pagina.getByRole('menuitem', { name: /Puse a macerar/ }).click();

    await pagina.getByRole('button', { name: /Elige la fragancia/ }).click();
    await pagina.getByPlaceholder('Escribe para filtrar…').fill(perfume);
    await pagina.getByRole('option', { name: perfume, exact: true }).click();
    await campo(pagina, '¿Cuántos ml preparaste?').fill('60');
    await campo(pagina, 'Nota (opcional)').fill(`Tanda de recorrido ${marca}`);

    // La cuenta sale ANTES de confirmar: es lo que evita macerar a ciegas.
    await pagina.getByText(/Costo de la tanda/).first().waitFor({ timeout: 15_000 });
    await pagina.screenshot({ path: foto('maceracion-vista-previa') });
    await pagina.getByRole('button', { name: /^Poner a macerar$/ }).click();

    await expect.poll(() => prisma.maceracion.count(), { timeout: 20_000 }).toBeGreaterThan(0);

    // El líquido salió; los envases NO se tocaron. Eso es lo que el sistema
    // hacía mal: daba por gastados 5 frascos que seguían en la repisa.
    expect(await stockDe(esencia)).toBeCloseTo(antes.esencia - 30, 2);
    expect(await stockDe('Diluyente')).toBeCloseTo(antes.diluyente - 28.6, 2);
    expect(await stockDe('Frasco 30 ml')).toBe(antes.frasco);

    const trasMacerar = await stockDe(esencia);

    // ── 2. ENVASÉ FRASCOS ────────────────────────────────────────────────────
    await irA(pagina, '/dashboard/producciones');
    await pagina.getByText(/Macerando ahora/).first().waitFor({ timeout: 20_000 });
    await pagina.screenshot({ path: foto('maceracion-macerando-ahora') });

    await pagina.getByRole('button', { name: /^Envasar$/ }).first().click();
    /**
     * Se envasa UNO de los dos que caben, y luego se vende ese uno.
     *
     * Es a propósito por dos motivos: prueba el envasado PARCIAL —de la misma
     * tanda se envasa varias veces— y deja la ficha sin frascos sueltos. Un
     * frasco armado olvidado aquí se lo encontraba el recorrido de ventas, que
     * lo vendía en vez de fabricarlo, y su cuenta de esencia no cuadraba.
     */
    await campo(pagina, '¿Cuántos frascos?').fill('1');
    await pagina.getByText(/quedan 30 ml/).first().waitFor({ timeout: 15_000 });
    await pagina.screenshot({ path: foto('maceracion-envasando') });
    await pagina.getByRole('button', { name: /^Envasar$/ }).last().click();

    await expect.poll(async () => {
      const lotes = await prisma.produccion.findMany({ where: { maceracion_id: { not: null } } });
      return lotes.length;
    }, { timeout: 20_000 }).toBeGreaterThan(0);

    // Envasar gasta el envase y NO vuelve a tocar la esencia.
    expect(await stockDe('Frasco 30 ml')).toBe(antes.frasco - 1);
    expect(await stockDe(esencia)).toBeCloseTo(trasMacerar, 2);

    // ── 3. LOS FRASCOS EXISTEN Y SE PUEDEN VENDER ────────────────────────────
    await irA(pagina, '/dashboard/inventario');
    await pagina.getByText(/Frascos ya armados/).first().waitFor({ timeout: 20_000 });
    await pagina.screenshot({ path: foto('maceracion-frascos-armados') });

    await irA(pagina, '/dashboard/ventas');
    await pagina.waitForSelector('text=Registrar venta');
    await pagina.getByRole('button', { name: /registrar venta/i }).click();
    await campo(pagina, 'Persona *').fill(`Cliente maceración ${marca}`);
    await elegirProducto(pagina, perfume);
    await campo(pagina, 'Valor de la venta (COP) *').fill('60000');
    await pagina.getByRole('button', { name: /^Registrar$/ }).click();
    await pagina.waitForSelector(`text=Cliente maceración ${marca}`, { timeout: 30_000 });

    // Vender sale de lo ARMADO: la esencia sigue exactamente donde estaba.
    expect(await stockDe(esencia)).toBeCloseTo(trasMacerar, 2);
    // Y no queda ningún frasco suelto de esta fragancia para el siguiente
    // recorrido: lo que se envasó, se vendió.
    const ficha = await prisma.perfume.findFirstOrThrow({ where: { nombre: perfume } });
    const armados = await prisma.perfumePresentacion.findMany({ where: { perfume_id: ficha.id } });
    expect(armados.reduce((t, f) => t + Number(f.stock), 0)).toBe(0);

    await contexto.close();
  }, 180_000);
});
