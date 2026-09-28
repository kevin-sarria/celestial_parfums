import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { createCredito } from '../src/repositories/credito.repository';
import { crearCliente } from '../src/test/baseDePrueba';
import { abrirDashboard, campo, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — un abono se guarda UNA vez, y uno equivocado se puede borrar.
 *
 * El 2026-09-05 un abono de $50.000 quedó doble en producción: se escribió el
 * monto, se dio Enter y entraron dos. El modal no se bloqueaba al guardar y el
 * Enter mandaba un abono por pulsación. Y no había cómo borrar el sobrante
 * desde la pantalla: el dueño tuvo que corregirlo en la base de datos.
 *
 * El freno del servidor está probado aparte (`credito.abono.bd.test.ts`); aquí
 * se prueba el de la PANTALLA, que es la puerta por la que entró el fallo.
 */

afterAll(cerrarNavegador);

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('abonar a un crédito desde el dashboard', () => {
  it('varios Enter seguidos registran un solo abono, y se puede borrar', async () => {
    const cliente = await crearCliente(`abono-e2e-${Date.now()}@prueba.com`);
    await prisma.user.update({ where: { id: cliente.id }, data: { nombre: 'Abonadora', apellido: 'Recorrido' } });
    const credito = await createCredito({
      fecha: hoy(), user_id: cliente.id, articulos: 'Un perfume', deuda_inicial: 240000,
    });

    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/creditos');
    const fila = pagina.locator('tr', { hasText: 'Abonadora' }).first();
    await fila.locator('[title^="Registrar abono"]').click();

    // Enter cuatro veces seguidas, sin esperar respuesta: lo que pasó en producción
    const monto = campo(pagina, 'Monto del abono (COP)');
    await monto.fill('50000');
    for (let i = 0; i < 4; i++) await monto.press('Enter', { delay: 0 }).catch(() => {});

    await pagina.getByText('Abono de $ 50.000 registrado').or(pagina.getByText(/Abono de .*50\.000 registrado/)).first().waitFor();
    // Un respiro para que cualquier envío de más alcance a llegar al servidor
    await pagina.waitForTimeout(800);
    expect(await prisma.creditoAbono.count({ where: { credito_id: credito.id } })).toBe(1);

    // La tabla dice cuántos pagos lleva, y el historial los enseña con su hora
    await fila.getByText('1 pago', { exact: true }).waitFor();
    await fila.locator('[title="Historial de pagos"]').click();
    await pagina.getByText('Pago 1', { exact: true }).waitFor();
    await pagina.getByText(/· \d{1,2}:\d{2} [ap]\. m\./).waitFor();
    await pagina.getByText(/Quedó en .*190\.000/).waitFor();

    // Y un abono equivocado se borra desde ahí mismo
    pagina.once('dialog', (d) => d.accept());
    await pagina.getByRole('button', { name: /Borrar abono de/ }).click();
    await pagina.getByText('Abono borrado').waitFor();
    expect(await prisma.creditoAbono.count({ where: { credito_id: credito.id } })).toBe(0);
    // Y la pantalla lo refleja sin recargar: ya no queda ninguno en la lista
    await expect.poll(() => pagina.getByRole('button', { name: /Borrar abono de/ }).count()).toBe(0);

    await contexto.close();
  });
});
