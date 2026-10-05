import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { abrirDashboard, campo, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — el nombre que se escribe ofrece al cliente, sin buscarlo.
 *
 * Nació de un número: **225 de 342 ventas estaban sin cliente** (2026-10-04), y
 * sin cliente no hay recompra, ni sellos, ni a quién escribirle. El formulario
 * siempre tuvo el desplegable "Cliente enlazado", pero es opcional y cuesta
 * abrirlo; esto lo ofrece con el nombre ya escrito. Y de paso deja el teléfono a
 * la vista, que es lo que faltaba para poder escribirle sin buscarlo a mano.
 */

afterAll(cerrarNavegador);

const foto = (n: string) => path.join(os.tmpdir(), `celestial-venta-cliente-${n}.png`);

describe('la venta captura al cliente', () => {
  it('con el nombre escrito ofrece guardarlo y pide el teléfono', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/ventas');
    await pagina.waitForSelector('text=Registrar venta');
    await pagina.getByRole('button', { name: /registrar venta/i }).click();

    // Un nombre que no está entre los clientes: la app lo dice sola.
    await campo(pagina, 'Persona *').fill('Gerardo Arias');
    await pagina.getByText(/todavía no es cliente/).waitFor();
    await pagina.screenshot({ path: foto('aviso') });

    await pagina.getByRole('button', { name: /Guardarlo y ponerle el teléfono/ }).click();

    // El bloque de persona nueva aparece con el nombre YA partido: no se teclea dos veces.
    await expect.poll(() => campo(pagina, 'Nombre *').inputValue()).toBe('Gerardo');
    expect(await campo(pagina, 'Apellido *').inputValue()).toBe('Arias');
    // Y el teléfono queda a la vista, que es lo que faltaba para poder escribirle.
    await campo(pagina, 'Teléfono').waitFor();
    await pagina.screenshot({ path: foto('escritorio') });

    // Y cabe en el celular, que es donde el dueño registra las ventas.
    await pagina.setViewportSize({ width: 390, height: 844 });
    await campo(pagina, 'Teléfono').waitFor();
    const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
    expect(ancho).toBeLessThanOrEqual(390);
    await pagina.screenshot({ path: foto('celular') });

    await contexto.close();
  }, 90_000);

  it('reconoce al cliente que YA existe y lo enlaza de un toque', async () => {
    const rol = await prisma.role.upsert({ where: { id: 2 }, update: {}, create: { id: 2, nombre: 'cliente' } });
    await prisma.user.create({
      data: {
        nombre: 'Ingrid', apellido: 'García', telefono: '3001234567',
        email: `ingrid-${Date.now()}@prueba.local`, password: 'x', rol_id: rol.id,
      },
    });

    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/ventas');
    await pagina.waitForSelector('text=Registrar venta');
    await pagina.getByRole('button', { name: /registrar venta/i }).click();

    // Mismo nombre, con tilde y todo: tiene que reconocerlo igual.
    await campo(pagina, 'Persona *').fill('Ingrid Garcia');
    await pagina.getByText(/Ya tienes a/).waitFor();
    await pagina.getByRole('button', { name: /Enlazar esta venta/ }).click();

    // La venta queda enlazada: el desplegable muestra su ficha y el aviso se va.
    await expect.poll(async () => pagina.getByText(/Ingrid García ·/).first().isVisible()).toBe(true);
    expect(await pagina.getByText(/Ya tienes a/).count()).toBe(0);

    await contexto.close();
  }, 90_000);
});
