import { afterAll, describe, expect, it } from 'vitest';
import { abrirDashboard, campo, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — el acuerdo de pago que propone el formulario de Créditos.
 *
 * Créditos no tenía ningún recorrido, así que esta pantalla no la miraba nadie.
 * Se escribe al cambiar el plazo por defecto a **30 días de calendario**
 * (decidido por el dueño el 2026-08-23): antes se calculaba con `setMonth(+1)`
 * y en los días 29, 30 y 31 se desbordaba —el 31 de enero proponía el 3 de
 * marzo—, y eso el formulario lo mostraba tal cual.
 *
 * Comprueba lo que el dueño VE, no la aritmética: esa ya está probada sola en
 * `utils/fechas.test.ts`, y lo que se guarda de verdad en
 * `credito.plazo.bd.test.ts`. Aquí interesa que las dos coincidan, porque son
 * dos cálculos distintos —uno del navegador y otro del servidor— y el día que
 * se separen el dueño vería una fecha y se guardaría otra.
 */

afterAll(cerrarNavegador);

/** Suma días a 'AAAA-MM-DD' sin pasar por la hora local (la cuenta del recorrido). */
const mas30 = (fecha: string) => {
  const [a, m, d] = fecha.split('-').map(Number);
  const destino = new Date(Date.UTC(a, m - 1, d) + 30 * 86400000);
  return `${destino.getUTCFullYear()}-${String(destino.getUTCMonth() + 1).padStart(2, '0')}-${String(destino.getUTCDate()).padStart(2, '0')}`;
};

describe('el formulario de créditos', () => {
  it('propone la fecha límite a 30 días, y la recalcula si cambias la fecha', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/creditos');
    await pagina.waitForSelector('text=+ Nuevo crédito');

    await pagina.getByRole('button', { name: /nuevo crédito/i }).click();

    // Al abrirlo: hoy + 30 días.
    const fechaHoy = await campo(pagina, 'Fecha *').inputValue();
    expect(await campo(pagina, 'Fecha límite de pago *').inputValue()).toBe(mas30(fechaHoy));

    // Y si el dueño mueve la fecha del crédito a un 31, el plazo la sigue sin
    // desbordarse al mes de más: 31 de enero → 2 de marzo, no 3.
    await campo(pagina, 'Fecha *').fill('2026-01-31');
    await expect.poll(() => campo(pagina, 'Fecha límite de pago *').inputValue()).toBe('2026-03-02');

    await contexto.close();
  });
});
