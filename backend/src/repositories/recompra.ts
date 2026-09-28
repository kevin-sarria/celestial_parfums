import { prisma } from '../config/prisma';
import { hoyEnColombia } from '../utils/fechas';
import { calcularRecompra, type Compra } from './recompra.calculo';

/**
 * Las compras de cada cliente, para la lista de recompra (`recompra.calculo.ts`).
 *
 * Quién es quién: la venta enlazada a un cliente se agrupa por su cuenta; la
 * que no (medido el 2026-09-28: 220 de 319 ventas), por el NOMBRE escrito,
 * sin tildes ni mayúsculas. Los nombres genéricos no son una persona y se
 * dejan fuera: "Cliente random" tenía 25 ventas y habría salido como el mejor
 * cliente de la tienda.
 */
const NOMBRES_GENERICOS = new Set(['cliente random', 'cliente', 'random', 'anonimo', 'desconocido', 'sin nombre', 'n/a']);

export const normalizarNombre = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const aTexto = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

export const listaRecompra = async () => {
  const ventas = await prisma.venta.findMany({
    select: {
      dia: true, persona: true, user_id: true, referencia_perfume: true,
      user: { select: { nombre: true, apellido: true } },
    },
  });

  const compras: Compra[] = [];
  for (const v of ventas) {
    const escrito = normalizarNombre(v.persona ?? '');
    if (!v.user_id && (!escrito || NOMBRES_GENERICOS.has(escrito))) continue;
    compras.push({
      clave: v.user_id ? `u:${v.user_id}` : `n:${escrito}`,
      nombre: v.user ? `${v.user.nombre} ${v.user.apellido}`.trim() : v.persona.trim(),
      dia: aTexto(v.dia),
      referencia: v.referencia_perfume,
    });
  }
  return calcularRecompra(compras, aTexto(hoyEnColombia()));
};
