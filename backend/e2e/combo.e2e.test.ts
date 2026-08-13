import { afterAll, describe, expect, it } from 'vitest';
import type { Page } from 'playwright-core';
import { abrirTienda, cerrarNavegador, cerrarPopup, irA } from './navegador';
import { PRECIOS } from './tienda';

/**
 * RECORRIDO 1 — el combo se aplica solo en el carrito.
 *
 * El precio de combo NO es una promoción: es la política de precios por
 * mayoreo, y aplica siempre que salga más barato. Es el camino que más gente
 * recorre, y un error aquí cobra de menos en cada pedido sin que nadie lo note.
 *
 * Regla en CLAUDE.md → "Combos = precio por mayoreo, SIEMPRE aplica".
 */

afterAll(cerrarNavegador);

/** Como los ve el cliente: "$ 180.000" o "$180.000" según el navegador. */
const enPesos = (valor: number) =>
  new RegExp(`\\$\\s?${valor.toLocaleString('es-CO').replace(/\./g, '\\.')}`);

const agregarAlCarrito = async (pagina: Page, perfume: string) => {
  await pagina.getByRole('button', { name: `Agregar ${perfume} al carrito` }).first().click();
  const modal = pagina.getByRole('dialog');
  await modal.getByRole('button', { name: /agregar al carrito/i }).click();
  await modal.waitFor({ state: 'hidden' });
};

describe('el carrito aplica el precio de combo sin que el cliente haga nada', () => {
  it('tres perfumes sueltos de la misma categoría y talla se cobran como combo', async () => {
    const { contexto, pagina } = await abrirTienda();
    await irA(pagina, '/perfumes?q=Carrito');
    await pagina.waitForSelector('text=Carrito 1');
    await cerrarPopup(pagina);

    await agregarAlCarrito(pagina, 'Carrito 1');
    await agregarAlCarrito(pagina, 'Carrito 2');
    await agregarAlCarrito(pagina, 'Carrito 3');

    // Agregar ya NO abre el carrito (cansa y corta el impulso de comprar):
    // hay que abrirlo a propósito.
    await pagina.getByRole('button', { name: 'Ver carrito' }).click();

    await pagina.waitForSelector('text=Total estimado');
    const texto = await pagina.locator('body').innerText();

    const sueltos = PRECIOS.unidad * 3;
    const ahorro = sueltos - PRECIOS.comboDe3;

    // Se detecta el combo, se ve el ahorro y se cobra el precio de mayoreo.
    expect(texto).toMatch(/combo/i);
    expect(texto).toMatch(enPesos(ahorro));
    expect(texto).toMatch(enPesos(PRECIOS.comboDe3));
    // Y el total NO es la suma de los tres sueltos.
    expect(texto).not.toMatch(new RegExp(`Total estimado[\\s\\S]{0,40}${enPesos(sueltos).source}`));

    await contexto.close();
  });

  it('con dos perfumes todavía no hay combo: se pagan sueltos y se avisa que falta uno', async () => {
    const { contexto, pagina } = await abrirTienda();
    await irA(pagina, '/perfumes?q=Carrito');
    await pagina.waitForSelector('text=Carrito 1');
    await cerrarPopup(pagina);

    await agregarAlCarrito(pagina, 'Carrito 1');
    await agregarAlCarrito(pagina, 'Carrito 2');
    await pagina.getByRole('button', { name: 'Ver carrito' }).click();
    await pagina.waitForSelector('text=Total estimado');

    const texto = await pagina.locator('body').innerText();
    // Se pagan los dos sueltos: todavía no hay mayoreo que aplicar.
    expect(texto).toMatch(enPesos(PRECIOS.unidad * 2));
    // Y aparece el empujón de venta, que es media razón para que el combo exista.
    expect(texto).toMatch(/agrega un perfume más/i);
    expect(texto).toMatch(/Combo 3 Carrito/);

    await contexto.close();
  });
});
