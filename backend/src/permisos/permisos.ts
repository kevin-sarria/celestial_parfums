import { prisma } from '../config/prisma';

/**
 * QUÉ PUEDE CADA ROL, en memoria.
 *
 * Se pregunta en cada petición del panel, así que no se va a la base cada vez:
 * se carga una vez y se vuelve a cargar cuando el dueño cambia un rol
 * (`olvidarPermisos`). El rol 1 (ADMIN) no está aquí: puede todo, siempre.
 */
interface InfoRol { personal: boolean; permisos: Set<string> }

let roles: Map<number, InfoRol> | null = null;
let cargando: Promise<Map<number, InfoRol>> | null = null;

export const ADMIN = 1;

const cargar = async () => {
  const filas = await prisma.role.findMany({ include: { permisos: true } });
  return new Map(filas.map((r) => [r.id, { personal: r.personal, permisos: new Set(r.permisos.map((p) => p.permiso)) }]));
};

export const rolesEnMemoria = async () => {
  if (roles) return roles;
  cargando ??= cargar().then((m) => { roles = m; cargando = null; return m; });
  return cargando;
};

/** Tras crear, editar o borrar un rol. */
export const olvidarPermisos = () => { roles = null; };

/** ¿Este rol entra al panel? El dueño siempre; un rol de personal, también. */
export const esPersonal = async (rolId: number | undefined) =>
  rolId === ADMIN || (rolId != null && !!(await rolesEnMemoria()).get(rolId)?.personal);

/** ¿Puede hacer esto? Basta con UNO de los permisos pedidos. */
export const puede = async (rolId: number | undefined, ...permisos: string[]) => {
  if (rolId === ADMIN) return true;
  if (rolId == null) return false;
  const info = (await rolesEnMemoria()).get(rolId);
  return !!info?.personal && permisos.some((p) => info.permisos.has(p));
};

/** La lista de lo que puede, para que la pantalla esconda lo que no. ['*'] = todo. */
export const permisosDe = async (rolId: number | undefined): Promise<string[]> => {
  if (rolId === ADMIN) return ['*'];
  const info = rolId != null ? (await rolesEnMemoria()).get(rolId) : undefined;
  return info?.personal ? [...info.permisos] : [];
};

/**
 * La misma pregunta sin esperar, para lo que no puede esperar (envolver
 * `res.json`). Si los roles aún no se cargaron responde que NO: ante la duda,
 * se esconde. Para cuando un handler responde, `requirePermiso` ya los cargó.
 */
export const puedeYa = (rolId: number | undefined, permiso: string) => {
  if (rolId === ADMIN) return true;
  const info = rolId != null ? roles?.get(rolId) : undefined;
  return !!info?.personal && info.permisos.has(permiso);
};

/**
 * El rol de una persona AHORA, no el que dice su token (que dura 8 horas).
 * Quitarle el rol a un empleado tiene que cortarle el panel en segundos, no
 * al día siguiente. Se guarda 30 s en memoria para no ir a la base en cada
 * petición, y `olvidarUsuario` lo borra al cambiar el rol. Una cuenta
 * desactivada no tiene rol (null).
 */
const rolesDeUsuario = new Map<number, { rol: number | null; hasta: number }>();

export const rolVigente = async (userId: number): Promise<number | null> => {
  const guardado = rolesDeUsuario.get(userId);
  if (guardado && guardado.hasta > Date.now()) return guardado.rol;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { rol_id: true, activo: true } });
  const rol = u?.activo ? u.rol_id : null;
  rolesDeUsuario.set(userId, { rol, hasta: Date.now() + 30_000 });
  return rol;
};

export const olvidarUsuario = (userId: number) => { rolesDeUsuario.delete(userId); };

/** `esPersonal` sin esperar (con los roles ya cargados). */
export const esPersonalYa = (rolId: number | undefined) =>
  rolId === ADMIN || (rolId != null && !!roles?.get(rolId)?.personal);

/** Para las pruebas: la base se vacía entre una y otra, la memoria también. */
export const olvidarTodo = () => { roles = null; rolesDeUsuario.clear(); };
