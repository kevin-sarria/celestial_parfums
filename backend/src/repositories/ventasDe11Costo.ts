import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { r4 } from '../utils/redondeo';

type Cliente = Prisma.TransactionClient | typeof prisma;
const num = (v: unknown) => Number(v ?? 0);
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * VENTAS DE 1.1 QUE SE COSTEARON CON LA BOLSA Y EL PERFUMERO QUE NO LLEVABAN.
 *
 * Es la segunda mitad de `accesoriosSobrantes.ts`. Allá se corrigieron los
 * lotes; las ventas que ya habían sacado frascos de esos lotes se quedaron con
 * el costo viejo, a propósito, hasta que el dueño decidiera. Decidió corregirlas
 * (2026-09-29, opción B): su ganancia de esos meses salía más baja de lo real.
 * Medido en el respaldo del 22-sep: 11 ventas, $23.250 de más.
 *
 * Cómo se sabe cuánto costó de verdad cada frasco vendido: se vuelve a pasar
 * por el libro de frascos armados de cada ficha y talla, con los lotes ya
 * corregidos, calculando el promedio igual que `aplicarMovimientoTerminado`.
 * El orden es el de REGISTRO (el id), no el de la fecha: hay ventas anotadas
 * con fecha anterior a su lote, y por fecha parecería que vendieron un frasco
 * que todavía no existía.
 *
 * Tres límites, para no tocar lo que no es este error:
 *  - solo 1.1 (`solo_armado`), que es donde vive el sobrecosto;
 *  - solo BAJA el costo: el error fue cobrar de más, y una subida sería otra
 *    cosa que nadie ha revisado;
 *  - si al venderse no había frasco armado en el libro, no se toca: no hay
 *    contra qué comparar.
 *
 * Nada se guarda: se recalcula en cada consulta, y una vez corregido el libro
 * ya no muestra diferencias, así que corregir dos veces no hace nada.
 */

export interface VentaConCostoDeMas {
  movimiento_id: number;
  venta_id: number;
  fecha: Date;
  ficha: string;
  unidades: number;
  antes: number;
  ahora: number;
  /** Lo que se cargó de más en ESA venta (positivo). */
  valor: number;
}

export const revisarVentasDe11 = async (cli: Cliente = prisma) => {
  const movs = await cli.movimientoTerminado.findMany({
    where: { perfume: { solo_armado: true } },
    select: {
      id: true, perfume_id: true, presentacion_id: true, tipo: true, cantidad: true,
      costo_unitario: true, fecha: true, referencia_id: true, perfume: { select: { nombre: true } },
    },
    orderBy: { id: 'asc' },
  });

  const estado = new Map<string, { stock: number; promedio: number }>();
  const ventas: VentaConCostoDeMas[] = [];
  for (const m of movs) {
    const clave = `${m.perfume_id}:${m.presentacion_id}`;
    const e = estado.get(clave) ?? { stock: 0, promedio: 0 };
    const cantidad = num(m.cantidad);
    if (cantidad > 0) {
      const total = e.stock + cantidad;
      e.promedio = e.stock > 0 && total > 0
        ? r4((e.stock * e.promedio + cantidad * num(m.costo_unitario)) / total)
        : num(m.costo_unitario);
    } else if (m.tipo === 'venta' && m.referencia_id && e.stock >= -cantidad) {
      const valor = r2((num(m.costo_unitario) - e.promedio) * -cantidad);
      if (valor >= 1) {
        ventas.push({
          movimiento_id: m.id, venta_id: m.referencia_id, fecha: m.fecha, ficha: m.perfume.nombre,
          unidades: -cantidad, antes: num(m.costo_unitario), ahora: e.promedio, valor,
        });
      }
    }
    e.stock += cantidad;
    estado.set(clave, e);
  }
  return { ventas, valor: r2(ventas.reduce((s, v) => s + v.valor, 0)) };
};

/**
 * Baja el costo de esas ventas: el del frasco en el libro y el costo de
 * mercancía de la venta, que es de donde sale la ganancia de cada mes.
 */
export const corregirVentasDe11 = async (tx: Prisma.TransactionClient) => {
  const revision = await revisarVentasDe11(tx);
  for (const v of revision.ventas) {
    await tx.movimientoTerminado.update({ where: { id: v.movimiento_id }, data: { costo_unitario: v.ahora } });
    const venta = await tx.venta.findUnique({ where: { id: v.venta_id }, select: { costo_mercancia: true } });
    if (!venta) continue;
    await tx.venta.update({
      where: { id: v.venta_id },
      data: { costo_mercancia: Math.max(0, r2(num(venta.costo_mercancia) - v.valor)) },
    });
  }
  return { ventas: revision.ventas.length, valor_ventas: revision.valor };
};
