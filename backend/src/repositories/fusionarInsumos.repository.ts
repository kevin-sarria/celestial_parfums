import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { badRequest } from '../utils/httpError';
import { aplicarMovimiento } from './inventario.repository';
import { contarUsos, idsDeJson, tallasConAccesorio, type UsosDeInsumo } from './insumo.usos';

/**
 * FUSIONAR DOS REGISTROS DEL MISMO MATERIAL.
 *
 * El dueño acabó con dos fichas del mismo perfumero físico y las dos con
 * historia, así que no podía borrar ninguna. Apagar la vieja —lo que hizo—
 * esconde el problema, pero parte el historial en dos para siempre: el pedido
 * sugerido nunca vuelve a contar bien, y el costo se calcula sobre media vida.
 *
 * Lo que hace esto posible sin descuadrar nada: **`stock` es una columna
 * guardada, no una suma del libro**. Mover la etiqueta `insumo_id` de un
 * movimiento viejo re-etiqueta la historia; no la vuelve a ejecutar. De ahí la
 * regla, que es lo que el dueño pidió con estas palabras: *"que no me descuente
 * lo que esté antes de esa modificación"*.
 *
 *   FUSIONAR MUEVE EL PASADO Y NO TOCA EL PRESENTE.
 *   El registro que sobrevive conserva su stock y su costo promedio.
 *
 * La lista de qué mudar no se escribe aquí: es `contarUsos`, la misma que usa el
 * borrado para decir qué lo retiene. Una regla, un sitio.
 *
 * Diseño completo en `docs/superpowers/specs/2026-08-29-fusionar-materiales-design.md`.
 */

export interface ResultadoFusion {
  destino: { id: number; nombre: string; stock: number };
  origen: { id: number; nombre: string };
  movidos: UsosDeInsumo;
}

/** Lo que se va a mover, para enseñarlo ANTES de aplicar. Solo lee. */
export const vistaPreviaFusion = async (origenId: number) => {
  const origen = await prisma.insumoCosto.findUnique({
    where: { id: origenId },
    select: { id: true, nombre: true, stock: true },
  });
  if (!origen) throw badRequest('Ese material ya no existe');
  return { origen: { ...origen, stock: Number(origen.stock) }, movidos: await contarUsos(origenId) };
};

/**
 * Muda las líneas de accesorios de una receta, esquivando la clave duplicada.
 *
 * `formula_accesorios` tiene clave (receta, insumo): si la receta ya incluye al
 * bueno, mudar la del duplicado reventaría. Se borra en su lugar — el resultado
 * es el mismo, esa receta incluye un perfumero.
 */
const mudarAccesoriosDeRecetas = async (
  tx: Prisma.TransactionClient, origenId: number, destinoId: number,
) => {
  const [delOrigen, delDestino] = await Promise.all([
    tx.formulaAccesorio.findMany({ where: { insumo_id: origenId }, select: { formula_volumen_id: true } }),
    tx.formulaAccesorio.findMany({ where: { insumo_id: destinoId }, select: { formula_volumen_id: true } }),
  ]);
  const yaLoTiene = new Set(delDestino.map((f) => f.formula_volumen_id));

  for (const { formula_volumen_id } of delOrigen) {
    const clave = { formula_volumen_id_insumo_id: { formula_volumen_id, insumo_id: origenId } };
    if (yaLoTiene.has(formula_volumen_id)) await tx.formulaAccesorio.delete({ where: clave });
    else await tx.formulaAccesorio.update({ where: clave, data: { insumo_id: destinoId } });
  }
};

/**
 * Reescribe el id dentro de la lista JSON de accesorios de cada talla.
 *
 * `inventario.consumoVenta.ts` lee esta lista VIVA en cada venta para saber qué
 * descontar. Si aquí quedara el id del duplicado, la siguiente venta de esa
 * talla reventaría con "El insumo no existe" — en la caja, delante del cliente.
 */
