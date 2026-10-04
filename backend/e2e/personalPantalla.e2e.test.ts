import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { URL_API } from './arranque';
import { abrirComoCliente, abrirDashboard, cabeceraAdmin, campo, cerrarNavegador, elegirProducto, irA } from './navegador';

/**
 * EL PANEL DEL PERSONAL, en pantalla (2026-10-04). Una vendedora con "ver y
 * registrar ventas": entra directo a Ventas, ve solo sus pestañas, no puede
 * escribir el precio y, si pide un descuento, la venta le llega al dueño, que
 * la aprueba desde Solicitudes.
 */

const VENDEDORA = { email: 'vendedora.pantalla@prueba.local', clave: 'Prueba123!' };
const CLIENTE = 'Cliente de la vendedora';
const foto = (n: string) => path.join(os.tmpdir(), `celestial-personal-${n}.png`);
let rolId = 0;

beforeAll(async () => {
  await prisma.role.upsert({ where: { id: 2 }, update: {}, create: { id: 2, nombre: 'cliente' } });
  // Por el panel, como lo hace el dueño: creado directo en la base, el servidor
  // no se entera (guarda los roles en memoria) si otra prueba ya los cargó.
  const rol = await fetch(`${URL_API}/api/roles`, {
    method: 'POST', headers: await cabeceraAdmin(),
    body: JSON.stringify({ nombre: 'Vendedora de pantalla', permisos: ['ventas.ver', 'ventas.registrar', 'catalogo.ver'] }),
  });
  expect(rol.status).toBe(201);
  rolId = (await rol.json()).data.id;
  await prisma.user.create({
    data: { nombre: 'Sara', apellido: 'Vende', email: VENDEDORA.email, password: await bcrypt.hash(VENDEDORA.clave, 10), rol_id: rolId, activo: true },
  });
});

afterAll(async () => {
  await prisma.solicitud.deleteMany({ where: { resumen: { contains: CLIENTE } } });
  await prisma.venta.deleteMany({ where: { persona: CLIENTE } });
  await prisma.user.deleteMany({ where: { email: VENDEDORA.email } });
  await prisma.role.deleteMany({ where: { id: rolId } });
  await cerrarNavegador();
});

describe('el panel del personal', () => {
  it('la vendedora ve solo lo suyo, no escribe el precio y su descuento espera al dueño', async () => {
    const { contexto, pagina } = await abrirComoCliente(VENDEDORA.email, VENDEDORA.clave);
    // Desde la tienda encuentra la puerta a su panel (antes no había ninguna)
    await irA(pagina, '/');
    await pagina.getByRole('link', { name: 'Mi panel' }).waitFor();
    await pagina.screenshot({ path: foto('tienda') });
    // Nada de lo que pide el panel le responde "sin permiso" (antes la sacaba de la sesión)
    const negadas: string[] = [];
    pagina.on('response', (r) => { if (r.status() === 403 || r.status() === 401) negadas.push(`${r.status()} ${r.url()}`); });
    await irA(pagina, '/dashboard');
    await pagina.waitForURL(/\/dashboard\/ventas$/);

    await pagina.getByRole('button', { name: /Abrir menú/ }).click();
    const menu = pagina.getByRole('dialog');
    await menu.getByRole('button', { name: 'Ventas', exact: true }).waitFor();
    const textoMenu = await menu.innerText();
    expect(textoMenu).toContain('Solicitudes');
    for (const ajeno of ['Inicio', 'Créditos', 'Inventario', 'Usuarios', 'Historial de cambios']) expect(textoMenu).not.toContain(ajeno);
    await pagina.screenshot({ path: foto('menu') });
    expect(negadas).toEqual([]);
    expect(textoMenu.toLowerCase()).toContain('catálogo'); // la sección, cerrada: Perfumes vive adentro
    await pagina.keyboard.press('Escape');

    // Con "ver el catálogo" mira los perfumes, sin crear, importar ni editar
    await irA(pagina, '/dashboard/contratipos');
    await pagina.getByRole('heading', { name: /Contratipos/ }).first().waitFor();
    expect(await pagina.getByRole('button', { name: '+ Nuevo perfume' }).count()).toBe(0);
    expect(await pagina.getByRole('button', { name: /Importar/ }).count()).toBe(0);
    await pagina.screenshot({ path: foto('catalogo') });
    expect(negadas).toEqual([]);

    await irA(pagina, '/dashboard/ventas');
    await pagina.getByRole('button', { name: /registrar venta/i }).click();
    await campo(pagina, 'Persona *').fill(CLIENTE);
    await elegirProducto(pagina, 'Ventas 1');
    await pagina.keyboard.press('Escape');
    // No hay casilla de valor libre: el precio lo pone la app
    expect(await pagina.getByLabel('Valor de la venta (COP) *').count()).toBe(0);
    await pagina.getByRole('button', { name: 'Pedir un descuento' }).click();
    await campo(pagina, '¿En cuánto se lo dejas? (COP)').fill('20000');
    await campo(pagina, '¿Por qué el descuento? *').fill('Clienta frecuente');
    await pagina.screenshot({ path: foto('descuento') });
    await pagina.getByRole('button', { name: /^Registrar$/ }).click();
    await pagina.getByText(/se envió al dueño/i).waitFor();
    expect(await prisma.venta.count({ where: { persona: CLIENTE } })).toBe(0);
    await contexto.close();
  });

  it('el dueño la ve en Solicitudes y al aprobarla se registra con el descuento', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/solicitudes');
    const tarjeta = pagina.getByRole('listitem').filter({ hasText: CLIENTE });
    await tarjeta.waitFor();
    expect(await tarjeta.innerText()).toContain('Clienta frecuente');
    await pagina.screenshot({ path: foto('solicitudes') });
    await tarjeta.getByRole('button', { name: 'Aprobar' }).click();
    await tarjeta.getByText('Aprobada').waitFor();

    const venta = await prisma.venta.findFirstOrThrow({ where: { persona: CLIENTE } });
    expect(Number(venta.valor_venta)).toBe(20000);
    await contexto.close();
  });

  it('el dueño ve sus roles con las casillas, y en Usuarios el rol de cada quien', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/roles');
    await pagina.getByText('Vendedora de pantalla').waitFor();
    await pagina.getByRole('button', { name: '+ Nuevo rol' }).click();
    await pagina.getByText('Dar descuentos, regalos y cupones sin pedir permiso').waitFor();
    await pagina.waitForTimeout(400);
    await pagina.screenshot({ path: foto('roles') });
    await pagina.keyboard.press('Escape');

    await irA(pagina, '/dashboard/usuarios');
    const fila = pagina.getByRole('row', { name: /Sara Vende/ });
    await fila.waitFor();
    expect(await fila.innerText()).toContain('Vendedora de pantalla');
    await contexto.close();
  });
});
