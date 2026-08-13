import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { ADMIN, } from './tienda';
import { URL_API, URL_TIENDA } from './arranque';

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
 * La sesión de administrador, pedida al backend por HTTP e inyectada en el
 * navegador.
 *
 * No se pasa por el formulario de login a propósito, y no es por atajar: así no
 * se carga el script de reCAPTCHA de Google (que exigiría internet y añadiría
 * un fallo intermitente que no dice nada del sistema) y se gasta **una sola**
 * entrada, que importa porque el servidor corta a los 10 intentos cada 15
 * minutos y eso ya bloqueó pruebas antes.
 */
const cookiesDeAdmin = async () => {
  const res = await fetch(`${URL_API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN.email, password: ADMIN.clave }),
  });
  if (!res.ok) throw new Error(`No se pudo entrar como administrador: ${res.status} ${await res.text()}`);

  return res.headers.getSetCookie().map((linea) => {
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
};

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
 * El campo que hay bajo una etiqueta del dashboard.
 *
 * No se usa `getByLabel` porque no funcionaría: el componente `Field` pinta un
 * `<label>` suelto, sin `htmlFor` y sin envolver al campo, así que el navegador
 * no los relaciona. Es un hueco de accesibilidad de la aplicación (un lector de
 * pantalla tampoco los asocia), anotado para hablarlo con el dueño; mientras
 * exista, aquí se busca por cercanía.
 */
export const campo = (pagina: Page, etiqueta: string) =>
  pagina
    .locator('div')
    .filter({ has: pagina.locator(`label:text-is(${JSON.stringify(etiqueta)})`) })
    .last()
    .locator('input, textarea, select')
    .first();

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
