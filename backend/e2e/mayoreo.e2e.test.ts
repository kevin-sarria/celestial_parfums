import { afterAll, describe, expect, it } from 'vitest';
import { abrirDashboard, campo, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — el camino del mayoreo: precio por cantidad → costo → cotización.
 *
 * Las tres pantallas se apoyan una en otra: sin un rango de precio no hay
 * cotización general que enseñar, y sin costo no se sabe si ese precio deja
 * ganancia. Por eso van en un solo archivo y en este orden.
 *
 * Se escribió al pasarlas a la capa HTTP única. Comprueba lo que un refactor de
 * red rompe sin que se note: que lo que se guarda vuelve del servidor.
 */

afterAll(cerrarNavegador);

describe('el mayoreo', () => {
  it('un rango de precio por cantidad se guarda y se ve en el tamaño', async () => {
    const { contexto, pagina } = await abrirDashboard();
    // Los rangos salieron de "Tamaños y fórmulas" el 2026-08-23: aquella
    // pantalla es la receta que descuenta inventario, esta es solo mayoreo.
    await irA(pagina, '/dashboard/precios_mayoreo');
    await pagina.waitForSelector('text=Precios al mayoreo');

    await pagina.getByRole('button', { name: /agregar rango de precio/i }).first().click();
    const casillas = pagina.locator('input[type="number"]');
    await casillas.nth(0).fill('10');
    await casillas.nth(1).fill('49');
    await casillas.nth(2).fill('19000');
    await pagina.getByRole('button', { name: 'Agregar', exact: true }).click();

    // La lista se recarga desde el servidor: si el POST no hubiera entrado,
    // el rango desaparecería al repintar.
    await pagina.waitForSelector('text=10 a 49 unidades');
    // Sin el "$": `formatPrice` es Intl es-CO y mete un espacio duro entre el
    // signo y el número, así que buscar "$19.000" tal cual nunca encuentra nada.
    await pagina.waitForSelector('text=/19\\.000/');

    await contexto.close();
  });

  it('Costos de producción dice cuánto cuesta armar ese tamaño', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/costos');
    await pagina.waitForSelector('text=Costos de producción');

    // El costo sale de la receta y del costo promedio de cada material: si la
    // pantalla no hubiera podido leerlos, no habría ni un precio en pesos.
    await pagina.waitForSelector('text=/\\$\\s?[\\d.]+/');

    await contexto.close();
  });

  it('una cotización de lista de precios se guarda y aparece en el listado', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/cotizaciones');
    await pagina.waitForSelector('text=Cotizaciones mayoristas');

    await pagina.getByRole('button', { name: /nueva cotización/i }).click();
    await pagina.waitForSelector('text=Nueva cotización');

    const cliente = `Distribuidora ${Date.now()}`;
    await campo(pagina, 'Nombre de contacto *').fill(cliente);
    // "Lista de precios": no dice qué fragancias lleva, solo cuánto vale por
    // cantidad. Necesita un tamaño CON rangos, que es el del primer recorrido.
    await pagina.getByRole('button', { name: /lista de precios/i }).first().click();
    await pagina.getByRole('button', { name: /30 ml/i }).first().click();
    await pagina.getByRole('button', { name: 'Guardar', exact: true }).click();

    // El número de cotización lo pone el servidor: verlo en pantalla prueba que
    // la respuesta volvió y se guardó en el estado, no solo que se envió.
    await pagina.waitForSelector('text=/Cotización COT-/');

    await pagina.getByRole('button', { name: /volver a cotizaciones/i }).click();
    await pagina.waitForSelector(`text=${cliente}`);
    expect(await pagina.getByText('Lista de precios · 1 tamaño').count()).toBeGreaterThan(0);

    await contexto.close();
  });
});
