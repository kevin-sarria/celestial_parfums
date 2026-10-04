import { prisma } from '../config/prisma';
import { badRequest, conflict, notFound } from '../utils/httpError';
import { esPermiso, PERMISOS } from '../permisos/catalogo';
import { ADMIN, olvidarPermisos, olvidarUsuario } from '../permisos/permisos';

/**
 * LOS ROLES DEL PERSONAL (2026-10-04, opción C del dueño): él los crea y les
 * marca permisos. ADMIN (1) no se edita aquí: es el dueño y puede todo.
 * Cliente (2) y Proveedor (3) tampoco: no son personal.
 */
const CLIENTE = 2;

export const catalogoDePermisos = () => PERMISOS;

export const listarRoles = async () => {
  const roles = await prisma.role.findMany({
    where: { personal: true },
    include: { permisos: true, _count: { select: { users: true } } },
    orderBy: { nombre: 'asc' },
  });
  return roles.map((r) => ({
    id: r.id, nombre: r.nombre, permisos: r.permisos.map((p) => p.permiso), personas: r._count.users,
  }));
};

const limpiar = (nombre: unknown, permisos: unknown) => {
  const n = typeof nombre === 'string' ? nombre.trim() : '';
  if (!n || n.length > 50) throw badRequest('El rol necesita un nombre (hasta 50 letras)');
  if (!Array.isArray(permisos)) throw badRequest('Faltan los permisos');
  // Una casilla que el código no revisa no se guarda: prometería un bloqueo que no existe
  const lista = [...new Set(permisos.filter((p): p is string => typeof p === 'string' && esPermiso(p)))];
  return { nombre: n, permisos: lista };
};

const nombreLibre = async (nombre: string, exceptoId?: number) => {
  const otro = await prisma.role.findFirst({ where: { nombre, ...(exceptoId ? { id: { not: exceptoId } } : {}) } });
  if (otro) throw conflict('Ya existe un rol con ese nombre');
};

export const crearRol = async (nombre: unknown, permisos: unknown) => {
  const d = limpiar(nombre, permisos);
  await nombreLibre(d.nombre);
  const rol = await prisma.role.create({
    data: { nombre: d.nombre, personal: true, permisos: { create: d.permisos.map((permiso) => ({ permiso })) } },
  });
  olvidarPermisos();
  return { id: rol.id, nombre: rol.nombre, permisos: d.permisos, personas: 0 };
};

const rolDePersonal = async (id: number) => {
  const rol = await prisma.role.findUnique({ where: { id } });
  if (!rol || !rol.personal || id === ADMIN) throw notFound('Ese rol no existe o no se puede editar');
  return rol;
};

export const editarRol = async (id: number, nombre: unknown, permisos: unknown) => {
  await rolDePersonal(id);
  const d = limpiar(nombre, permisos);
  await nombreLibre(d.nombre, id);
  await prisma.$transaction([
    prisma.role.update({ where: { id }, data: { nombre: d.nombre } }),
    prisma.rolPermiso.deleteMany({ where: { rol_id: id } }),
    prisma.rolPermiso.createMany({ data: d.permisos.map((permiso) => ({ rol_id: id, permiso })) }),
  ]);
  olvidarPermisos();
  const personas = await prisma.user.count({ where: { rol_id: id } });
  return { id, nombre: d.nombre, permisos: d.permisos, personas };
};

export const borrarRol = async (id: number) => {
  await rolDePersonal(id);
  const personas = await prisma.user.count({ where: { rol_id: id } });
  if (personas > 0) throw conflict(`${personas === 1 ? 'Una persona tiene' : `${personas} personas tienen`} este rol: cámbiales el rol primero`);
  await prisma.role.delete({ where: { id } });
  olvidarPermisos();
};

/**
 * Cambia el rol de una persona: cliente o un rol de personal. Nadie se vuelve
 * dueño desde aquí, y al dueño no se le quita lo suyo: un clic equivocado lo
 * dejaría fuera de su propio panel.
 */
export const asignarRol = async (userId: number, rolId: unknown, duenoId: number) => {
  const nuevo = Number(rolId);
  if (userId === duenoId) throw badRequest('No puedes cambiar tu propio rol');
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound('Esa persona no existe');
  if (user.rol_id === ADMIN) throw badRequest('Esa persona es administradora: su rol no se cambia desde aquí');
  if (nuevo !== CLIENTE) await rolDePersonal(nuevo);
  if (nuevo !== CLIENTE && user.sin_cuenta) {
    throw badRequest('Esa persona no tiene cuenta para entrar. Pídele que se registre en la página con su correo y luego le das el rol');
  }
  await prisma.user.update({ where: { id: userId }, data: { rol_id: nuevo } });
  olvidarUsuario(userId);
  return { id: userId, rol_id: nuevo };
};
