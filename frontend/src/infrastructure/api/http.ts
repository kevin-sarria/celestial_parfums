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
 * 401 = el token caducó → se renueva UNA vez y se reintenta.
 * 403 = ya no tienes permiso → fuera.
 *
 * `_reintentada` evita el bucle infinito: si el reintento vuelve a dar 401, se
 * cierra sesión en vez de pedir refresco para siempre.
 */
instancia.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _reintentada?: boolean }) | undefined;
    const status = error.response?.status;

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

export const http = {
  get: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
    ejecutar<T>(() => instancia.get<T>(url, config)),

  post: <T = unknown>(url: string, datos?: unknown, config?: AxiosRequestConfig) =>
    ejecutar<T>(() => instancia.post<T>(url, datos, config)),

  patch: <T = unknown>(url: string, datos?: unknown, config?: AxiosRequestConfig) =>
    ejecutar<T>(() => instancia.patch<T>(url, datos, config)),

  /** `delete` es palabra reservada: el método se llama `borrar`. */
  borrar: <T = unknown>(url: string, config?: AxiosRequestConfig) =>
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
    ejecutar<Blob>(() => instancia.get(url, { responseType: 'blob' })),
};
