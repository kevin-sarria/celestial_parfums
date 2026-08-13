import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { URL_API } from './arranque';
import { abrirDashboard, cabeceraAdmin, campo, cerrarNavegador, elegirProducto, irA } from './navegador';

/**
 * RECORRIDO 3 — el cupón canjeado queda amarrado a su venta.
 *
 * Es la regla que se arregló el 2026-08-02, y se arregló porque el sistema
 * regalaba el mismo cupón dos veces: bastaba con borrar el texto del campo al
 * editar la venta —incluso sin querer— para que el código volviera a quedar
 * activo.
 *
 * Se comprueba por los DOS caminos, y esa es la gracia: la pantalla lo impide
 * (campo bloqueado) y el servidor lo rechaza aunque alguien se salte la
 * pantalla. Probar solo el formulario dejaría sin red justo el agujero que
 * había.
 */

afterAll(cerrarNavegador);

const CODIGO = 'CP-RECORR1';
const PERSONA = 'Cliente con cupón';

let ventaId = 0;
let perfumeId = 0;
const PERFUME = 'Ventas 2';

beforeAll(async () => {
  const rol = await prisma.role.findFirstOrThrow();
  const cliente = await prisma.user.create({
    data: {
      nombre: 'Ana', apellido: 'Cupón', email: 'ana.cupon@prueba.local',
      password: 'x', rol_id: rol.id, activo: true,
    },
  });
  const campana = await prisma.anuncio.create({
    data: {
      titulo: 'Campaña del recorrido', tipo: 'descuento', audiencia: 'registrados',
      activo: true, descuento_pct: 10,
    },
  });
  await prisma.descuentoCodigo.create({
    data: { codigo: CODIGO, anuncio_id: campana.id, user_id: cliente.id, estado: 'activo' },
  });
  perfumeId = (await prisma.perfume.findFirstOrThrow({ where: { nombre: PERFUME } })).id;
});

describe('un cupón canjeado no se puede soltar editando la venta', () => {
  it('al registrar la venta como pagada, el código queda canjeado y enlazado', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/ventas');
    await pagina.waitForSelector('text=Registrar venta');

    await pagina.getByRole('button', { name: /registrar venta/i }).click();
    await campo(pagina, 'Persona *').fill(PERSONA);
    await elegirProducto(pagina, PERFUME);
    await campo(pagina, 'Valor de la venta (COP) *').fill('54000');
    await campo(pagina, 'Código de descuento (si el pedido de WhatsApp traía uno)').fill(CODIGO);
    await pagina.getByRole('button', { name: /^Registrar$/ }).click();
    await pagina.waitForSelector(`text=${PERSONA}`, { timeout: 30_000 });
    await contexto.close();

    const venta = await prisma.venta.findFirstOrThrow({ where: { persona: PERSONA } });
    ventaId = venta.id;

    const codigo = await prisma.descuentoCodigo.findUniqueOrThrow({ where: { codigo: CODIGO } });
    expect(codigo.estado).toBe('canjeado');
    expect(codigo.venta_id).toBe(ventaId);
  });

  it('al editarla, la pantalla muestra el campo BLOQUEADO y explica por qué', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/ventas');
    await pagina.waitForSelector(`text=${PERSONA}`, { timeout: 30_000 });

    // Abrir la venta para editarla.
    await pagina.locator('tr', { hasText: PERSONA }).first().getByRole('button').first().click();
    const bloqueado = campo(pagina, 'Código de descuento (si el pedido de WhatsApp traía uno)');
    await bloqueado.waitFor();

    expect(await bloqueado.isDisabled()).toBe(true);
    expect(await bloqueado.inputValue()).toBe(CODIGO);
    // Y se dice qué hacer, en vez de dejar un campo muerto sin explicación.
    await expect(pagina.getByText(/queda amarrado a esta venta/i).first()).toBeTruthy();

    await contexto.close();
  });

  it('y el SERVIDOR lo rechaza aunque alguien se salte la pantalla', async () => {
    const res = await fetch(`${URL_API}/api/ventas/${ventaId}`, {
      method: 'PATCH',
      headers: await cabeceraAdmin(),
      body: JSON.stringify({
        dia: '2026-08-12',
        persona: PERSONA,
        cantidad_perfumes: 1,
        presentacion: '30 ml',
        lineas: [{ perfume_id: perfumeId, ml: 30, cantidad: 1 }],
        valor_venta: 54000,
        pagada: true,
        codigo_descuento: '', // el intento de soltarlo
      }),
    });

    expect(res.ok).toBe(false);
    expect(await res.text()).toMatch(/ya canjeó el cupón/i);

    // Y sigue canjeado: el intento no dejó el cupón a medio soltar.
    const codigo = await prisma.descuentoCodigo.findUniqueOrThrow({ where: { codigo: CODIGO } });
    expect(codigo.estado).toBe('canjeado');
    expect(codigo.venta_id).toBe(ventaId);
  });

  it('borrar la venta SÍ lo libera: ahí la compra se deshizo de verdad', async () => {
    const res = await fetch(`${URL_API}/api/ventas/${ventaId}`, {
      method: 'DELETE',
      headers: await cabeceraAdmin(),
    });
    expect(res.ok).toBe(true);

    const codigo = await prisma.descuentoCodigo.findUniqueOrThrow({ where: { codigo: CODIGO } });
    expect(codigo.estado).toBe('activo');
    expect(codigo.venta_id).toBeNull();
  });
});
