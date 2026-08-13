import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { abrirDashboard, campo, cerrarNavegador, elegirProducto, irA } from './navegador';

/**
 * RECORRIDO 2 — registrar una venta con líneas descuenta el inventario.
 *
 * Es el corazón del sistema y toca cinco piezas de una vez: el formulario de
 * líneas (producto + talla + cantidad), la receta de la talla, el descuento de
 * cada material, el costo de mercancía congelado y la ganancia del mes.
 *
 * Aquí se arma CONTRA PEDIDO, así que es la venta la que gasta los insumos. Si
 * descuenta de menos, la ganancia del mes sale inflada y no se nota en ninguna
 * pantalla.
 *
 * Regla en CLAUDE.md → "PASO 3 COMPLETO — LA VENTA CONSUME INVENTARIO".
 */

afterAll(cerrarNavegador);

const stockDe = async (nombre: string) => {
  const i = await prisma.insumoCosto.findFirstOrThrow({ where: { nombre } });
  return Number(i.stock);
};

describe('registrar una venta desde el dashboard', () => {
  it('descuenta la receta del inventario y congela lo que costó', async () => {
    const perfume = 'Ventas 1';
    const antes = {
      esencia: await stockDe(`${perfume} – Esencia`),
      diluyente: await stockDe('Diluyente'),
      sellador: await stockDe('Sellador'),
      feromonas: await stockDe('Feromonas'),
      frasco: await stockDe('Frasco 30 ml'),
    };

    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/ventas');
    await pagina.waitForSelector('text=Registrar venta');

    await pagina.getByRole('button', { name: /registrar venta/i }).click();
    await campo(pagina, 'Persona *').fill('Cliente del recorrido');

    await elegirProducto(pagina, perfume);
    await pagina.getByLabel('Cantidad').first().fill('2');

    await campo(pagina, 'Valor de la venta (COP) *').fill('120000');
    await pagina.getByRole('button', { name: /^Registrar$/ }).click();

    // La fila ya aparece en la tabla: el servidor respondió.
    await pagina.waitForSelector('text=Cliente del recorrido', { timeout: 30_000 });
    await contexto.close();

    // ── El inventario bajó exactamente la receta × 2 unidades ──
    expect(await stockDe(`${perfume} – Esencia`)).toBe(antes.esencia - 30);
    expect(await stockDe('Diluyente')).toBe(antes.diluyente - 28.6);
    expect(await stockDe('Sellador')).toBe(antes.sellador - 0.8);
    expect(await stockDe('Feromonas')).toBe(antes.feromonas - 0.6);
    expect(await stockDe('Frasco 30 ml')).toBe(antes.frasco - 2);

    // ── Y la venta guardó su costo, que es de donde sale la ganancia real ──
    const venta = await prisma.venta.findFirstOrThrow({
      where: { persona: 'Cliente del recorrido' },
      include: { perfumes: true },
    });
    // 15×400 + 14,3×20 + 0,4×100 + 0,3×100 + 2.850 = 9.206 cada uno
    expect(Number(venta.costo_mercancia)).toBe(18412);
    // La talla se guarda POR LÍNEA, no como un texto suelto de toda la venta.
    expect(venta.perfumes).toHaveLength(1);
    expect(venta.perfumes[0].ml).toBe(30);
    expect(venta.perfumes[0].cantidad).toBe(2);
  });
});
