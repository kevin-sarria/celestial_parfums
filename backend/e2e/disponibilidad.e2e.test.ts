import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { abrirDashboard, abrirTienda, cabeceraAdmin, cerrarPopup, cerrarNavegador, campo, irA } from './navegador';
import { URL_API } from './arranque';

/**
 * RECORRIDO 6 — un 1.1 no se ofrece hasta que está ARMADO.
 *
 * Nace de un caso real del dueño (2026-08-14): tiene el *Envase Khamrah 1.1*
 * comprado y su esencia en bodega, y ese perfume **no debe verse en la tienda**
 * hasta producirlo. Es la diferencia con un contratipo, que sí se arma contra
 * pedido.
 *
 * Se prueba en navegador porque la regla vive en tres sitios a la vez y solo
 * juntos sirven de algo: la casilla del formulario, la etiqueta de la tabla que
 * lo explica y el catálogo que lo esconde. Con una sola de las tres, el dueño
 * cree que vendió lo que no puede entregar.
 */

afterAll(cerrarNavegador);

const NOMBRE = 'Khamrah 1.1 de prueba';

/**
 * Las fotos van a la carpeta temporal del sistema, no al repositorio: son para
 * MIRAR la pantalla cuando algo se ve raro, no un archivo que haya que versionar.
 * La ruta se imprime al correr.
 */
const foto = (nombre: string) => path.join(os.tmpdir(), `celestial-${nombre}.png`);

