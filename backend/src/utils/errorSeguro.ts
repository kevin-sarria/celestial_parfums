import logger from '../config/logger';

/**
 * ¿Es un error INTERNO (base de datos caída, fallo de red, bug) en vez de un
 * mensaje de negocio escrito por nosotros?
 *
 * Los errores de Prisma traen la ruta del archivo, un fragmento del código
 * fuente y el host de la base. Si eso se devuelve tal cual, el visitante ve
 * las tripas del servidor (pasó con la base apagada: el login mostraba
 * `auth.repository.ts:8:15` y `localhost:3306` en pantalla).
 */
export const esErrorInterno = (err: unknown): boolean => {
  if (!(err instanceof Error)) return true;
  // Prisma nombra sus errores PrismaClientKnownRequestError, ...Initialization…
  if (err.name.startsWith('Prisma')) return true;
  if ('clientVersion' in err) return true;
  // Fallos de red/sistema de Node (ECONNREFUSED, ETIMEDOUT…)
  if ('code' in err && typeof (err as { code?: unknown }).code === 'string'
    && /^E[A-Z]+$/.test((err as { code: string }).code)) return true;
  return false;
};

/**
 * Mensaje que SÍ se le puede mostrar al visitante. Los errores internos se
 * registran completos en el log del servidor y afuera sale un texto genérico.
 */
export const mensajeSeguro = (err: unknown, generico = 'No se pudo completar la operación. Inténtalo de nuevo.'): string => {
  if (!esErrorInterno(err)) return (err as Error).message;
  logger.error('Error interno', {
    nombre: err instanceof Error ? err.name : typeof err,
    detalle: err instanceof Error ? err.message : String(err),
  });
  return generico;
};
