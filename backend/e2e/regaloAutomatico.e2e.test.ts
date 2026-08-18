import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { crearInsumo } from '../src/test/baseDePrueba';
import { abrirDashboard, cabeceraAdmin, campo, cerrarNavegador, irA } from './navegador';
import { URL_API } from './arranque';

/**
 * RECORRIDO — el regalo automático se sugiere UNA vez por venta, no por
 * botella, y descuenta su propio inventario como cualquier producto.
 *
 * Nace del caso real del dueño (2026-08-17): un perfumero recargable se debía
 * regalar con cualquier combo, pero el sistema no tenía forma de decir "una
 * sola unidad, sin importar cuántos perfumes lleve el pedido" — la única
 * maquinaria que existía descontaba accesorios POR BOTELLA vendida. La
 * solución reutiliza el motor de ventas normal: el regalo es un producto
 * `comprado` como cualquier splash o gorra, marcado con `regalo_automatico`,
 * y el formulario lo agrega como una línea más, a costo $0, cuando el pedido
 * trae un 100 ml suelto o ya llegó a precio de combo (`VentaForm.tsx`).
 */

afterAll(cerrarNavegador);

describe('el regalo automático en un combo', () => {
  it('se sugiere una sola vez y descuenta un solo insumo, aunque el combo lleve 3 botellas', async () => {
    const insumoRegalo = await crearInsumo('Perfumero de prueba', { tipo: 'accesorio', precio: 8000, stock: 20 });

    /**
     * Se crea POR LA API, no con Prisma directo: `POST /parfums/create` limpia
     * la caché de 5 minutos del catálogo (`bustCatalogoCache`) al terminar.
     * Insertarlo directo en la base deja esa caché sirviendo la lista vieja
     * hasta que expira sola, y el producto no aparecería en Ventas.
     */
    const alta = await fetch(`${URL_API}/api/parfums/create`, {
      method: 'POST',
      headers: await cabeceraAdmin(),
      body: JSON.stringify({
        nombre: 'Perfumero de regalo',
        precio: 8000,
        tipo_producto: 'comprado',
        insumo_producto_id: insumoRegalo.id,
        regalo_automatico: true,
        tipos_aroma: [], ocasiones: [], presentaciones: [],
      }),
    });
    expect(alta.ok).toBe(true);
    const { data: { id: regaloId } } = await alta.json();

    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/ventas');
    await pagina.waitForSelector('text=Registrar venta');

    await pagina.getByRole('button', { name: /registrar venta/i }).click();
    await campo(pagina, 'Persona *').fill('Combo del recorrido');

    /**
     * Tres "Ventas N" de 30 ml arman el combo de 3 que siembra la tienda.
     *
     * El buscador se abre UNA sola vez: al elegir un producto en modo
     * "agregar" el panel queda abierto a propósito para encadenar varias
     * elecciones (`BuscadorSelect.tsx` → `elegir`), así que volver a hacer
     * clic en el botón lo CERRARÍA en vez de reabrirlo. `elegirProducto` del
     * helper asume que arranca cerrado y solo sirve para una elección suelta.
     */
    await pagina.getByRole('button', { name: /buscar y agregar producto/i }).click();
    for (const nombre of ['Ventas 1', 'Ventas 2', 'Ventas 3']) {
      await pagina.getByPlaceholder('Escribe para filtrar…').fill(nombre);
      await pagina.getByRole('option', { name: nombre, exact: true }).click();
    }
    await pagina.keyboard.press('Escape');

    // El botón solo aparece cuando el pedido de verdad califica.
    await pagina.waitForSelector('text=Este pedido califica');
    await pagina.getByRole('button', { name: /\+ Agregar regalo/i }).click();

    // Una sola línea: el botón desaparece y no hay una segunda etiqueta "Regalo".
    expect(await pagina.getByRole('button', { name: /\+ Agregar regalo/i }).count()).toBe(0);
    expect(await pagina.getByText('Regalo', { exact: true }).count()).toBe(1);

    await campo(pagina, 'Valor de la venta (COP) *').fill('150000');
    await pagina.getByRole('button', { name: /^Registrar$/ }).click();
    await pagina.waitForSelector('text=Combo del recorrido', { timeout: 30_000 });
    await contexto.close();

    const venta = await prisma.venta.findFirstOrThrow({
      where: { persona: 'Combo del recorrido' },
      include: { perfumes: true },
    });
    // Los 3 perfumes del combo + el regalo, ninguno duplicado ni fusionado.
    expect(venta.perfumes).toHaveLength(4);
    const lineaRegalo = venta.perfumes.find((p) => p.perfume_id === regaloId);
    expect(lineaRegalo?.cantidad).toBe(1);

    // El inventario del regalo bajó UNA sola unidad, no una por cada botella del combo.
    const insumoDespues = await prisma.insumoCosto.findUniqueOrThrow({ where: { id: insumoRegalo.id } });
    expect(Number(insumoDespues.stock)).toBe(19);
  });
});
