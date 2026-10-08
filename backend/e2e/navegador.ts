import fs from 'node:fs';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { ARCHIVO_SESION, URL_API, URL_TIENDA } from './arranque';

/**
 * El navegador de los recorridos.
 *
 * `playwright-core` sobre el **Edge que ya está instalado**: cero navegadores
 * descargados, que es la decisión que ya venía tomada en el proyecto
 * (`revisar-pantalla.mjs` hace lo mismo).
 */

let navegador: Browser | null = null;

export const abrirNavegador = async () => {
  navegador ??= await chromium.launch({ channel: 'msedge', headless: true });
  return navegador;
};

export const cerrarNavegador = async () => {
  await navegador?.close();
  navegador = null;
};

/**
 * La sesión de administrador, leída de donde la dejó el arranque.
 *
 * NO se pasa por el formulario de login a propósito: así no se carga el script
 * de reCAPTCHA de Google (que exigiría internet y añadiría un fallo
 * intermitente que no dice nada del sistema).
 *
 * Y se entra **una vez por corrida**, no una por archivo: el servidor corta a
 * los 10 intentos cada 15 minutos, así que una entrada por archivo ponía techo
 * al número de recorridos. Con 12 archivos ya reventaba (2026-08-14).
 */
const aCookies = (cabeceras: string[]) =>
  cabeceras.filter(Boolean).map((linea) => {
    const [par] = linea.split(';');
    const corte = par.indexOf('=');
    return {
      name: par.slice(0, corte).trim(),
      value: par.slice(corte + 1).trim(),
      // Sin puerto: las cookies no distinguen 4100 de 5273, así que la misma
      // sirve para la tienda y para la API.
      domain: 'localhost',
      path: '/',
    };
  });

const pedirCookiesDeAdmin = async () =>
  aCookies(fs.readFileSync(ARCHIVO_SESION, 'utf8').split('\n'));

/**
 * La entrada se lee UNA vez por archivo y se reutiliza.
 *
 * El servidor corta a los 10 intentos cada 15 minutos y los recorridos gastaban
 * uno por cada pestaña y por cada llamada a la API: entre todos pasaban de 11 y
 * el último archivo moría con un 429 que no dice nada del sistema —y que además
 * hacía fallar a un recorrido distinto según el orden. La sesión es la misma en
 * los dos usos (navegador y API), así que no hay motivo para pedirla de nuevo.
 */
let sesionAdmin: ReturnType<typeof pedirCookiesDeAdmin> | null = null;
const cookiesDeAdmin = () => (sesionAdmin ??= pedirCookiesDeAdmin());

/**
 * La sesión de administrador como cabecera, para hablarle al servidor SIN pasar
 * por la pantalla. Sirve para comprobar que una regla se sostiene aunque
 * alguien se salte el formulario, que es justo lo que un formulario no puede
 * demostrar de sí mismo.
 */
export const cabeceraAdmin = async () => ({
  Cookie: (await cookiesDeAdmin()).map((c) => `${c.name}=${c.value}`).join('; '),
  'Content-Type': 'application/json',
});

/** Una pestaña de cliente anónimo. */
export const abrirTienda = async (): Promise<{ contexto: BrowserContext; pagina: Page }> => {
  const contexto = await (await abrirNavegador()).newContext({ viewport: { width: 1366, height: 900 } });
  return { contexto, pagina: await contexto.newPage() };
};

/** Una pestaña ya autenticada como administrador. */
export const abrirDashboard = async (): Promise<{ contexto: BrowserContext; pagina: Page }> => {
  const contexto = await (await abrirNavegador()).newContext({ viewport: { width: 1366, height: 900 } });
  await contexto.addCookies(await cookiesDeAdmin());
  return { contexto, pagina: await contexto.newPage() };
};

/**
 * Una pestaña autenticada como CLIENTE, no como administrador.
 *
 * El portal enseña lo de cada quien —sus compras, sus favoritos, su deuda—, así
 * que su recorrido no puede reutilizar la sesión del arranque: esa es la del
 * dueño y vería otra cosa. Entrar cuesta uno de los 10 intentos que da el
 * servidor cada 15 minutos, así que se pide UNA vez por recorrido.
 */