const mudarListasDeAccesorios = async (
  tx: Prisma.TransactionClient, origenId: number, destinoId: number,
) => {
  for (const fila of await tallasConAccesorio(origenId, tx)) {
    // Sin duplicar: si la talla ya llevaba los dos, queda uno.
    const ids = [...new Set(idsDeJson(fila.accesorios).map((x) => (x === origenId ? destinoId : x)))];
    await tx.perfumePresentacion.update({
      where: {
        perfume_id_presentacion_id: {
          perfume_id: fila.perfume_id, presentacion_id: fila.presentacion_id,
        },
      },
      data: { accesorios: ids },
    });
  }
};

export const fusionarInsumos = async (
  origenId: number, destinoId: number,
): Promise<ResultadoFusion> => {
  if (origenId === destinoId) {
    throw badRequest('Es el mismo registro: elige cuál de los dos es el material bueno.');
  }

  const [origen, destino] = await Promise.all([
    prisma.insumoCosto.findUnique({ where: { id: origenId } }),
    prisma.insumoCosto.findUnique({ where: { id: destinoId } }),
  ]);
  // Se comprueban contra la base al aplicar, no se confía en lo que llega: entre
  // que se pintó la pantalla y se pulsó el botón, otra pestaña pudo borrar uno.
  if (!origen) throw badRequest('El material que quieres fusionar ya no existe');
  if (!destino) throw badRequest('El material bueno ya no existe');

  const movidos = await contarUsos(origenId);
  const sobraban = Number(origen.stock);

  await prisma.$transaction(async (tx) => {
    await tx.movimientoInventario.updateMany({
      where: { insumo_id: origenId }, data: { insumo_id: destinoId },
    });
    await tx.compraItem.updateMany({
      where: { insumo_id: origenId }, data: { insumo_id: destinoId },
    });
    await tx.formulaVolumen.updateMany({
      where: { envase_insumo_id: origenId }, data: { envase_insumo_id: destinoId },
    });
    await tx.formulaVolumen.updateMany({
      where: { esencia_insumo_id: origenId }, data: { esencia_insumo_id: destinoId },
    });
    await mudarAccesoriosDeRecetas(tx, origenId, destinoId);
    await tx.perfume.updateMany({
      where: { insumo_esencia_id: origenId }, data: { insumo_esencia_id: destinoId },
    });
    await tx.perfume.updateMany({
      where: { insumo_producto_id: origenId }, data: { insumo_producto_id: destinoId },
    });
    await tx.perfumePresentacion.updateMany({
      where: { envase_insumo_id: origenId }, data: { envase_insumo_id: destinoId },
    });
    await mudarListasDeAccesorios(tx, origenId, destinoId);

    /**
     * El rastro, en el sitio donde el dueño lo va a buscar: el historial del
     * material. Cantidad CERO a propósito — aparece en la lista sin mover el
     * stock ni el costo promedio, que es justo lo que la fusión promete no
     * tocar. Va por `aplicarMovimiento` y no por un `create` suelto para que
     * tenga la misma forma que los demás movimientos.
     */
    await aplicarMovimiento(tx, {
      insumo_id: destinoId,
      tipo: 'ajuste',
      cantidad: 0,
      fecha: new Date(),
      nota: `Fusionado desde «${origen.nombre}»: ${movidos.movimientos} movimiento(s)`
        + `, ${movidos.compras} compra(s). Traía ${sobraban} unidad(es), que se descartan.`,
    });

    // Cinturón: si algo quedó apuntando al duplicado, se cancela la fusión
    // entera antes de borrarlo. Borrar arrastraría sus movimientos en cascada.
    const restantes = await contarUsos(origenId, tx);
    if (restantes.total > 0) {
      throw badRequest('Quedaron registros apuntando al duplicado: no se fusionó nada.');
    }
    await tx.insumoCosto.delete({ where: { id: origenId } });
  });

  const quedo = await prisma.insumoCosto.findUniqueOrThrow({ where: { id: destinoId } });
  return {
    destino: { id: quedo.id, nombre: quedo.nombre, stock: Number(quedo.stock) },
    origen: { id: origen.id, nombre: origen.nombre },
    movidos,
  };
};
