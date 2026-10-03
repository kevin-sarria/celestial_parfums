import { prisma } from '../config/prisma';
import { badRequest } from '../utils/httpError';

/**
 * LA META DEL MES (2026-10-02, segunda tanda de la revisión): el dueño pone
 * cuánto quiere vender y Inicio le enseña cuánto lleva y a qué ritmo va.
 *
 * Una fila por mes, a propósito: si la meta fuera una sola cifra, subirla en
 * diciembre reescribiría lo que se propuso en noviembre. Lo que se compara
 * contra ella (lo vendido) NO se guarda aquí: sale de las ventas en cada
 * consulta, como el resto de Inicio.
 */

/** "2026-10" a partir de un día de calendario (medianoche UTC, como `hoyEnColombia`). */
export const claveDeMes = (dia: Date) =>
  `${dia.getUTCFullYear()}-${String(dia.getUTCMonth() + 1).padStart(2, '0')}`;

const diasDelMes = (dia: Date) => new Date(Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth() + 1, 0)).getUTCDate();

export const metaDelMes = async (hoy: Date) => {
  const mes = claveDeMes(hoy);
  const [actual, anterior] = await Promise.all([
    prisma.metaMensual.findUnique({ where: { mes } }),
    // La última que puso, para proponerla al empezar un mes sin meta
    prisma.metaMensual.findFirst({ where: { mes: { lt: mes } }, orderBy: { mes: 'desc' } }),
  ]);
  return {
    mes,
    monto: actual ? Number(actual.monto) : null,
    sugerida: anterior ? Number(anterior.monto) : null,
    dia: hoy.getUTCDate(),
    dias_del_mes: diasDelMes(hoy),
  };
};

/** Pone (o cambia) la meta de un mes. Con 0 se quita. */
export const ponerMeta = async (mes: unknown, monto: unknown) => {
  if (typeof mes !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw badRequest('El mes debe ser AAAA-MM');
  const valor = Number(monto);
  if (!Number.isFinite(valor) || valor < 0 || valor > 9_999_999_999) throw badRequest('La meta debe ser un valor en pesos');
  if (valor === 0) {
    await prisma.metaMensual.deleteMany({ where: { mes } });
    return null;
  }
  const meta = await prisma.metaMensual.upsert({
    where: { mes }, update: { monto: Math.round(valor) }, create: { mes, monto: Math.round(valor) },
  });
  return { mes: meta.mes, monto: Number(meta.monto) };
};
