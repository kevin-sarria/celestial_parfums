import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { abrirDashboard, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — configurar una alerta de inventario y verla saltar.
 *
 * Sale de dos quejas del dueño el 2026-08-29: el pedido sugerido le pedía
 * reponer una esencia que trajo *para probar* y que no ha vendido nunca, y no
 * tenía forma de que el sistema le avisara en grande cuando algo se acaba.
 *
 * Lo que vigila este recorrido es lo que une las dos cosas: **el número que se
 * teclea en Alertas es el mismo que usa el pedido sugerido**. Si alguien los
 * separa en dos ajustes, aquí se cae.
 */

const foto = (nombre: string) => path.join(os.tmpdir(), `celestial-${nombre}.png`);

afterAll(cerrarNavegador);

describe('alertas de inventario', () => {
  it('el mínimo que configuras avisa en el dashboard y ordena el pedido sugerido', async () => {
    // Un envase muy por debajo de cualquier mínimo razonable, y sin mínimo
    // propio: hoy, sin alerta de familia, no se avisa de él jamás.
    const envase = await prisma.insumoCosto.create({
      data: { nombre: 'Envase de recorrido 10 ml', tipo: 'envase', unidad: 'unidad', precio: 900, stock: 2 },
    });

    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/alertas');
    await pagina.waitForSelector('text=Alertas de inventario');

    // La pantalla dice qué marca AHORA con lo que hay configurado.
    await pagina.getByText(/Ahora mismo no marca nada/).first().waitFor({ timeout: 10_000 });

    /**
     * Es un FORMULARIO: se teclea y NO pasa nada hasta pulsar Guardar. Antes se
     * guardaba al salir del campo y la pantalla se recargaba entera —el dueño lo
     * pidió cambiar el 2026-08-29—, así que esta prueba vigila justo eso.
     */
    const casilla = pagina.getByLabel(/Avísame cuando queden menos de \(unidades\) — Envases/).first();
    await casilla.fill('50');
    await casilla.blur();
    await pagina.getByText(/Cambios sin guardar/).first().waitFor({ timeout: 10_000 });
    const antesDeGuardar = await prisma.alertaInventario.findFirst({ where: { ambito: 'envases' } });
    expect(Number(antesDeGuardar?.minimo ?? 0)).not.toBe(50);

    await pagina.getByRole('button', { name: 'Guardar cambios' }).click();

    // El servidor confirma, y la vista previa se rehace con lo que de verdad marca.
    await pagina.getByText(/Envase de recorrido 10 ml/).first().waitFor({ timeout: 15_000 });
    await pagina.getByText(/Todo guardado/).first().waitFor({ timeout: 10_000 });
    await pagina.screenshot({ path: foto('alertas-config') });

    const guardada = await prisma.alertaInventario.findFirstOrThrow({ where: { ambito: 'envases' } });
    expect(Number(guardada.minimo)).toBe(50);

    // 1. El aviso sale en el dashboard, en cualquier pestaña (aquí, en Ventas).
    await irA(pagina, '/dashboard/ventas');
    await pagina.getByText(/Envases por debajo del mínimo/).first().waitFor({ timeout: 15_000 });
    await pagina.screenshot({ path: foto('alertas-aviso') });

    // 2. Y ese MISMO número ordena el pedido sugerido: el envase aparece ahí.
    await irA(pagina, '/dashboard/reposicion');
    await pagina.getByText(/Envase de recorrido 10 ml/).first().waitFor({ timeout: 15_000 });

    // 3. Marcarlo "en prueba" lo saca de la lista, sin esconderlo.
    await pagina.getByRole('button', { name: /Marcar Envase de recorrido 10 ml como en prueba/ }).click();
    await pagina.getByText(/no te los estoy sugiriendo/).first().waitFor({ timeout: 15_000 });
    expect((await prisma.insumoCosto.findUniqueOrThrow({ where: { id: envase.id } })).en_prueba).toBe(true);
    await pagina.screenshot({ path: foto('alertas-en-prueba') });

    await contexto.close();
  }, 120_000);
});
