import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { abrirComoCliente, abrirTienda, cerrarNavegador, cerrarPopup, irA } from './navegador';

/**
 * EL CLIENTE SABE QUE ENTRÓ (dueño, 2026-10-02: "no sienten algo super wow
 * cuando ingresan en su cuenta").
 *
 * Antes la portada era idéntica con y sin sesión y todo lo de la cuenta vivía
 * dentro del ☰. Se mide en el celular, que es donde compran.
 */

const CLIENTA = { email: 'cuenta@prueba.local', clave: 'Prueba123!' };
const foto = (n: string) => path.join(os.tmpdir(), `celestial-cuenta-${n}.png`);

beforeAll(async () => {
  const rol = await prisma.role.upsert({ where: { id: 2 }, update: {}, create: { id: 2, nombre: 'cliente' } });
  const perfume = await prisma.perfume.create({
    data: { nombre: 'Perfume de la Cuenta', precio: 60000, publicado: true, tipo_producto: 'comprado' },
  });
  const clienta = await prisma.user.create({
    data: {
      nombre: 'Laura', apellido: 'Gómez', email: CLIENTA.email, rol_id: rol.id, activo: true,
      password: await bcrypt.hash(CLIENTA.clave, 10),
    },
  });
  await prisma.favorito.create({ data: { user_id: clienta.id, perfume_id: perfume.id } });
});

afterAll(async () => {
  await prisma.favorito.deleteMany({ where: { user: { email: CLIENTA.email } } });
  await prisma.user.deleteMany({ where: { email: CLIENTA.email } });
  await prisma.perfume.deleteMany({ where: { nombre: 'Perfume de la Cuenta' } });
  await cerrarNavegador();
});

describe('la cuenta del cliente', () => {
  it('sin sesión, "Entrar" lleva al login recordando de dónde venía', async () => {
    const { contexto, pagina } = await abrirTienda();
    await irA(pagina, '/perfume/perfume-de-la-cuenta');
    await cerrarPopup(pagina);
    await pagina.getByRole('button', { name: 'Entrar' }).click();
    await pagina.waitForURL(/\/login$/);
    const desde = await pagina.evaluate(() => (history.state as { usr?: { desde?: string } })?.usr?.desde);
    expect(desde).toBe('/perfume/perfume-de-la-cuenta');
    await contexto.close();
  });

  it('con sesión, se ve en toda la tienda y Mi cuenta reúne lo que se le abrió', async () => {
    const { contexto, pagina } = await abrirComoCliente(CLIENTA.email, CLIENTA.clave);
    await pagina.setViewportSize({ width: 390, height: 844 });

    await irA(pagina, '/');
    await cerrarPopup(pagina);
    // Arriba, sus iniciales; debajo, la franja que la saluda
    const iniciales = pagina.getByRole('link', { name: 'Mi cuenta' }).first();
    expect(await iniciales.innerText()).toBe('LG');
    await pagina.getByText('Hola, Laura 👋').waitFor();
    await pagina.screenshot({ path: foto('portada') });

    await iniciales.click();
    await pagina.waitForURL(/\/mi-cuenta$/);
    await pagina.getByRole('heading', { name: 'Hola, Laura' }).waitFor();
    await pagina.getByText('1 perfume guardado').waitFor();
    await pagina.getByText(/Aún no tienes compras/).waitFor();
    // Nada se sale de la pantalla del celular
    const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(desborde).toBeLessThanOrEqual(0);
    await pagina.waitForTimeout(800); // que termine de aparecer (animate-fade-up)
    await pagina.screenshot({ path: foto('mi-cuenta') });
    await contexto.close();
  });
});
