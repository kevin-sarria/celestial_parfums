import type { MovimientoTipo, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

type Cliente = Prisma.TransactionClient | typeof prisma;

/**
 * CUÁNTO SE GASTA DE CADA MATERIAL, y cuándo avisar.
 *
 * Una sola cuenta para dos pantallas que tienen que decir lo mismo: el pedido
 * sugerido y la alerta del dashboard. Antes solo el pedido miraba el consumo;
 * la alerta miraba solo el mínimo fijo.
 */

/** Ventana de historial con la que se estima el consumo diario. */
export const DIAS_HISTORIAL = 90;

/**
 * Avisar cuando lo que hay alcanza para menos de esto (dueño, 2026-10-04,
 * opción C de las alertas: *"2 semanas"*). Convive con el mínimo fijo: manda
 * el que llegue primero, así lo que todavía no se vende sigue cuidado por su
 * mínimo y lo que se vende rápido avisa antes de tocarlo.
 */
export const DIAS_AVISO = 14;

/**
 * Movimientos que cuentan como CONSUMO real. `ajuste` queda FUERA a propósito:
 * es el conteo físico, y ahí caben el stock inicial que se siembra al arrancar
 * y el desperdicio ya absorbido al contar. Proyectar eso como demanda haría
 * pedir de más justo el primer mes. Como `MovimientoTipo[]` y no texto suelto:
 * un tipo mal escrito no compila.
 */
export const TIPOS_CONSUMO: MovimientoTipo[] = ['venta', 'produccion', 'muestra', 'merma', 'garantia'];

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** id del material → cuánto se gasta al día, en promedio, en los últimos 90 días. */
export const consumoDiarioPorInsumo = async (cli: Cliente = prisma): Promise<Map<number, number>> => {
  const desde = new Date();
  desde.setDate(desde.getDate() - DIAS_HISTORIAL);
  const salidas = await cli.movimientoInventario.groupBy({
    by: ['insumo_id'],
    where: { tipo: { in: TIPOS_CONSUMO }, fecha: { gte: desde } },
    _sum: { cantidad: true },
  });
  // Las salidas van en negativo: se le da la vuelta para leerlo como consumo
  return new Map(salidas.map((s) => [s.insumo_id, r3(Math.max(0, -Number(s._sum.cantidad ?? 0)) / DIAS_HISTORIAL)]));
};

/** Para cuántos días alcanza lo que hay. null = no se gasta (no hay con qué estimar). */
export const diasQueAlcanza = (stock: number, consumoDiario: number) =>
  (consumoDiario > 0 ? Math.max(0, Math.floor(stock / consumoDiario)) : null);

/**
 * ¿Hay que avisar? Por debajo del mínimo, o alcanza para menos de 2 semanas.
 *
 * La velocidad solo cuenta si en esas 2 semanas se gastaría AL MENOS UNA
 * UNIDAD. Medido en el respaldo del 30-sep: sin esto avisaban 7 frascos de 1.1
 * en cero porque se armó uno en 3 meses — justo el ruido que el dueño no quería
 * (*"no es posible que me pida envases de 1.1 cuando se sabe que salen lento"*).
 */
export const llegoAlAviso = ({ stock, minimo, consumoDiario }: { stock: number; minimo: number; consumoDiario: number }) => {
  if (minimo > 0 && stock <= minimo) return true;
  if (consumoDiario * DIAS_AVISO < 1) return false;
  const dias = diasQueAlcanza(stock, consumoDiario);
  return dias != null && dias < DIAS_AVISO;
};
