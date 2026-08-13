import { afterAll, describe, expect, it } from 'vitest';
import { abrirDashboard, abrirTienda, cerrarNavegador, irA } from './navegador';

/**
 * Comprobación de que el andamiaje está en pie: la tienda carga, el backend
 * responde y la sesión de administrador entra al dashboard.
 *
 * Va primero a propósito. Si esto falla, los demás recorridos fallarían todos
 * a la vez y por el mismo motivo, y buscarlo en cada uno haría perder el rato.
 */

afterAll(cerrarNavegador);

describe('el andamiaje de los recorridos', () => {
  it('la tienda abre y muestra el catálogo', async () => {
    const { contexto, pagina } = await abrirTienda();

    await irA(pagina, '/perfumes');
    await pagina.waitForSelector('text=/Carrito 1/i', { timeout: 30_000 });

    await contexto.close();
  });

  it('sin sesión, el dashboard no deja pasar', async () => {
    const { contexto, pagina } = await abrirTienda();

    await irA(pagina, '/dashboard/perfumes');
    await pagina.waitForLoadState('networkidle');

    expect(pagina.url()).not.toContain('/dashboard/');

    await contexto.close();
  });

  it('con la sesión de administrador, el dashboard abre', async () => {
    const { contexto, pagina } = await abrirDashboard();

    await irA(pagina, '/dashboard/perfumes');
    await pagina.waitForLoadState('networkidle');

    expect(pagina.url()).toContain('/dashboard/perfumes');
    // Y trae datos: no es la pantalla vacía de "no pudimos cargar".
    await expect(pagina.getByText('Carrito 1').first()).toBeTruthy();

    await contexto.close();
  });
});
