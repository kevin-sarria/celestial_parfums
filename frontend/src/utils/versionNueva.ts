/**
 * Cuando el teléfono tiene la página de una versión VIEJA.
 *
 * Cada despliegue borra los archivos de la versión anterior. Una pestaña que
 * quedó abierta desde antes (o una copia guardada por el service worker) pide
 * esos archivos, el servidor contesta con la página de inicio en su lugar, y
 * el navegador no la puede ejecutar como código: todo cae en "Algo salió mal".
 * Le pasó al dueño en su iPhone el 2026-09-28, justo después de desplegar.
 *
 * El arreglo es el que usa todo el mundo con Vite: detectar ese error, borrar
 * las copias guardadas y recargar para traer la versión nueva. UNA sola vez:
 * si al recargar vuelve a fallar, es otro problema y un bucle de recargas
 * sería peor que el mensaje.
 */

/** Los textos con los que cada navegador dice "no pude cargar un archivo de código". */
const ERROR_DE_VERSION_VIEJA =
  /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Unable to preload CSS|not a valid JavaScript MIME type|ChunkLoadError/i;

export const esErrorDeVersionVieja = (error: unknown) =>
  ERROR_DE_VERSION_VIEJA.test(error instanceof Error ? `${error.name} ${error.message}` : String(error));

const MARCA = 'celestial-recarga-version';
/** Si ya se recargó hace menos de esto, no se vuelve a intentar. */
const ESPERA_MS = 30_000;

/** Borra las copias de la página que guardó el service worker. */
export const borrarCopiasGuardadas = async () => {
  try {
    if ('caches' in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
  } catch { /* si no se pueden borrar, la recarga igual trae el HTML nuevo */ }
};

/** Borra las copias guardadas y recarga. Devuelve false si ya se intentó hace poco. */
export const recargarVersionNueva = async (): Promise<boolean> => {
  try {
    const antes = Number(sessionStorage.getItem(MARCA) ?? 0);
    if (Date.now() - antes < ESPERA_MS) return false;
    sessionStorage.setItem(MARCA, String(Date.now()));
  } catch { /* sin sessionStorage (modo privado): se recarga igual, una vez por carga */ }

  await borrarCopiasGuardadas();
  window.location.reload();
  return true;
};
