import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { abrirDashboard, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — cada tipo de alta pide solo lo suyo (y cada pestaña abre el suyo).
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
  it('cada pestaña abre su tipo ya elegido, y un accesorio pide menos de la mitad de campos que una fragancia', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/productos');
    await pagina.waitForSelector('text=+ Nuevo producto');
    await pagina.getByRole('button', { name: '+ Nuevo producto' }).click();

    // 1. La pestaña Productos ya dice qué es (catálogo por línea, 2026-10-04):
    //    va directo al formulario de lo comprado, sin volver a preguntar.
    //    Un perfumero: sin duración, ni proyección, ni notas, ni tallas.
    await pagina.waitForSelector('text=¿Qué insumo ES este producto?');
    const camposComprado = await contarCampos(pagina);
    await pagina.screenshot({ path: foto('alta-comprado') });
    expect(await pagina.getByText('Duración').count()).toBe(0);
    expect(await pagina.getByText('Tipos de aroma').count()).toBe(0);

    // 2. "Cambiar" vuelve a la pregunta que gobierna todo lo demás.
    await pagina.getByRole('button', { name: 'Cambiar' }).click();
    await pagina.waitForSelector('text=Elige qué es');
    await pagina.screenshot({ path: foto('alta-tipos') });
    expect(await contarCampos(pagina)).toBe(0);

    // 3. Una fragancia sí los pide: es la comparación que da sentido al número.
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

    // Un 1.1 se cuenta por frascos armados, y vive en SU pestaña (1.1).
    await irA(pagina, '/dashboard/uno_uno');
    await pagina.waitForSelector('text=+ Nuevo 1.1');
    await pagina.getByPlaceholder(/Buscar/).first().fill(once.nombre);
    const filaOnce = pagina.locator('tr').filter({ hasText: once.nombre }).first();
    await filaOnce.waitFor({ timeout: 20_000 });
    await expect.poll(() => filaOnce.textContent(), { timeout: 15_000 }).toContain('3');

    // Un comprado se cuenta por su material, en Productos y accesorios.
    await irA(pagina, '/dashboard/productos');
    await pagina.waitForSelector('text=+ Nuevo producto');
    await pagina.getByPlaceholder(/Buscar/).first().fill(comprado.nombre);
    const filaComprado = pagina.locator('tr').filter({ hasText: comprado.nombre }).first();
    await filaComprado.waitFor({ timeout: 20_000 });
    await expect.poll(() => filaComprado.textContent(), { timeout: 15_000 }).toContain('7');

    await pagina.screenshot({ path: foto('productos-unidades') });
    await contexto.close();
  }, 120_000);
});
