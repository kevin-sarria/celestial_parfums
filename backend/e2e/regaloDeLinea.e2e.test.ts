import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { crearCliente, crearInsumo } from '../src/test/baseDePrueba';
import { abrirDashboard, cabeceraAdmin, campo, cerrarNavegador, irA } from './navegador';
import { URL_API } from './arranque';

/**
 * RECORRIDO — una línea puede tener parte gratis y parte cobrada a la vez.
 *
 * Reemplaza a `regaloAutomatico.e2e.test.ts` (2026-08-17, retirado): en vez de
 * un botón que agrega una línea especial fija en 1, ahora CUALQUIER línea
 * tiene un campo "Regalo". Nace del caso real de Edwin García (2026-08-17):
 * un perfumero recargable, uno gratis (del combo) y otro cobrado ($5.000), en
 * la MISMA línea del mismo producto.
 */

afterAll(cerrarNavegador);

/**
 * Los dos recorridos miran el MISMO accesorio: uno comprueba que en Ventas
 * tiene su buscador aparte y su campo Regalo, y el otro que en Créditos pasa
 * exactamente lo mismo. Por eso se crea una sola vez.
 */
let insumoId = 0;
let perfumeroId = 0;

beforeAll(async () => {
  const insumo = await crearInsumo('Perfumero de prueba', { tipo: 'accesorio', precio: 5000, stock: 20 });
  insumoId = insumo.id;

  /**
   * Se crea POR LA API, no con Prisma directo: `POST /parfums/create` limpia
   * la caché de 5 minutos del catálogo al terminar. Insertarlo directo deja
   * esa caché sirviendo la lista vieja y el producto no aparecería en Ventas.
   */
  const alta = await fetch(`${URL_API}/api/parfums/create`, {
    method: 'POST',
    headers: await cabeceraAdmin(),
    body: JSON.stringify({
      nombre: 'Perfumero Recargable', precio: 5000, tipo_producto: 'comprado',
      insumo_producto_id: insumo.id, es_accesorio: true,
      tipos_aroma: [], ocasiones: [], presentaciones: [],
    }),
  });
  expect(alta.ok).toBe(true);
  ({ data: { id: perfumeroId } } = await alta.json());
});

describe('el campo Regalo de una línea', () => {
  it('cobra solo las unidades que no son regalo, y el buscador de accesorios los separa de las fragancias', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/ventas');
    await pagina.waitForSelector('text=Registrar venta');

    await pagina.getByRole('button', { name: /registrar venta/i }).click();
    await campo(pagina, 'Persona *').fill('Recorrido regalo de línea');

    // Un accesorio NO se cuela entre las fragancias: tiene su propio buscador.
    // Sin campo para filtrar a propósito: `BuscadorSelect` solo lo pinta con 6+
    // opciones, y la tienda de los recorridos tiene un puñado. Se mira la lista.
    await pagina.getByRole('button', { name: /buscar y agregar producto/i }).click();
    await pagina.locator('[role="listbox"]').waitFor();
    expect(await pagina.getByRole('option', { name: 'Perfumero Recargable', exact: true }).count()).toBe(0);
    await pagina.keyboard.press('Escape');

    await pagina.getByRole('button', { name: /buscar y agregar accesorio/i }).click();
    await pagina.getByRole('option', { name: 'Perfumero Recargable', exact: true }).click();

    // Sube la cantidad a 2 (1 del combo + 1 vendido aparte) y marca 1 como regalo.
    await pagina.getByLabel('Cantidad').fill('2');
    await pagina.getByLabel('Regalo').fill('1');

    // Se cobra 1 sola unidad: $5.000, no $10.000.
    await pagina.waitForSelector('text=/\\$\\s*5\\.000/');

    await campo(pagina, 'Valor de la venta (COP) *').fill('5000');
    await pagina.getByRole('button', { name: /^Registrar$/ }).click();
    await pagina.waitForSelector('text=Recorrido regalo de línea', { timeout: 30_000 });
    await contexto.close();

    const venta = await prisma.venta.findFirstOrThrow({
      where: { persona: 'Recorrido regalo de línea' },
      include: { perfumes: true },
    });
    expect(venta.perfumes).toHaveLength(1);
    expect(venta.perfumes[0].perfume_id).toBe(perfumeroId);
    expect(venta.perfumes[0].cantidad).toBe(2);
    expect(venta.perfumes[0].regalo).toBe(1);

    // El inventario descontó las DOS unidades — la regalada también salió de la bodega.
    const insumoDespues = await prisma.insumoCosto.findUniqueOrThrow({ where: { id: insumoId } });
    expect(Number(insumoDespues.stock)).toBe(18);
  });

  /**
   * VENDER FIADO ES VENDER — y desde el 2026-08-24, también por dentro.
   *
   * Este recorrido comprobaba lo contrario: que Créditos NO tuviera ni campo
   * "Regalo" ni buscador de accesorios, porque su backend no guardaba ninguno
   * de los dos. Eso no era una regla, era una carencia — y le costaba plata al
   * dueño: la mercancía salía por la puerta y el sistema seguía contándola en
   * bodega (4 de sus 5 créditos no movieron un gramo). Ahora el crédito arma su
   * venta por el mismo camino que una venta, así que se comprueba lo de verdad:
   * que lo que se escribe aquí SALE del inventario.
   */
  it('un perfumero vendido a crédito sale de la bodega, como en una venta', async () => {
    await crearCliente(`fiado-${Date.now()}@ejemplo.com`);
    const { contexto, pagina } = await abrirDashboard();
    const antes = await prisma.insumoCosto.findUniqueOrThrow({ where: { id: insumoId } });

    await irA(pagina, '/dashboard/creditos');
    await pagina.waitForSelector('text=Nuevo crédito');
    await pagina.getByRole('button', { name: /nuevo crédito/i }).click();

    // Un cliente que ya existe: dar de alta uno nuevo es otro recorrido, y
    // mezclarlo aquí haría que un fallo suyo pareciera un fallo del inventario.
    await campo(pagina, 'Cliente *').click();
    await pagina.getByRole('option', { name: /Cliente De Prueba/i }).first().click();

    // El buscador de accesorios ya existe aquí: es el que estaba apagado.
    await pagina.getByRole('button', { name: /buscar y agregar accesorio/i }).click();
    await pagina.getByRole('option', { name: 'Perfumero Recargable', exact: true }).click();
    await pagina.getByLabel('Cantidad').fill('2');

    await pagina.getByRole('button', { name: /^Registrar crédito$/ }).click();
    // El modal se cierra cuando el servidor respondió: esperar el texto del
    // cliente no sirve, porque ese nombre también está dentro del formulario.
    await pagina.locator('[role=dialog]').waitFor({ state: 'detached', timeout: 30_000 });

    // Lo que de verdad importa: los dos perfumeros salieron del inventario.
    await expect.poll(async () => {
      const i = await prisma.insumoCosto.findUniqueOrThrow({ where: { id: insumoId } });
      return Number(antes.stock) - Number(i.stock);
    }, { timeout: 15_000 }).toBe(2);

    await contexto.close();
  });
});
