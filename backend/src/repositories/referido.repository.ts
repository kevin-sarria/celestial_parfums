import { randomInt } from 'crypto';
import { prisma } from '../config/prisma';
import { codigoPrisma } from '../utils/errorSeguro';

// Código de invitación legible (sin caracteres ambiguos), ej: REF-7XK2M9.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const generar = () => 'REF-' + Array.from({ length: 6 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');

/** Devuelve el código de referido del usuario, generándolo la primera vez. */
export const getCodigo = async (userId: number): Promise<string> => {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { codigo_referido: true } });
  if (u?.codigo_referido) return u.codigo_referido;
  for (let intento = 0; intento < 5; intento++) {
    try {
      const row = await prisma.user.update({ where: { id: userId }, data: { codigo_referido: generar() }, select: { codigo_referido: true } });
      return row.codigo_referido!;
    } catch (e) {
      if (codigoPrisma(e) !== 'P2002') throw e; // colisión rara del aleatorio: reintenta
    }
  }
  throw new Error('No se pudo generar el código, intenta de nuevo');
};

/** Amigos que se registraron con el código de este usuario, y si ya compraron. */
export const misReferidos = async (userId: number) => {
  const rows = await prisma.user.findMany({
    where: { referido_por: userId },
    orderBy: { created_at: 'desc' },
    select: {
      nombre: true, apellido: true, created_at: true,
      ventas: { where: { pagada: true }, select: { id: true }, take: 1 },
    },
  });
  return rows.map((r) => ({
    nombre: `${r.nombre} ${r.apellido}`,
    fecha: r.created_at,
    compro: r.ventas.length > 0,
  }));
};

/**
 * Al registrarse con un código, vincula al nuevo usuario con quien lo invitó.
 * Candados anti-trampa ("gente viva"):
 *  - Solo se puede vincular al REGISTRARSE y una sola vez (referido_por es
 *    inmutable): dos amigos con cuenta ya creada NUNCA pueden referirse entre sí,
 *    así que el auto-referido recíproco es estructuralmente imposible.
 *  - No se permite auto-referirse (mismo id ni mismo correo que el referidor).
 *  - El PREMIO no se otorga aquí ni al registrarse: se gana solo cuando el amigo
 *    hace su PRIMERA COMPRA PAGADA (una venta real que el admin procesa). Crear
 *    cuentas falsas no da nada gratis: para "farmear" tocaría pagar pedidos reales.
 */
export const vincularReferido = async (nuevoUserId: number, codigo?: string) => {
  const code = codigo?.trim().toUpperCase();
  if (!code) return;
  const nuevo = await prisma.user.findUnique({ where: { id: nuevoUserId }, select: { referido_por: true, email: true } });
  if (!nuevo || nuevo.referido_por != null) return; // inmutable: ya tiene referidor
  const ref = await prisma.user.findUnique({ where: { codigo_referido: code }, select: { id: true, email: true } });
  if (!ref || ref.id === nuevoUserId || ref.email === nuevo.email) return; // no auto-referido
  await prisma.user.update({ where: { id: nuevoUserId }, data: { referido_por: ref.id } });
};
