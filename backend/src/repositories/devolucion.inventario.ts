import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { aplicarMovimientoTerminado, tallaDeFormula, tallaDeMl } from './inventario.terminado';
import { revertirMovimientos } from './inventario.repository';
import { revertirTerminado } from './inventario.terminado';
import { descontarSalida } from './inventario.consumoVenta';

/**
 * QUÉ LE PASA AL INVENTARIO CUANDO SE RESUELVE UNA DEVOLUCIÓN.
 *
 * Hasta hoy: nada. Ni volvía lo que el cliente devolvía, ni salía el frasco que
 * se enviaba de reposición — así que reponer un Khamrah dejaba el sistema
 * creyendo que ese frasco seguía en la repisa.
 *
 * **Decisión del dueño (2026-08-30): se pregunta caso por caso.** Se evaluó
 * deducirlo del motivo con una tabla fija y lo descartó, con razón: un "llegó
 * equivocado" puede volver abierto y un "llegó dañado" puede ser solo la caja.
 * El motivo dice por qué se quejó el cliente, no en qué estado llegó el frasco.
 *
 * Lo que se mueve, todo con tipo `garantia` y apuntando a la devolución:
 *
 * | Situación | Inventario |
 * |---|---|
 * | Repusiste N frascos | **Salen N**, igual que una venta (de lo armado; si no hay y no es un 1.1, se fabrica) |
 * | Te lo devolvieron y sirve | **Entra**, a la talla que se vendió |
 * | Te lo devolvieron y no sirve | **Nada**: su costo ya se cargó el día de la venta |
 * | No te devolvieron nada | **Nada** |
 *
 * `garantia` y no `venta` porque revertir busca por tipo + referencia: con los
 * dos bajo el mismo tipo, la venta 7 y la devolución 7 serían indistinguibles.
 */

const num = (v: unknown) => Number(v);

const INCLUDE = {
  perfumes: { select: { perfume_id: true, cantidad: true } },
  venta: { select: { perfumes: { select: { perfume_id: true, ml: true } } } },
} as const;

/** Deshace lo que esta devolución había movido. Sirve para reabrirla o editarla. */
export const revertirInventarioDevolucion = async (
  tx: Prisma.TransactionClient, devolucionId: number,
) => {
  await revertirMovimientos(tx, 'garantia', devolucionId);
  await revertirTerminado(tx, 'garantia', devolucionId);
};

/**
 * Aplica al inventario una devolución **resuelta**. Empieza deshaciendo lo
 * anterior, así que se puede llamar las veces que haga falta sin contar doble.
 *
 * Devuelve los avisos que hay que enseñarle al dueño: aquí nada bloquea —la
 * devolución ya pasó en la vida real— pero lo que no se pudo hacer se dice.
 */
export const aplicarInventarioDevolucion = async (
  tx: Prisma.TransactionClient, devolucionId: number,
): Promise<string[]> => {
  await revertirInventarioDevolucion(tx, devolucionId);

  const d = await tx.devolucion.findUnique({ where: { id: devolucionId }, include: INCLUDE });
  if (!d || d.estado !== 'resuelta') return [];

  const avisos: string[] = [];
  const fecha = d.fecha_resolucion ?? d.fecha;
  const etiqueta = `Garantía #${d.id}`;

  /** La talla con la que se vendió cada producto: es la que vuelve a entrar. */
  const mlVendido = new Map(d.venta?.perfumes.map((p) => [p.perfume_id, p.ml]) ?? []);

  // ── 1. Lo que SE FUE: el frasco que se envió de reposición ────────────────
  if (d.reposicion_cantidad > 0 && d.perfumes.length) {
    const ml = d.reposicion_formula_id
      ? num((await tx.formulaVolumen.findUnique({
        where: { id: d.reposicion_formula_id }, select: { ml_total: true },
      }))?.ml_total ?? 0) || null
      : mlVendido.get(d.perfumes[0].perfume_id) ?? null;

    const salida = await descontarSalida(tx, {
      referenciaId: d.id,
      fecha,
      tipo: 'garantia',
      etiqueta,
      // Se repone el producto del caso; si hay varios, el primero es el que
      // falló (la pantalla solo deja elegir uno para reponer).
      lineas: [{
        perfume_id: d.perfumes[0].perfume_id,
        ml: ml == null ? null : Number(ml),
        cantidad: d.reposicion_cantidad,
      }],
    });
    avisos.push(...salida.avisos, ...salida.sinCostear.map((t) => `No se pudo costear: ${t}.`));
  }

  // ── 2. Lo que VOLVIÓ, si sirve para venderse otra vez ─────────────────────
  if (d.producto_devuelto && d.revendible) {
    for (const linea of d.perfumes) {
      const ml = mlVendido.get(linea.perfume_id);
      const presentacion_id = ml ? await tallaDeMl(Number(ml)) : null;
      if (!presentacion_id) {
        const p = await tx.perfume.findUnique({
          where: { id: linea.perfume_id }, select: { nombre: true },
        });
        avisos.push(
          `No se pudo devolver ${p?.nombre ?? 'ese producto'} al inventario:`
          + ' la venta original no dice qué talla se llevó el cliente.',
        );
        continue;
      }

      /**
       * Entra al costo promedio que ese frasco tiene HOY.
       *
       * No al del día de la venta: es un frasco idéntico a los que están en la
       * repisa, y valorarlo distinto partiría el promedio de esa ficha en dos.
       */
      const ficha = await tx.perfumePresentacion.findUnique({
        where: { perfume_id_presentacion_id: { perfume_id: linea.perfume_id, presentacion_id } },
        select: { costo_promedio: true },
      });
      await aplicarMovimientoTerminado(tx, {
        perfume_id: linea.perfume_id,
        presentacion_id,
        tipo: 'garantia',
        cantidad: linea.cantidad,
        costo_unitario: num(ficha?.costo_promedio),
        fecha,
        referencia_id: d.id,
        nota: `${etiqueta} · devuelto y revendible`,
      });
    }
  }

  return avisos;
};

/** La talla de una fórmula, para la pantalla de reposición. */
export const tallaDeReposicion = (formulaVolumenId: number) => tallaDeFormula(formulaVolumenId);

/** Versión suelta, para quien no está dentro de una transacción. */
export const resolverInventarioDevolucion = (devolucionId: number) =>
  prisma.$transaction((tx) => aplicarInventarioDevolucion(tx, devolucionId));
