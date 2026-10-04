import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { crearInsumo } from '../src/test/baseDePrueba';
import { abrirDashboard, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — los precios de los originales (dueño, 2026-10-04).
 *
 * Un decant de 5 ml de una botella de $200.000 cuesta $15.500 (líquido $10.000
 * + lo que se pierde al trasvasar $4.000 + frasco $1.500). Con una meta propia
 * de $10.000 se sugiere $26.000, y "Ponerle precio a todos los que no tienen"
 * lo guarda como precio de esa talla.
 */

const NOMBRE = 'Recorrido Original Precios';
const foto = (n: string) => path.join(os.tmpdir(), `celestial-precios-${n}.png`);
let perfumeId = 0;
let t5Id = 0;

beforeAll(async () => {
  const botella = await crearInsumo(`${NOMBRE} – Botella`, { unidad: 'ml', precio: 2000, stock: 100 });
  await prisma.insumoCosto.update({ where: { id: botella.id }, data: { ml_botella: 100 } });
  const frasco = await crearInsumo('Frasco decant recorrido', { tipo: 'envase', precio: 1500, stock: 20 });
  const formula = await prisma.formulaVolumen.create({ data: { nombre: 'Decant recorrido', ml_total: 5, esencia_ml: 0, envase_insumo_id: frasco.id } });
  const t5 = await prisma.presentacion.create({ data: { nombre: 'RPO5ML', ml: 5, formula_volumen_id: formula.id } });
  const t100 = await prisma.presentacion.create({ data: { nombre: 'RPO100ML', ml: 100 } });
  t5Id = t5.id;
  const p = await prisma.perfume.create({
    data: { nombre: NOMBRE, precio: 270000, tipo_producto: 'fraccionado', insumo_producto_id: botella.id, publicado: true },
  });
  perfumeId = p.id;
  await prisma.perfumePresentacion.createMany({ data: [
    { perfume_id: p.id, presentacion_id: t5.id }, { perfume_id: p.id, presentacion_id: t100.id },
  ] });
});

afterAll(cerrarNavegador);

describe('los precios de los originales', () => {
  it('con meta propia sugiere sobre ella, y "ponerle precio a todos" lo guarda', async () => {
    const { contexto, pagina } = await abrirDashboard();
    pagina.on('dialog', (d) => d.accept());
    await irA(pagina, '/dashboard/precios_originales');
    const card = pagina.getByRole('article', { name: NOMBRE });
    await card.waitFor();
    expect(await card.innerText()).toMatch(/Te cuesta \$\s?15\.500/);

    await card.getByRole('button', { name: 'Meta propia para este' }).click();
    await card.getByLabel('Con este quiero ganar (en qué)').click();
    await pagina.getByRole('option', { name: 'pesos por unidad' }).click();
    await card.getByLabel('Con este quiero ganar (valor)').fill('10000');
    await card.getByRole('button', { name: 'Guardar' }).click();
    await card.getByText(/Meta propia: \$\s?10\.000/).waitFor();
    await expect.poll(async () => card.innerText()).toMatch(/Sugerido \$\s?26\.000/);
    await pagina.screenshot({ path: foto('pantalla'), fullPage: false });

    await pagina.getByRole('button', { name: /Ponerle precio a todos los que no tienen/ }).click();
    await pagina.getByText(/precio\(s\) guardado\(s\)/).waitFor();

    const talla = await prisma.perfumePresentacion.findUniqueOrThrow({
      where: { perfume_id_presentacion_id: { perfume_id: perfumeId, presentacion_id: t5Id } },
    });
    expect(Number(talla.precio)).toBe(26000);

    await pagina.setViewportSize({ width: 390, height: 844 });
    expect(await pagina.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await card.scrollIntoViewIfNeeded();
    await pagina.screenshot({ path: foto('celular') });
    await contexto.close();
  });
});
