import axios, { AxiosError, type AxiosRequestConfig } from 'axios';

/**
 * EL ÚNICO ARCHIVO DE LA APLICACIÓN QUE CONOCE AXIOS.
 *
 * Todo lo que viaja por la red pasa por aquí. Ninguna pantalla importa axios ni
 * escribe una URL completa: piden `http.get(urls.inventario.resumen)` y no saben
 * —ni les importa— con qué librería se hace. El día que axios estorbe, se
 * reescribe este archivo y **nada más**.
 *
 * Por qué existe (2026-08-14): había 151 llamadas repartidas en 49 componentes
 * y 129 rutas escritas a mano. Cambiar de librería, o que el backend renombrara
 * una ruta, significaba salir a buscar por todo el frontend.
 *
 * ## No lanza excepciones, devuelve `Respuesta`
 *
 * Axios lanza cuando el servidor responde 400. Eso obligaría a envolver en
 * try/catch las ~150 llamadas, y la que se olvidara **rompería la pantalla en
 * vez de avisar** — justo lo contrario de la regla del proyecto: ningún handler
 * puede ignorar la respuesta, siempre se muestra el mensaje del servidor. Aquí
 * el error se convierte en dato: `{ ok: false, error: '…' }`, y quien llama
 * decide qué toast enseñar.
 */

/** La URL base sale del entorno: `.env` en local, `.env.e2e` en los recorridos. */
const RAIZ = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const API_BASE = `${RAIZ}/api`;

const instancia = axios.create({
  baseURL: API_BASE,
  // La sesión viaja en cookies httpOnly: sin esto el navegador no las manda.
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Qué hacer cuando la sesión ya no sirve.
 *
 * El interceptor vive fuera de React, así que no puede llamar a `logout()` ni
 * navegar por su cuenta. La aplicación registra aquí qué hacer, una sola vez al
 * arrancar (`useSesionCaducada`), y el interceptor lo invoca.
 */
type AlCaducar = () => void;
let alCaducar: AlCaducar | null = null;
export const registrarSesionCaducada = (fn: AlCaducar | null) => { alCaducar = fn; };

/** Pide un token nuevo con la cookie de refresco. Fuera de la instancia: si
 *  fallara, su propio 401 dispararía el interceptor y entraría en bucle. */
const renovarSesion = async (): Promise<boolean> => {
  try {
    const res = await axios.post(`${API_BASE}/auth/refresh`, null, { withCredentials: true });
    return res.status >= 200 && res.status < 300;
  } catch {
    return false;
  }
};

/**
 * Config de una petición, con una marca propia de la casa.
 */
export interface OpcionesPeticion extends AxiosRequestConfig {
  /**
   * Marca las rutas donde **un 401 es una respuesta legítima**, no una sesión
   * vencida: `/auth/me` sin sesión (un visitante anónimo), un `/auth/login` con
   * la contraseña equivocada, `/auth/google` que no cuajó, o el `/auth/logout`
   * de una sesión que ya estaba muerta.
   *
   * Sin esto el interceptor haría lo de siempre —pedir refresco y, al fallar,
   * cerrar sesión y mandar a `/login`—, y el resultado sería absurdo: **todo
   * visitante anónimo saldría rebotado al login** al abrir la tienda, y
   * escribir mal la clave te expulsaría en vez de decirte que la clave está
   * mal. Peor aún, tras un refresco bueno el interceptor **reintenta la
   * petición**, así que un login fallido se reenviaría solo.
   */
  sesionOpcional?: boolean;
}

/**
 * 401 = el token caducó → se renueva UNA vez y se reintenta.
 * 403 = ya no tienes permiso → fuera.
 *
 * `_reintentada` evita el bucle infinito: si el reintento vuelve a dar 401, se
 * cierra sesión en vez de pedir refresco para siempre.
 */
instancia.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (OpcionesPeticion & { _reintentada?: boolean }) | undefined;
    const status = error.response?.status;

    // Aquí el 401 lo interpreta quien llamó, no el interceptor.
    if (original?.sesionOpcional) return Promise.reject(error);

    if (status === 401 && original && !original._reintentada) {
      original._reintentada = true;
      if (await renovarSesion()) return instancia(original);
      alCaducar?.();
    }
    if (status === 403) alCaducar?.();

    return Promise.reject(error);
  },
);

/** Lo que recibe quien llama: nunca una excepción, siempre un resultado. */
export interface Respuesta<T = unknown> {
  ok: boolean;
  /** El cuerpo tal cual lo manda el backend (`{ message, data }`, `{ error }`…). */
  cuerpo: T | null;
  /** Mensaje listo para un toast. Vacío si todo fue bien. */
  error: string;
  status: number;
}

/**
 * Traduce cualquier fallo a un mensaje que se le pueda enseñar al dueño.
 *
 * El backend manda `{ error: '…' }` ya saneado (`mensajeSeguro`), así que ese
 * texto se respeta. Lo demás son fallos de red o del proxy, donde el mensaje
 * técnico de axios ("Network Error") no le dice nada a nadie.
 */
const mensajeDeError = (error: unknown): string => {
  const e = error as AxiosError<{ error?: string; message?: string }>;
  const delServidor = e.response?.data?.error ?? e.response?.data?.message;
  if (delServidor) return delServidor;
  if (e.response) return `El servidor respondió con un error (${e.response.status}).`;
  return 'No se pudo conectar con el servidor. Revisa tu conexión y reintenta.';
};

