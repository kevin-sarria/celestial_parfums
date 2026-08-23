import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { abrirDashboard, campo, cerrarNavegador, elegirOpcion, irA } from './navegador';

/**
 * RECORRIDO — un accesorio del inventario se puede vender, sin saber trucos.
 *
 * Lo pidió el dueño el 2026-08-22 con estas palabras: *"si lo tengo en mi
 * inventario debería aparecer como tal"*. Y tenía razón: el sistema ya le hacía
 * ese favor a las esencias —al comprarlas estrena su fragancia— pero no a los
 * accesorios. El perfumero recargable existía solo como material, así que **no
 * había forma de meterlo en una venta**: los que regalaba no descontaban de
 * nada y su stock llevaba tiempo en negativo.
 *
 * El recorrido va por el camino largo a propósito —comprar el material y luego
 * buscarlo para vender— porque el fallo no estaba en ninguna de las dos
 * pantallas por separado, sino en que **no se hablaban**.
 */

afterAll(cerrarNavegador);

describe('un accesorio comprado queda listo para vender', () => {
  it('se crea desde la factura con su precio y aparece en Registrar venta', async () => {
    const ACCESORIO = `Perfumero del recorrido ${Date.now()}`;
    const UNIDADES = 20;
    const COSTO_TOTAL = 42_000;  // $2.100 cada uno: lo que a él le cuesta
    const PRECIO_VENTA = 5_000;  // lo que le cobra al cliente

    const { contexto, pagina } = await abrirDashboard();

    // ── 1. Llega la caja de perfumeros, se registra como cualquier compra ──
    await irA(pagina, '/dashboard/pagos');
    await pagina.waitForSelector('text=Registrar pago');
    await pagina.getByRole('button', { name: '+ Registrar pago' }).click();
    await campo(pagina, 'Dia *').fill(new Date().toISOString().slice(0, 10));
    await campo(pagina, 'Valor compra (COP) *').fill(String(COSTO_TOTAL));

    await pagina.getByRole('button', { name: /selecciona una empresa/i }).click();
    await pagina.getByRole('option', { name: '+ Registrar empresa nueva' }).click();
    const empresa = `Proveedor del recorrido ${Date.now()}`;
    await campo(pagina, 'Nombre empresa *').fill(empresa);

    await pagina.getByRole('button', { name: /agregar insumo a la compra/i }).click();
    await pagina.getByRole('option', { name: /crear insumo nuevo/i }).click();
    await campo(pagina, '¿Cómo se llama?').fill(ACCESORIO);
    await elegirOpcion(pagina, '¿Qué es?', /accesorio/i);
    await elegirOpcion(pagina, '¿Cómo se mide?', /por unidad/i);

    // ── 2. Lo que este recorrido vigila: la casilla que antes no existía ──
    const casilla = pagina.getByText(/también se lo vendo a los clientes/i);
    await casilla.waitFor();
    await campo(pagina, 'Precio de venta *').fill(String(PRECIO_VENTA));

    await pagina.getByRole('button', { name: /crear y agregar/i }).click();
    await pagina.getByLabel('Cantidad').waitFor();
    await pagina.getByLabel('Cantidad').fill(String(UNIDADES));
    await pagina.getByLabel('Lo que costó').fill(String(COSTO_TOTAL));
    await pagina.getByRole('button', { name: /^Registrar$/ }).click();
    await pagina.waitForSelector(`text=${empresa}`);

    // ── 3. Y ahora lo que importa: ¿se puede vender? ──
    await irA(pagina, '/dashboard/ventas');
    await pagina.getByRole('button', { name: /registrar venta/i }).first().click();

    /**
     * En SU buscador, no entre las fragancias. Y se busca sin publicarlo: el
     * accesorio nace fuera de la tienda a propósito, así que si el buscador de
     * la venta solo mirara lo publicado, aquí no habría nada.
     */
    const buscador = pagina.getByRole('button', { name: /accesorio|agregar accesorio/i }).first();
    await buscador.click();
    await pagina.getByRole('option', { name: new RegExp(ACCESORIO, 'i') }).click();

    // Queda como línea del pedido, con su precio de venta y no con su costo.
    await pagina.waitForSelector(`text=${ACCESORIO}`);
    await contexto.close();

    // ── Y en la base, las dos mitades enlazadas ──
    const material = await prisma.insumoCosto.findFirstOrThrow({ where: { nombre: ACCESORIO } });
    const producto = await prisma.perfume.findFirstOrThrow({ where: { nombre: ACCESORIO } });

    expect(producto.es_accesorio).toBe(true);
    expect(producto.tipo_producto).toBe('comprado');
    // El enlace es lo que hace que venderlo descuente del inventario.
    expect(producto.insumo_producto_id).toBe(material.id);
    // Costo y precio son números distintos, y ninguno pisa al otro.
    expect(Number(material.precio)).toBe(COSTO_TOTAL / UNIDADES);
    expect(Number(producto.precio)).toBe(PRECIO_VENTA);
    expect(Number(material.stock)).toBe(UNIDADES);
  });
});
