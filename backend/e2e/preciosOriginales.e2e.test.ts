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
  it('una fila por talla: con meta propia sugiere sobre ella, y aplicar a "Sin precio" lo guarda', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/precios_originales');
    await pagina.getByPlaceholder(/Buscar en todos/).fill(NOMBRE);
    const decant = pagina.getByRole('row', { name: /Decant 5 ml/ }).filter({ hasText: NOMBRE });
    await decant.waitFor();
    expect(await decant.innerText()).toMatch(/15\.500/);
    expect(await decant.innerText()).toMatch(/Sin precio/);

    // Meta propia de este perfume: ganar $10.000 → 15.500 + 10.000 = 25.500 → $26.000
    await pagina.getByRole('button', { name: `Meta propia de ${NOMBRE}` }).first().click();
    const modal = pagina.getByRole('dialog');
    await modal.getByLabel('Con este quiero ganar (en qué)').click();
    await pagina.getByRole('option', { name: 'pesos por unidad' }).click();
    await modal.getByLabel('Con este quiero ganar (valor)').fill('10000');
    await modal.getByRole('button', { name: 'Guardar meta' }).click();
    await expect.poll(async () => decant.innerText()).toMatch(/26\.000/);
    expect(await decant.innerText()).toMatch(/meta propia/);
    await pagina.screenshot({ path: foto('pantalla') });

    await pagina.getByRole('button', { name: /^Sin precio/ }).click();
    await pagina.getByRole('button', { name: /^Poner el sugerido/ }).click();
    await pagina.getByRole('dialog').getByRole('button', { name: /^Guardar \d+ precio/ }).click();
    await pagina.getByText(/precio\(s\) guardado\(s\)/).waitFor();
    const talla = await prisma.perfumePresentacion.findUniqueOrThrow({
      where: { perfume_id_presentacion_id: { perfume_id: perfumeId, presentacion_id: t5Id } },
    });
    expect(Number(talla.precio)).toBe(26000);

    await pagina.setViewportSize({ width: 390, height: 844 });
    await pagina.getByRole('button', { name: 'Todas' }).click();
    expect(await pagina.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await pagina.screenshot({ path: foto('celular') });
    await pagina.setViewportSize({ width: 1366, height: 900 });

    // La ficha del perfume dice el MISMO costo (una sola cuenta, en el servidor)
    await irA(pagina, '/dashboard/perfumes');
    await pagina.getByPlaceholder(/Buscar en todos/).fill(NOMBRE);
    await pagina.getByRole('button', { name: `Acciones de ${NOMBRE}` }).first().click();
    await pagina.getByRole('menuitem', { name: 'Editar' }).click();
    await expect.poll(async () => (await pagina.getByRole('dialog').innerText()).replace(/\s+/g, ' '), { timeout: 15_000 })
      .toMatch(/15\.500/);
    await contexto.close();
  });
});
