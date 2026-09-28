import { afterAll, describe, expect, it } from 'vitest';
import { abrirDashboard, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — las cinco clasificaciones son UNA entrada del menú (2026-09-28).
 * Se entra por "Clasificaciones" y se pasa de una lista a otra con las
 * pestañas de arriba; cada lista conserva su propia dirección.
 */

afterAll(cerrarNavegador);

describe('las clasificaciones', () => {
  it('se abren desde una sola entrada del menú y se recorren con las pestañas de arriba', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/inicio');

    await pagina.getByLabel('Abrir menú de apartados').click();
    await pagina.getByRole('button', { name: 'Ajustes' }).click();
    await pagina.getByRole('button', { name: 'Clasificaciones' }).click();
    await pagina.waitForURL(/\/dashboard\/aromas$/);

    const pestanas = pagina.getByRole('navigation', { name: 'Clasificaciones' });
    await pestanas.getByRole('link', { name: 'Ocasiones' }).click();
    await pagina.waitForURL(/\/dashboard\/ocasiones$/);
    await expect.poll(() => pestanas.getByRole('link', { name: 'Ocasiones' }).getAttribute('aria-current')).toBe('page');

    await contexto.close();
  });
});
