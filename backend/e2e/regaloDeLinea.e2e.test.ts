import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { crearInsumo } from '../src/test/baseDePrueba';
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
 * tiene su buscador aparte y su campo Regalo, y el otro que en Créditos no
 * aparece ninguna de las dos cosas. Por eso se crea una sola vez.
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
   * NO REGRESIÓN — Créditos se quedó exactamente como estaba.
   *
   * Su backend no guarda el regalo, así que su `<ArmadorPedido>` no enciende
   * `permitirExtras`: sin campo "Regalo" y sin buscador de accesorios. Si
   * alguien lo encendiera por error, la pantalla dejaría escribir un regalo
   * que el servidor descarta en silencio — el defecto que esa prop evita.
   * Antes esto era un paso manual del plan; aquí queda comprobado solo.
   */
  it('no se asoma en Créditos: ni campo Regalo ni buscador de accesorios', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/creditos');
    await pagina.waitForSelector('text=Nuevo crédito');
    await pagina.getByRole('button', { name: /nuevo crédito/i }).click();

    // Sin `permitirExtras`, el buscador de siempre muestra TODO el catálogo,
    // accesorios incluidos: es el único sitio donde se pueden agregar.
    await pagina.getByRole('button', { name: /buscar y agregar perfume/i }).click();
    await pagina.getByRole('option', { name: 'Perfumero Recargable', exact: true }).click();

    // La línea existe (tiene su Cantidad), pero no lo nuevo de Ventas.
    await pagina.getByLabel('Cantidad').waitFor();
    expect(await pagina.getByLabel('Regalo').count()).toBe(0);
    expect(await pagina.getByRole('button', { name: /buscar y agregar accesorio/i }).count()).toBe(0);

    // Se cierra sin guardar: el recorrido mira la pantalla, no crea deudas.
    await contexto.close();
  });
});
