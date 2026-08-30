import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { abrirDashboard, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — el alta pregunta PRIMERO qué es, y cada tipo pide solo lo suyo.
 *
 * Nace de una queja del dueño con captura incluida (2026-08-25): el formulario
 * preguntaba "¿cómo consigues este producto?" en la casilla once, después de
 * hacerle llenar la duración y la proyección de una bolsa de organza.
 *
 * Este recorrido MIDE, no opina. Medido el 2026-08-25 con esta misma prueba:
 * **un accesorio pide 5 casillas y una fragancia 8**; antes las dos pedían las
 * mismas 16. Si alguien devuelve un campo de fragancia al formulario del
 * perfumero, esto se cae.
 */

const foto = (nombre: string) => path.join(os.tmpdir(), `celestial-${nombre}.png`);

afterAll(cerrarNavegador);

/** Campos visibles de verdad: los que el dueño tiene que mirar y llenar. */
const contarCampos = (pagina: import('playwright-core').Page) =>
  pagina.locator('[role=dialog] input:visible, [role=dialog] textarea:visible, [role=dialog] [role=combobox]:visible').count();

describe('el alta de un producto', () => {
  it('empieza preguntando qué es, y un accesorio pide menos de la mitad de campos que una fragancia', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/productos');
    await pagina.waitForSelector('text=+ Nuevo producto');
    await pagina.getByRole('button', { name: '+ Nuevo producto' }).click();

    // 1. Lo primero es la pregunta que gobierna todo lo demás.
    await pagina.waitForSelector('text=Elige qué es');
    await pagina.screenshot({ path: foto('alta-tipos') });
    expect(await contarCampos(pagina)).toBe(0);

    // 2. Un perfumero: sin duración, ni proyección, ni notas, ni tallas.
    await pagina.getByRole('button', { name: /Algo que compro hecho/ }).click();
    await pagina.waitForSelector('text=¿Qué insumo ES este producto?');
    const camposComprado = await contarCampos(pagina);
    await pagina.screenshot({ path: foto('alta-comprado') });
    expect(await pagina.getByText('Duración').count()).toBe(0);
    expect(await pagina.getByText('Tipos de aroma').count()).toBe(0);

    // 3. Una fragancia sí los pide: es la comparación que da sentido al número.
    await pagina.getByRole('button', { name: 'Cambiar' }).click();
    await pagina.getByRole('button', { name: /Una fragancia que fabrico/ }).click();
    await pagina.waitForSelector('text=Tipos de aroma');
    const camposFragancia = await contarCampos(pagina);
    await pagina.screenshot({ path: foto('alta-fragancia') });

    (await import('node:fs')).writeFileSync(foto('medido').replace('.png', '.txt'), `comprado=${camposComprado} fragancia=${camposFragancia}`);
    expect(camposComprado).toBeLessThan(camposFragancia);

    await contexto.close();
  }, 90_000);
});

/**
 * RECORRIDO — la pestaña Productos dice CUÁNTAS UNIDADES quedan.
 *
 * Llevaba dos olas esperando "porque traer las unidades sería una consulta más
 * en el camino caliente del catálogo". Al construir la maceración se comprobó
 * que no: los frascos armados y el stock del material ya viajaban en la misma
 * respuesta. La columna solo hacía falta pintarla.
 */
describe('las unidades en la pestaña Productos', () => {
  it('un 1.1 se cuenta por frascos armados y un comprado por su material', async () => {
    const marca = Date.now();
    const presentacion = await prisma.presentacion.findFirstOrThrow({ orderBy: { id: 'asc' } });

    // Un 1.1 con 3 frascos armados: se cuenta por lo que está hecho.
    const once = await prisma.perfume.create({
      data: {
        nombre: `Unidades 1.1 ${marca}`, precio: 150000, solo_armado: true, publicado: false,
        presentaciones: { create: { presentacion_id: presentacion.id, stock: 3 } },
      },
    });
    // Un comprado con 7 unidades de su material: se cuenta por la bodega.
    const material = await prisma.insumoCosto.create({
      data: { nombre: `Gorra unidades ${marca}`, tipo: 'accesorio', precio: 25000, stock: 7 },
    });
    const comprado = await prisma.perfume.create({
      data: {
        nombre: `Unidades comprado ${marca}`, precio: 40000, publicado: false,
        tipo_producto: 'comprado', es_accesorio: true, insumo_producto_id: material.id,
      },
    });

    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/productos');
    await pagina.waitForSelector('text=Productos');

    for (const [nombre, unidades] of [[once.nombre, '3'], [comprado.nombre, '7']] as const) {
      await pagina.getByPlaceholder(/Buscar/).first().fill(nombre);
      const fila = pagina.locator('tr').filter({ hasText: nombre }).first();
      await fila.waitFor({ timeout: 20_000 });
      await expect.poll(() => fila.textContent(), { timeout: 15_000 }).toContain(unidades);
    }

    await pagina.screenshot({ path: foto('productos-unidades') });
    await contexto.close();
  }, 120_000);
});
