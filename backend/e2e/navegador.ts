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

export const irA = (pagina: Page, ruta: string) =>
  pagina.goto(`${URL_TIENDA}${ruta}`, { waitUntil: 'domcontentloaded' });

/**
 * Cierra el popup de anuncios si aparece. En la tienda real sale encima de
 * todo y tapa justo los botones que el recorrido necesita tocar.
 */
export const cerrarPopup = async (pagina: Page) => {
  const boton = pagina.getByRole('button', { name: /entendido/i });
  if (await boton.count()) await boton.first().click().catch(() => {});
};