describe('un producto que solo se vende armado', () => {
  it('sale agotado en la tienda aunque le sobre esencia', async () => {
    // Un 1.1 es un PRODUCTO (se arma antes de venderse), así que su ficha se
    // crea desde la pestaña Productos, no desde Perfumes.
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/productos');
    await pagina.waitForSelector('text=+ Nuevo producto');

    // 1. Se crea la ficha marcando la casilla del 1.1.
    await pagina.getByRole('button', { name: '+ Nuevo producto' }).click();
    await campo(pagina, 'Nombre *').fill(NOMBRE);
    await campo(pagina, 'Precio de respaldo (COP) *').fill('150000');

    // "+ Nuevo producto" arranca en "comprado" (Hallazgo 1 de la revisión final
    // de la Ola 1, 2026-08-23): sin esto el producto se iba a Perfumes. Un 1.1
    // sigue siendo "fabricado" por dentro (solo_armado es lo que lo manda a la
    // familia Productos), así que hay que pasarlo a mano ANTES de tocar la
    // esencia: en "comprado" también se ve "¿Qué insumo ES este producto?",
    // con su propio placeholder "— Sin asignar —", y con las dos casillas a la
    // vez el selector de la esencia deja de ser único.
    await pagina.getByRole('button', { name: /Lo compro hecho y lo revendo/ }).click();
    await pagina.getByRole('option', { name: /Lo fabrico yo \(contratipo, 1\.1\)/ }).click();

    // Su esencia, con 500 ml en bodega: de sobra para armar uno de 30 ml.
    await pagina.getByRole('button', { name: /Sin asignar/ }).click();
    await pagina.getByRole('option', { name: /Herod by Parfums de Marly/ }).click();

    await pagina.getByRole('checkbox', { name: /Solo se vende si ya está armado/ }).check();
    await pagina.getByRole('checkbox', { name: '30ml' }).check();
    await pagina.screenshot({ path: foto('form-1punto1') });
    await pagina.getByRole('button', { name: 'Crear producto' }).click();

    // 2. La tabla lo dice, y dice POR QUÉ.
    const fila = pagina.getByRole('row', { name: new RegExp(NOMBRE) });
    await fila.waitFor();
    expect(await fila.innerText()).toContain('Sin armar');

    await pagina.screenshot({ path: foto('tabla-sin-armar') });

    // Un producto nace APAGADO (Hallazgo 2 de la revisión final de la Ola 1,
    // 2026-08-23: la ficha se llena después y nadie debe ver una a medio
    // llenar). Antes de este recorrido publicarlo era automático; ahora hay
    // que devolverlo a la tienda a mano, como haría el dueño.
    expect(await fila.innerText()).toContain('Fuera de la tienda');
    await pagina.getByRole('button', { name: `Acciones de ${NOMBRE}` }).click();
    await pagina.getByRole('menuitem', { name: /Devolver a la tienda/ }).click();
    await pagina.getByRole('button', { name: 'Sí, devolverlo' }).click();
    // El badge "Fuera de la tienda" desaparece de la fila cuando la tabla se
    // refresca con la respuesta: esperarlo confirma que el guardado terminó.
    await fila.getByText('Fuera de la tienda').waitFor({ state: 'detached' });

    // 3. Y el catálogo público lo da agotado, que es lo que de verdad importa:
    //    con esencia de sobra, la regla vieja lo habría puesto a la venta.
    const res = await fetch(`${URL_API}/api/parfums`, { headers: await cabeceraAdmin() });
    const { data } = await res.json();
    const ficha = data.data.find((p: { nombre: string }) => p.nombre === NOMBRE);
    expect(ficha.agotado).toBe(true);
    expect(ficha.motivo_agotado).toBe('sin_armados');
    expect(ficha.insumo_esencia_stock).toBeGreaterThan(0); // la esencia SÍ está

    await contexto.close();
  });

  it('el cliente no puede agregarlo al carrito', async () => {
    const { contexto, pagina } = await abrirTienda();
    await irA(pagina, '/perfumes?q=Khamrah');
    await pagina.waitForSelector(`text=${NOMBRE}`);
    await cerrarPopup(pagina);

    const tarjeta = pagina.locator('article').filter({ hasText: NOMBRE }).first();
    expect(await tarjeta.innerText()).toMatch(/agotado/i);
    // Sin botón de comprar: una card agotada no se puede agregar al carrito.
    expect(await tarjeta.getByRole('button', { name: /agregar/i }).count()).toBe(0);

    await contexto.close();
  });

  it('al armar el lote aparece en Inventario y se puede vender', async () => {
    // Cierra el círculo: el 1.1 existía y estaba agotado; se arma y pasa a ser
    // producto terminado, visible como inventario y vendible.
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/inventario');
    await pagina.waitForSelector('text=Valor del inventario');

    await pagina.getByRole('button', { name: /Registrar uso/ }).click();
    await pagina.getByRole('menuitem', { name: /Armé perfumes/ }).click();
    // El botón del desplegable muestra la opción elegida, y de arranque es la
    // primera de la lista — no el `placeholder`.
    await pagina.getByRole('button', { name: /Sin especificar/ }).click();
    await pagina.getByRole('option', { name: NOMBRE, exact: true }).click();
    await campo(pagina, '¿Cuántas unidades?').fill('2');
    await pagina.getByRole('button', { name: 'Registrar lote' }).click();

    const fila = pagina.getByRole('row', { name: new RegExp(NOMBRE) });
    await fila.waitFor();
    expect(await fila.innerText()).toContain('2');
    // Y la franja de arriba dice cuánta plata está hoy en frascos, no en
    // material. Ojo: las etiquetas de las métricas se pintan en MAYÚSCULAS con
    // CSS, y `innerText` devuelve lo renderizado, no el texto del código.
    expect(await pagina.locator('body').innerText()).toMatch(/frascos armados/i);

    await fila.scrollIntoViewIfNeeded();
    await pagina.screenshot({ path: foto('inventario-frascos-armados') });

    const res = await fetch(`${URL_API}/api/parfums`, { headers: await cabeceraAdmin() });
    const { data } = await res.json();
    const ficha = data.data.find((p: { nombre: string }) => p.nombre === NOMBRE);
    expect(ficha.frascos_armados).toBe(2);
    expect(ficha.agotado).toBe(false);

    await contexto.close();
  });
});
