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

/**
 * El texto de un error, venga como venga.
 *
 * En un `catch` TypeScript entrega `unknown` —lo correcto: cualquiera puede
 * lanzar cualquier cosa, no solo un `Error`—, así que `err.message` no existe
 * hasta comprobarlo. Esto es para los sitios que **reportan el fallo a quien
 * está usando el sistema** (el informe de una importación, un log), no para lo
 * que se le manda al visitante: para eso está `mensajeSeguro`, que además
 * esconde las tripas del servidor.
 */
export const textoDeError = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

/**
 * El código de un error de Prisma (`P2002` = clave repetida, y demás), o
 * `undefined` si el error no es de Prisma.
 *
 * Se usa para distinguir un choque esperado —dos veces el mismo código
 * aleatorio de referido— de un fallo real que hay que dejar subir.
 */
export const codigoPrisma = (err: unknown): string | undefined => {
  if (typeof err !== 'object' || err === null) return undefined;
  const codigo = (err as { code?: unknown }).code;
  return typeof codigo === 'string' ? codigo : undefined;
};
