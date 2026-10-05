import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { toSlug } from '../src/utils/slug';
import { abrirTienda, cerrarNavegador, cerrarPopup, irA } from './navegador';

/**
 * RECORRIDO — el combo se ofrece EN LA FICHA (dueño, 2026-10-04).
 *
 * El carrito ya aplicaba el precio de combo, pero solo se enteraba quien abría el
 * carrito —y agregar al carrito no lo abre, porque un cliente lo pidió así—. Quien
 * compraba de a uno nunca veía que llevando tres pagaba menos: de junio en
 * adelante, 48 de las ventas de 30 ml fueron de una sola unidad.
 *
 * La tienda sembrada trae un combo de 3 a $150.000 con el 30 ml a $60.000, así
 * que el ahorro son $30.000 exactos ($50.000 cada uno dentro del combo).
 */

afterAll(cerrarNavegador);

const foto = (n: string) => path.join(os.tmpdir(), `celestial-combo-${n}.png`);

describe('el combo se ofrece en la ficha del perfume', () => {
  it('dice el tramo y el ahorro sin tener que abrir el carrito', async () => {
    const { contexto, pagina } = await abrirTienda();

    await irA(pagina, `/perfume/${toSlug('Carrito 1')}`);
    await cerrarPopup(pagina);

    // El renglón vive en la ficha, junto al precio de la talla. Se lee el bloque
    // entero en vez de adivinar el formato del dinero: `Intl` de es-CO escribe
    // "$ 30.000" con espacio, y un aserto con "$30.000" pegado falla por eso.
    const bloque = pagina.locator('div', { hasText: 'Llévate más y paga menos' }).last();
    await bloque.waitFor({ timeout: 30_000 });
    const texto = (await bloque.innerText()).replace(/\s+/g, ' ');

    expect(texto).toContain('3 perfumes por');
    expect(texto).toContain('$ 150.000');
    expect(texto).toContain('ahorras $ 30.000');
    expect(texto).toContain('$ 50.000 cada uno');
    await pagina.screenshot({ path: foto('escritorio') });

    // Y cabe en el celular: el renglón no puede sacar la ficha del ancho.
    await pagina.setViewportSize({ width: 390, height: 844 });
    await bloque.waitFor();
    const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
    expect(ancho).toBeLessThanOrEqual(390);
    await pagina.screenshot({ path: foto('celular') });

    await contexto.close();
  }, 90_000);
});
