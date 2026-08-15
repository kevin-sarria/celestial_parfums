import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { abrirDashboard, campo, cerrarNavegador, elegirOpcion, irA } from './navegador';

/**
 * RECORRIDO — registrar una compra da de alta el material, lo mete al
 * inventario y le fija su costo.
 *
 * Es la otra mitad del recorrido de la venta: ahí el material sale, aquí entra.
 * Y es donde nace el número del que cuelga todo lo demás —el costo del insumo—,
 * así que se comprueba con la aritmética real, no con "aparece en la tabla".
 *
 * **Compra un material PROPIO, creado desde la misma factura.** Al principio
 * usaba el "Frasco 30 ml" sembrado y subía su costo promedio, con lo que el
 * recorrido de la venta —que comprueba un costo exacto— fallaba según el orden
 * de los archivos. Misma regla que las categorías: cada recorrido con lo suyo.
 *
 * Se escribió al pasar Proveedores y el detalle de compra a la capa HTTP única.
 */

afterAll(cerrarNavegador);

describe('registrar una compra a un proveedor', () => {
  it('crea el material desde la factura, lo suma al inventario y le pone su costo', async () => {
    const MATERIAL = `Frasco del recorrido ${Date.now()}`;
    const UNIDADES = 100;
    const PAGADO = 400_000; // $4.000 cada uno

    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/pagos');
    await pagina.waitForSelector('text=Registrar pago');

    await pagina.getByRole('button', { name: '+ Registrar pago' }).click();
    await campo(pagina, 'Dia *').fill(new Date().toISOString().slice(0, 10));
    await campo(pagina, 'Valor compra (COP) *').fill(String(PAGADO));

    // La empresa se crea aquí mismo: mandar al dueño a otra pantalla a mitad de
    // una factura es perder el hilo (por eso existe "+ Registrar empresa nueva").
    await pagina.getByRole('button', { name: /selecciona una empresa/i }).click();
    await pagina.getByRole('option', { name: '+ Registrar empresa nueva' }).click();
    const empresa = `Distribuidora del recorrido ${Date.now()}`;
    await campo(pagina, 'Nombre empresa *').fill(empresa);

    // Material nuevo sin salir de la factura, que es el caso real: llega un
    // envase que nunca habías comprado.
    await pagina.getByRole('button', { name: /agregar insumo a la compra/i }).click();
    await pagina.getByRole('option', { name: /crear insumo nuevo/i }).click();
    await campo(pagina, '¿Cómo se llama?').fill(MATERIAL);
    await elegirOpcion(pagina, '¿Qué es?', /envase/i);
    await elegirOpcion(pagina, '¿Cómo se mide?', /por unidad/i);
    await pagina.getByRole('button', { name: /crear y agregar/i }).click();

    // Queda agregado como línea de la compra, listo para ponerle cantidad.
    await pagina.getByLabel('Cantidad').waitFor();
    await pagina.getByLabel('Cantidad').fill(String(UNIDADES));
    await pagina.getByLabel('Lo que costó').fill(String(PAGADO));

    await pagina.getByRole('button', { name: /^Registrar$/ }).click();
    await pagina.waitForSelector(`text=${empresa}`);
    await contexto.close();

    // ── El material entró con su cantidad… ──
    const insumo = await prisma.insumoCosto.findFirstOrThrow({ where: { nombre: MATERIAL } });
    expect(Number(insumo.stock)).toBe(UNIDADES);
    // ── …y con el costo que salió de ESTA compra, no con el 0 del alta ──
    expect(Number(insumo.precio)).toBe(PAGADO / UNIDADES);

    // La compra quedó registrada con su empresa (es lo que suma en los totales).
    const pago = await prisma.pagoProveedor.findFirst({
      where: { empresa: { nombre: empresa } },
      include: { empresa: true },
    });
    expect(pago).not.toBeNull();
    expect(Number(pago!.valor_compra)).toBe(PAGADO);
  });
});
