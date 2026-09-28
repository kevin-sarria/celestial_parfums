import { lazy, type ComponentType } from 'react';
import { recargarVersionNueva } from './versionNueva';

/**
 * `React.lazy` que se recupera sola cuando el teléfono tiene la versión VIEJA.
 *
 * Después de un despliegue, una página vieja pide archivos que ya no existen y
 * el servidor contesta con la página de inicio. En Chrome eso es un error de
 * importación; en el iPhone (WebKit) ni siquiera falla: llega un "módulo" sin
 * contenido y React revienta con `undefined is not an object (evaluating
 * 'e._result.default')`. Medido el 2026-09-28 reproduciéndolo en WebKit.
 *
 * Aquí se tratan los dos casos igual: se borran las copias guardadas y se
 * recarga UNA vez (ver `versionNueva.ts`). Si ya se intentó, el error sigue
 * su camino hasta "Algo salió mal", que es mejor que un bucle.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const lazyPagina = <T extends ComponentType<any>>(importar: () => Promise<{ default: T }>) =>
  lazy(async () => {
    try {
      const modulo = await importar();
      if (!modulo?.default) throw new Error('ChunkLoadError: el archivo de la página llegó vacío');
      return modulo;
    } catch (error) {
      // Mientras la recarga ocurre, la página se queda en el spinner
      if (await recargarVersionNueva()) return new Promise<never>(() => {});
      throw error;
    }
  });