export const abrirComoCliente = async (
  email: string,
  clave: string,
): Promise<{ contexto: BrowserContext; pagina: Page }> => {
  const entrada = await fetch(`${URL_API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: clave }),
  });
  if (!entrada.ok) throw new Error(`No se pudo entrar como cliente: ${entrada.status}`);

  const contexto = await (await abrirNavegador()).newContext({ viewport: { width: 1366, height: 900 } });
  await contexto.addCookies(aCookies(entrada.headers.getSetCookie()));
  return { contexto, pagina: await contexto.newPage() };
};

/**
 * El campo que hay bajo una etiqueta del dashboard.
 *
 * No se usa `getByLabel` porque no funcionaría: el componente `Field` pinta un
 * `<label>` suelto, sin `htmlFor` y sin envolver al campo, así que el navegador
 * no los relaciona. Es un hueco de accesibilidad de la aplicación (un lector de
 * pantalla tampoco los asocia), anotado para hablarlo con el dueño; mientras
 * exista, aquí se busca por cercanía.
 */
export const campo = (pagina: Page, etiqueta: string) =>
  // Desde el 2026-08-23 la etiqueta apunta de verdad a su control (`Field` +
  // `campoEtiqueta.ts`), así que se pregunta por el nombre del campo en vez de
  // adivinar por la forma del HTML ("el último div que contenga este label").
  // Se queda el `.last()` porque puede haber un modal cerrado detrás con los
  // mismos campos.
  pagina.getByLabel(etiqueta, { exact: true }).last();

/**
 * La fecha 'AAAA-MM-DD' de un selector de fecha (`CampoFecha`).
 *
 * Desde el 2026-09-28 las fechas ya no son `<input type="date">` sino un botón
 * que abre el calendario de la aplicación, así que no hay `inputValue()`: el
 * botón expone lo elegido en `data-valor`.
 */
export const valorFecha = async (pagina: Page, etiqueta: string) =>
  (await campo(pagina, etiqueta).getAttribute('data-valor')) ?? '';

/** Elige una fecha como lo haría una persona: abre, navega hasta el mes y toca el día. */
export const elegirFecha = async (pagina: Page, etiqueta: string, fecha: string) => {
  await campo(pagina, etiqueta).click();
  const cuadricula = pagina.locator('[role="grid"][data-mes]').last();
  const objetivo = fecha.slice(0, 7);
  for (let i = 0; i < 60; i++) {
    const mes = await cuadricula.getAttribute('data-mes');
    if (mes === objetivo) break;
    await pagina.getByRole('button', { name: mes! < objetivo ? 'Mes siguiente' : 'Mes anterior' }).last().click();
  }
  await pagina.locator(`[data-dia="${fecha}"]`).last().click();
};

/**
 * Elige una opción en un desplegable del dashboard.
 *
 * **Ningún desplegable de la aplicación es un `<select>` del navegador**: todos
 * son `BuscadorSelect` (un botón que abre su propia lista), incluso los que en
 * el código se escriben con `<option>` a través de `SelectSimple`. Por eso
 * `selectOption()` de Playwright no encuentra nada y hay que abrir y hacer clic.
 */
export const elegirOpcion = async (pagina: Page, etiqueta: string, opcion: string | RegExp) => {
  await pagina
    .locator('div')
    .filter({ has: pagina.locator(`label:text-is(${JSON.stringify(etiqueta)})`) })
    .last()
    .getByRole('button')
    .first()
    .click();
  await pagina.getByRole('option', { name: opcion }).first().click();
};

/**
 * Elige un producto en el buscador del formulario de pedido.
 *
 * No es un `<select>`: la regla del proyecto reserva el desplegable nativo para
 * listas cortas y fijas, y el catálogo crece. Es un combobox con su propio
 * buscador dentro del panel.
 */
export const elegirProducto = async (pagina: Page, nombre: string) => {
  await pagina.getByRole('button', { name: /buscar y agregar producto/i }).click();
  await pagina.getByPlaceholder('Escribe para filtrar…').fill(nombre);
  await pagina.getByRole('option', { name: nombre, exact: true }).click();
};

/**
 * "Registrar" en el formulario de venta y ESPERA LA RESPUESTA del servidor.
 *
 * Antes cada recorrido esperaba ver el nombre del cliente en pantalla. Desde el
 * 2026-10-04 ese nombre sale DENTRO del formulario ("«X» todavía no es
 * cliente"), así que la espera terminaba antes de guardar y la prueba leía el
 * inventario sin descontar (2026-10-08). La respuesta del POST no se adelanta.
 */
export const registrarVenta = async (pagina: Page) => {
  const respuesta = pagina.waitForResponse(
    (r) => r.url().endsWith('/api/ventas') && r.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await pagina.getByRole('button', { name: /^Registrar$/ }).click();
  return respuesta;
};

export const irA = (pagina: Page, ruta: string) =>
  pagina.goto(`${URL_TIENDA}${ruta}`, { waitUntil: 'domcontentloaded' });

/**
 * Elige la puerta del alta del catálogo.
 *
 * Desde el 2026-08-25 el alta de un producto pregunta PRIMERO qué es —una
 * fragancia, un 1.1, algo comprado o decants— y solo entonces muestra los
 * campos que aplican. Antes esa pregunta vivía en la casilla once y todos los
 * recorridos entraban directos al formulario.
 */
export const elegirTipoDeAlta = (pagina: Page, tipo: RegExp) =>
  pagina.getByRole('button', { name: tipo }).click();

/**
 * Cierra los popups de anuncios si aparecen. En la tienda real salen encima de
 * todo y tapan justo los botones que el recorrido necesita tocar.
 *
 * Llegan DESPUÉS de cargar la página (se piden aparte) y en COLA: al cerrar uno
 * sale el siguiente. Mirar una sola vez y al instante fallaba de vez en cuando
 * en la corrida completa, donde otros recorridos dejan anuncios creados: el
 * popup llegaba medio segundo tarde y, mientras está abierto, el diálogo
 * esconde el resto de la página a los lectores de pantalla y a `getByRole`
 * (2026-10-02).
 */
export const cerrarPopup = async (pagina: Page) => {
  const boton = pagina.getByRole('button', { name: /entendido/i }).first();
  for (let i = 0; i < 5; i++) {
    const aparecio = await boton.waitFor({ state: 'visible', timeout: i === 0 ? 1500 : 800 })
      .then(() => true, () => false);
    if (!aparecio) return;
    await boton.click().catch(() => {});
  }
};
