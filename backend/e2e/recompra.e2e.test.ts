import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { hoyEnColombia } from '../src/utils/fechas';
import { abrirDashboard, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — la lista de recompra enseña a quién le toca volver a comprar,
 * con su mensaje listo para WhatsApp.
 *
 * El cálculo (ritmo por cliente, punto medio, estados) está probado aparte en
 * `recompra.calculo.test.ts`; aquí se vigila que la pantalla lo muestre y que
 * el botón lleve el mensaje con el perfume de su última compra.
 */

afterAll(cerrarNavegador);

const haceDias = (n: number) => new Date(hoyEnColombia().getTime() - n * 86_400_000);

describe('la lista de recompra', () => {
  it('muestra a quien le toca y le arma el mensaje de WhatsApp', async () => {
    // Compra cada 20 días; la última hace 25 → le tocaba hace 5
    const base = { cantidad_perfumes: 1, presentacion: '30 ml', valor_venta: 60000, pagada: true };
    await prisma.venta.createMany({
      data: [
        { ...base, dia: haceDias(45), persona: 'Recompradora Prueba', referencia_perfume: 'Eternity 30ml' },
        { ...base, dia: haceDias(25), persona: 'Recompradora Prueba', referencia_perfume: 'Khamrah 30ml' },
        // Genérico: no es una persona y no debe salir
        { ...base, dia: haceDias(60), persona: 'Cliente random', referencia_perfume: 'Eternity 30ml' },
        { ...base, dia: haceDias(40), persona: 'Cliente random', referencia_perfume: 'Eternity 30ml' },
      ],
    });

    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/recompra');

    const tarjeta = pagina.locator('li', { hasText: 'Recompradora Prueba' });
    await tarjeta.getByText('Le tocaba hace 5 días').waitFor();
    const enlace = await tarjeta.getByRole('link', { name: /WhatsApp/ }).getAttribute('href');
    expect(decodeURIComponent(enlace ?? '')).toContain('tu Khamrah 30ml');
    expect(await pagina.getByText('Cliente random').count()).toBe(0);

    await contexto.close();
  });
});
