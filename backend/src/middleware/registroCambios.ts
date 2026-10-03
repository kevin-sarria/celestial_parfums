import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import logger from '../config/logger';

/**
 * EL HISTORIAL DE CAMBIOS (2026-10-03, tercera tanda de la revisión).
 *
 * Cada cambio que el servidor ACEPTA en el panel (crear, editar, borrar) deja
 * una línea: quién, cuándo, en qué módulo y con qué datos. Es la regla 4 de
 * `roles-y-permisos`: "el día que falte plata, que haya a quién preguntarle".
 * Hace falta antes de tener empleados, y sirve desde ya: el inventario y el
 * costo se mueven solos con cada venta, y un descuadre ahora tiene rastro.
 *
 * Es UN middleware y no una línea en cada uno de los 114 endpoints: así un
 * endpoint nuevo queda registrado sin que nadie se acuerde. Lo que sabe de cada
 * uno es lo mínimo: el módulo sale del primer tramo de la URL.
 *
 * Se escribe al TERMINAR la respuesta y solo si salió bien (2xx): un intento
 * rechazado no cambió nada. Si escribir el registro falla, la operación ya está
 * hecha y no se deshace: se anota en el log del servidor y sigue.
 */

const MODULOS: Record<string, string> = {
  parfums: 'Catálogo', combos: 'Combos', ventas: 'Ventas', creditos: 'Créditos',
  pagos: 'Compras a proveedores', empresas: 'Proveedores', inventario: 'Inventario',
  costeo: 'Costos y precios', cotizaciones: 'Cotizaciones', devoluciones: 'Devoluciones',
  usuarios: 'Usuarios', recompensas: 'Recompensas', resenas: 'Reseñas', anuncios: 'Publicidad',
  avisos: 'Reposiciones', blog: 'Blog', contacto: 'Redes sociales', nosotros: 'Sobre nosotros',
  import: 'Importación', upload: 'Imágenes', reportes: 'Inicio', backup: 'Respaldo',
};

const VERBO: Record<string, string> = { POST: 'Creó o registró', PATCH: 'Editó', DELETE: 'Borró' };

/** Rutas que no son cambios del negocio: entrar, salir, refrescar la sesión. */
const IGNORAR = /^\/api\/(auth|notificaciones)\b/;

/** Lo que nunca se guarda, ni siquiera en un historial que solo ve el dueño. */
const SECRETO = /pass|token|captcha|secret|totp|credential|clave/i;

/** El cuerpo de la petición, sin secretos y sin textos enormes (una descripción con formato). */
export const sanearDatos = (valor: unknown, profundidad = 0): unknown => {
  if (valor == null || typeof valor === 'number' || typeof valor === 'boolean') return valor;
  if (typeof valor === 'string') return valor.length > 300 ? `${valor.slice(0, 300)}…` : valor;
  if (profundidad > 3) return '…';
  if (Array.isArray(valor)) {
    const recorte = valor.slice(0, 30).map((v) => sanearDatos(v, profundidad + 1));
    return valor.length > 30 ? [...recorte, `… y ${valor.length - 30} más`] : recorte;
  }
  if (typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor as Record<string, unknown>)
      .filter(([k]) => !SECRETO.test(k))
      .map(([k, v]) => [k, sanearDatos(v, profundidad + 1)]));
  }
  return String(valor);
};

/**
 * "Editó en Catálogo #12 · Khamrah". El nombre sale del cuerpo cuando lo trae
 * (nombre, persona, título): con solo el número, el dueño tendría que ir a
 * buscar qué era el #12.
 */
export const describirCambio = (metodo: string, ruta: string, cuerpo: unknown) => {
  const tramos = ruta.split('?')[0].split('/').filter(Boolean); // ['api', 'parfums', '12', 'publicado']
  const modulo = MODULOS[tramos[1]] ?? tramos[1] ?? 'Panel';
  const id = tramos.slice(2).find((t) => /^\d+$/.test(t));
  const extra = tramos.slice(2).filter((t) => !/^\d+$/.test(t)).join(' ');
  const c = (cuerpo && typeof cuerpo === 'object' ? cuerpo : {}) as Record<string, unknown>;
  const nombre = [c.nombre, c.persona, c.titulo].find((v) => typeof v === 'string' && v.trim()) as string | undefined;
  const resumen = [
    `${VERBO[metodo] ?? metodo} en ${modulo}`,
    extra && `(${extra})`,
    id && `#${id}`,
    nombre && `· ${nombre.trim().slice(0, 80)}`,
  ].filter(Boolean).join(' ');
  return { modulo, resumen: resumen.slice(0, 300) };
};

export const registroCambios = (req: Request, res: Response, next: NextFunction) => {
  if (!(req.method in VERBO) || IGNORAR.test(req.originalUrl)) { next(); return; }
  res.on('finish', () => {
    // `jwtUser` lo pone `requireAdmin` dentro del router: aquí, al terminar, ya está
    const quien = req.jwtUser;
    if (!quien || quien.rol_id !== 1 || res.statusCode >= 400) return;
    const ruta = req.originalUrl.split('?')[0].slice(0, 200);
    const { modulo, resumen } = describirCambio(req.method, ruta, req.body);
    void (async () => {
      try {
        const u = await prisma.user.findUnique({ where: { id: quien.id }, select: { nombre: true, apellido: true } });
        await prisma.registroCambio.create({
          data: {
            user_id: quien.id,
            usuario: u ? `${u.nombre} ${u.apellido}`.trim() : quien.email,
            metodo: req.method, ruta, modulo, resumen,
            datos: (sanearDatos(req.body) ?? undefined) as object | undefined,
          },
        });
      } catch (err) {
        logger.error(`No se pudo anotar en el historial: ${resumen}`, err);
      }
    })();
  });
  next();
};