const ejecutar = async <T>(fn: () => Promise<{ data: T; status: number }>): Promise<Respuesta<T>> => {
  try {
    const res = await fn();
    return { ok: true, cuerpo: res.data, error: '', status: res.status };
  } catch (error) {
    const status = (error as AxiosError).response?.status ?? 0;
    return { ok: false, cuerpo: null, error: mensajeDeError(error), status };
  }
};

/**
 * Caché de lecturas, en memoria y con caducidad.
 *
 * Para datos que cambian una vez al día y que la pantalla vuelve a pedir cada
 * vez que un componente se monta. El caso que lo motivó (2026-08-15): el estado
 * del respaldo vive DENTRO del cajón lateral, que se desmonta al cerrarse, así
 * que preguntaba al servidor **en cada apertura del menú** solo para saber la
 * fecha de la última copia.
 *
 * Por qué en memoria y no en `localStorage`: ahí no caduca solo, y si el dueño
 * hace el respaldo desde otro navegador este seguiría enseñando la fecha vieja
 * para siempre — justo el aviso que no puede mentir. En memoria se rehace al
 * recargar la página, que es una petición y no cien.
 *
 * Por qué no en el token: se emite al iniciar sesión y no cambia hasta la
 * siguiente, viaja en CADA petición al servidor (pagarías el dato en vez de
 * ahorrarlo) y es una credencial, no un sitio para estado de la aplicación.
 */
const memoria = new Map<string, { expira: number; valor: Respuesta<unknown> }>();
const enVuelo = new Map<string, Promise<Respuesta<unknown>>>();

const CADUCIDAD = 5 * 60 * 1000;

/**
 * Igual que `ejecutar`, pero para respuestas binarias.
 *
 * Va aparte por un detalle que muerde: cuando se pide `responseType: 'blob'` y
 * el servidor responde con un ERROR, **el mensaje también llega como Blob**, no
 * como objeto. Sin leerlo, el dueño veía "El servidor respondió con un error
 * (400)" en vez de "el código no es válido", que es lo que de verdad pasó.
 */
const ejecutarBinario = async (
  fn: () => Promise<{ data: Blob; status: number }>,
): Promise<Respuesta<Blob>> => {
  try {
    const res = await fn();
    return { ok: true, cuerpo: res.data, error: '', status: res.status };
  } catch (error) {
    const e = error as AxiosError<Blob>;
    let mensaje = mensajeDeError(error);
    if (e.response?.data instanceof Blob) {
      try {
        const texto = await e.response.data.text();
        mensaje = (JSON.parse(texto) as { error?: string }).error ?? mensaje;
      } catch { /* no era JSON: se queda el mensaje genérico */ }
    }
    return { ok: false, cuerpo: null, error: mensaje, status: e.response?.status ?? 0 };
  }
};

export const http = {
  get: <T = unknown>(url: string, config?: OpcionesPeticion) =>
    ejecutar<T>(() => instancia.get<T>(url, config)),

  /**
   * `get` que recuerda la respuesta y **deduplica las peticiones en vuelo**: si
   * dos partes de la pantalla piden lo mismo a la vez, viaja una sola.
   *
   * Solo se guardan las respuestas BUENAS: cachear un error dejaría la pantalla
   * rota durante toda la caducidad.
   */
  getCacheado: async <T = unknown>(url: string, msCaducidad = CADUCIDAD): Promise<Respuesta<T>> => {
    const guardada = memoria.get(url);
    if (guardada && guardada.expira > Date.now()) return guardada.valor as Respuesta<T>;

    const enCurso = enVuelo.get(url);
    if (enCurso) return enCurso as Promise<Respuesta<T>>;

    const promesa = (async () => {
      const res = await ejecutar<T>(() => instancia.get<T>(url));
      if (res.ok) memoria.set(url, { expira: Date.now() + msCaducidad, valor: res });
      enVuelo.delete(url);
      return res;
    })();
    enVuelo.set(url, promesa as Promise<Respuesta<unknown>>);
    return promesa;
  },

  /**
   * Olvida lo guardado de una ruta. **Se llama después de cambiar ese dato**:
   * al hacer un respaldo, la fecha de "última copia" es otra, y sin esto la
   * pantalla seguiría mostrando la vieja hasta que caduque.
   */
  olvidar: (url: string) => { memoria.delete(url); },

  post: <T = unknown>(url: string, datos?: unknown, config?: OpcionesPeticion) =>
    ejecutar<T>(() => instancia.post<T>(url, datos, config)),

  patch: <T = unknown>(url: string, datos?: unknown, config?: OpcionesPeticion) =>
    ejecutar<T>(() => instancia.patch<T>(url, datos, config)),

  /** `delete` es palabra reservada: el método se llama `borrar`. */
  borrar: <T = unknown>(url: string, config?: OpcionesPeticion) =>
    ejecutar<T>(() => instancia.delete<T>(url, config)),

  /**
   * Subida de archivos. **No se le pone `Content-Type` a mano**: el navegador
   * tiene que ponerlo él para incluir el `boundary` del formulario, y fijarlo
   * rompe la subida en el servidor.
   */
  subir: <T = unknown>(url: string, form: FormData) =>
    ejecutar<T>(() => instancia.post<T>(url, form, { headers: { 'Content-Type': undefined } })),

  /** Descargas (Excel, PDF, respaldos): el cuerpo es binario, no JSON. */
  descargar: (url: string) =>
    ejecutarBinario(() => instancia.get(url, { responseType: 'blob' })),

  /**
   * Descarga que se pide con POST, porque lleva datos en el cuerpo (el respaldo
   * manda su código de segundo factor).
   */
  descargarConCodigo: (url: string, datos: unknown) =>
    ejecutarBinario(() => instancia.post(url, datos, { responseType: 'blob' })),
};
