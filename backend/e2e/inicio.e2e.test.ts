import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { hoyEnColombia } from '../src/utils/fechas';
import { abrirDashboard, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — al entrar al panel se cae en INICIO, y lo que dice lleva a su detalle.
 *
 * Hasta el 2026-09-28 el panel abría en la lista de Perfumes. Inicio reúne lo
 * de otras pantallas (reporte de ventas, créditos, campana, pedido sugerido);
 * esas cuentas tienen sus propias pruebas. Aquí se vigila que la pantalla
 * cargue, que enseñe lo sembrado y que sus atajos naveguen.
 */

afterAll(cerrarNavegador);

describe('la pantalla de Inicio', () => {
  it('es la portada del panel y enseña las ventas del mes y los 1.1 por armar', async () => {
    // Categoría propia: los recorridos no comparten catálogo (ver `tienda.ts`)
    const categoria = await prisma.categoria.create({ data: { nombre: 'Inicio 1.1' } });
    const perfume = await prisma.perfume.create({
      data: { nombre: 'Frasco de Inicio 1.1', precio: 150000, categoria_id: categoria.id, solo_armado: true, publicado: true },
    });
    await prisma.venta.create({
      data: {
        dia: hoyEnColombia(), persona: 'Compradora de Inicio', cantidad_perfumes: 1, presentacion: '100 ml',
        referencia_perfume: 'Frasco de Inicio 1.1', valor_venta: 150000, pagada: true,
        perfumes: { create: [{ perfume_id: perfume.id, ml: 100, cantidad: 1 }] },
      },
    });

    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard');
    await pagina.waitForURL(/\/dashboard\/inicio$/);

    await pagina.getByText(/^Vendido en /).waitFor();
    await pagina.getByText('Compradora de Inicio').waitFor();
    const fila11 = pagina.locator('li', { hasText: 'Frasco de Inicio 1.1' });
    await fila11.getByText('1 vendido en 90 días').waitFor();

    // El atajo lleva al detalle
    await pagina.getByRole('link', { name: /Ver ventas/ }).click();
    await pagina.waitForURL(/\/dashboard\/ventas$/);
    expect(pagina.url()).toMatch(/ventas$/);

    await contexto.close();
  });
});
