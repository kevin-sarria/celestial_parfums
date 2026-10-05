import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { hoyEnColombia } from '../src/utils/fechas';
import { abrirDashboard, campo, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — el maestro de mensajes, de punta a punta.
 *
 * Lo que se vigila es el camino completo, que toca tres pantallas: sin mensajes
 * el botón de cobro sale APAGADO y al tocarlo explica por qué; escribirlo en el
 * maestro enciende el botón; y al cobrar, el mensaje sale con los datos del
 * cliente dentro (`{nombre}`, `{saldo}`, `{vence}`), no con las llaves.
 *
 * El relleno en sí (la aritmética de fechas, la frase de vencimiento) está
 * probado aparte en `frontend/src/application/mensajes.test.ts`.
 */

afterAll(cerrarNavegador);

const foto = (n: string) => path.join(os.tmpdir(), `celestial-mensajes-${n}.png`);
const haceDias = (n: number) => new Date(hoyEnColombia().getTime() - n * 86_400_000);

describe('el maestro de mensajes', () => {
  it('enciende el botón de cobro y manda el mensaje con los datos del cliente', async () => {
    // Se parte de cero: la prueba decide qué mensajes existen, no los que
    // hayan quedado de una corrida anterior.
    await prisma.plantillaMensaje.deleteMany({});
    const rol = await prisma.role.upsert({ where: { id: 2 }, update: {}, create: { id: 2, nombre: 'cliente' } });
    const clienta = await prisma.user.create({
      data: {
        nombre: 'Laura', apellido: 'Gómez', telefono: '300 987 6543',
        email: `laura-${Date.now()}@prueba.local`, password: 'x', rol_id: rol.id,
      },
    });
    // Vence en 5 días: así la frase tiene que salir "vence en 5 días".
    await prisma.credito.create({
      data: {
        fecha: haceDias(25), user_id: clienta.id, articulos: 'Khamrah 30 ml',
        deuda_inicial: 137000, fecha_limite: haceDias(-5),
      },
    });

    const { contexto, pagina } = await abrirDashboard();

    // ── 1. Sin mensajes: el botón está apagado y lo explica ────────────────
    await irA(pagina, '/dashboard/creditos');
    const fila = pagina.locator('tr', { hasText: 'Laura Gómez' }).first();
    await fila.getByTitle(/Todavía no has escrito el mensaje/).click();
    await pagina.getByText('Todavía no hay mensaje para cobrar').waitFor();
    await pagina.screenshot({ path: foto('sin-mensaje') });

    // Y desde ahí mismo se va a escribirlo.
    await pagina.getByRole('button', { name: /Escribirlo ahora/ }).click();
    await pagina.getByText('Todavía no has escrito ninguno').waitFor();

    // ── 2. Se escribe el mensaje en el maestro ─────────────────────────────
    await pagina.getByRole('button', { name: /Escribir el primero/ }).click();
    await campo(pagina, '¿Cómo lo llamas? *').fill('Relajado');
    await campo(pagina, 'El mensaje *').fill('ey {nombre}, como vamos? ');
    // El botón de la marca la mete donde está el cursor.
    await pagina.getByRole('button', { name: '+ {saldo}' }).click();
    await campo(pagina, 'El mensaje *').pressSequentially(' — tu crédito {vence}');
    // La vista previa usa el MISMO relleno que el botón de verdad.
    await pagina.getByText(/ey Laura, como vamos\?/).waitFor();
    await pagina.screenshot({ path: foto('editor') });
    await pagina.getByRole('button', { name: 'Guardar' }).click();
    await pagina.getByText('Relajado').waitFor();

    // ── 3. El botón se enciende y el mensaje sale con los datos dentro ─────
    await irA(pagina, '/dashboard/creditos');
    const fila2 = pagina.locator('tr', { hasText: 'Laura Gómez' }).first();
    await fila2.getByTitle('Recordarle el pago por WhatsApp').click();
    const modal = pagina.locator('[role="dialog"]');
    await modal.getByText(/Recordarle el pago a Laura/).waitFor();
    const texto = (await modal.innerText()).replace(/\s+/g, ' ');
    // Los datos del crédito, no las llaves.
    expect(texto).toContain('ey Laura, como vamos?');
    expect(texto).toContain('$ 137.000');
    expect(texto).toContain('vence en 5 días');
    expect(texto).not.toContain('{saldo}');
    // Y el chat va al cliente, que sí tiene teléfono.
    expect(await modal.getByRole('button', { name: /Abrir WhatsApp/ }).isVisible()).toBe(true);
    // Que termine la animación del modal: sin la pausa la foto sale a medias.
    await pagina.waitForTimeout(500);
    await pagina.screenshot({ path: foto('cobro') });

    // En el celular también cabe.
    await pagina.setViewportSize({ width: 390, height: 844 });
    await modal.getByText(/Recordarle el pago a Laura/).waitFor();
    const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
    expect(ancho).toBeLessThanOrEqual(390);

    await contexto.close();
  }, 120_000);
});
