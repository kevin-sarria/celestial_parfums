import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { badRequest } from '../utils/httpError';

/**
 * Producto TERMINADO: los frascos que ya están armados.
 *
 * Hasta el 2026-08-14 producir descontaba los materiales y vender los descontaba
 * OTRA VEZ, así que un frasco armado por adelantado gastaba su esencia dos
 * veces: costo del mes inflado, ganancia falsa y stock en negativo. Nació de un
 * caso real — el dueño armó 9 frascos (4 de ellos "1.1") en producción.
 *
 * La regla, acordada con él:
 *
 *   Al vender, si hay frascos armados se descuentan ESOS primero; si no hay o no
 *   alcanzan, se consumen los materiales por el resto. Y el costo de lo que sale
 *   armado es **el costo con que se armó**, no el que tendría la receta hoy.
 *
 * Es el MISMO patrón que los materiales y a propósito: el libro
 * (`movimientos_terminado`) es la verdad y `perfume_presentacion.stock` es solo
 * su proyección. Vive en su propio archivo porque `inventario.repository.ts` ya
 * pasa de 600 líneas.
 */

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const num = (v: Prisma.Decimal | number | null | undefined) => Number(v ?? 0);

export interface MovimientoTerminadoNuevo {
  perfume_id: number;
  presentacion_id: number;
  tipo: 'produccion' | 'venta' | 'ajuste' | 'garantia' | 'merma';
  /** Positiva entra (se armó), negativa sale (se vendió). */
  cantidad: number;
  /** Solo para entradas: a qué costo quedó cada frasco. Las salidas usan el promedio. */
  costo_unitario?: number;
  fecha: Date;
  referencia_id?: number | null;
  nota?: string | null;
}

/**
 * Mueve frascos armados y deja el stock y su costo promedio al día.
 *
 * ENTRADA: promedia lo que ya había con lo que se armó, igual que una compra de
 * material — armar 5 baratos y 1 caro no puede dejar el costo del caro.
 * SALIDA: se valora al promedio vigente y el promedio NO cambia.
 *
 * Siempre dentro de una transacción: el movimiento y la proyección cuadran o no
 * vale ninguno de los dos.
 */
export const aplicarMovimientoTerminado = async (
  tx: Prisma.TransactionClient, mov: MovimientoTerminadoNuevo,
) => {
  const clave = {
    perfume_id_presentacion_id: {
      perfume_id: mov.perfume_id,
      presentacion_id: mov.presentacion_id,
    },
  };
  const fila = await tx.perfumePresentacion.findUnique({ where: clave });

  const stockActual = num(fila?.stock);
  const promedioActual = num(fila?.costo_promedio);
  const entra = mov.cantidad > 0;
  const costoAplicado = r4(entra ? (mov.costo_unitario ?? promedioActual) : promedioActual);

  let nuevoPromedio = promedioActual;
  if (entra) {
    const total = stockActual + mov.cantidad;
    // Con stock en cero (o negativo por un descuadre) manda el costo de este
    // lote: ponderar contra nada daría una división sin sentido.
    nuevoPromedio = stockActual > 0 && total > 0
      ? r4((stockActual * promedioActual + mov.cantidad * costoAplicado) / total)
      : costoAplicado;
  }
  const nuevoStock = r3(stockActual + mov.cantidad);

  await tx.movimientoTerminado.create({
    data: {
      perfume_id: mov.perfume_id,
      presentacion_id: mov.presentacion_id,
      tipo: mov.tipo,
      cantidad: mov.cantidad,
      costo_unitario: costoAplicado,
      fecha: mov.fecha,
      referencia_id: mov.referencia_id ?? null,
      nota: mov.nota ?? null,
    },
  });

  // La combinación perfume×talla puede no existir todavía (se armó algo que aún
  // no está marcado como talla vendible). Se crea: el frasco existe igual.
  if (fila) {
    await tx.perfumePresentacion.update({
      where: clave, data: { stock: nuevoStock, costo_promedio: nuevoPromedio },
    });
  } else {
    await tx.perfumePresentacion.create({
      data: {
        perfume_id: mov.perfume_id,
        presentacion_id: mov.presentacion_id,
        stock: nuevoStock,
        costo_promedio: nuevoPromedio,
      },
    });
  }

  return { stock: nuevoStock, promedio: nuevoPromedio, costoAplicado };
};

/**
 * FRASCOS QUE YA EXISTÍAN ANTES DEL SISTEMA (carga inicial).
 *
 * Producir descuenta material; esto no. Es para los frascos que el dueño armó
 * hace semanas, cuya esencia ya salió de la bodega y —comprobado con él el
 * 2026-08-25— **no está contada** en el inventario, porque al contar midió solo
 * el líquido suelto. Volver a descontarla dejaría esas esencias en negativo por
 * un gasto ya restado, y por eso esos 5 frascos llevaban semanas sin poder
 * entrar al sistema por ningún camino.
 *
 * Queda como `ajuste`, nunca como `produccion`: un lote que no ocurrió no puede
 * aparecer en Producciones ni sumar al costo del mes.
 */
export const cargaInicialArmados = async (datos: {
  perfume_id: number;
  presentacion_id: number;
  cantidad: number;
  /** Lo que costó CADA frasco. Se propone calculado en la pantalla y se puede corregir. */
  costo_unitario: number;
  fecha: Date;
  nota?: string | null;
}) => {
  if (!Number.isFinite(datos.cantidad) || datos.cantidad <= 0) {
    throw badRequest('Dinos cuántos frascos tienes armados (un número mayor que cero). Para sacar frascos, usa el ajuste de inventario.');
  }
  if (!Number.isFinite(datos.costo_unitario) || datos.costo_unitario < 0) {
    throw badRequest('El costo de cada frasco no puede ser negativo.');
  }

  return prisma.$transaction((tx) => aplicarMovimientoTerminado(tx, {
    perfume_id: datos.perfume_id,
    presentacion_id: datos.presentacion_id,
    tipo: 'ajuste',
    cantidad: datos.cantidad,
    costo_unitario: datos.costo_unitario,
    fecha: datos.fecha,
    nota: datos.nota?.trim()
      ? `Carga inicial · ${datos.nota.trim()}`.slice(0, 255)
      : 'Carga inicial (frascos que ya existían)',
  }));
};

/** Deshace los movimientos de terminado de una producción o de una venta. */
export const revertirTerminado = async (
  tx: Prisma.TransactionClient,
  tipo: 'produccion' | 'venta',
  referenciaId: number,
) => {
  const movs = await tx.movimientoTerminado.findMany({
    where: { tipo, referencia_id: referenciaId },
    orderBy: { id: 'desc' },
  });
  for (const m of movs) {
    const clave = {
      perfume_id_presentacion_id: {
        perfume_id: m.perfume_id, presentacion_id: m.presentacion_id,
      },
    };
    const fila = await tx.perfumePresentacion.findUnique({ where: clave });
    if (!fila) continue;
    await tx.perfumePresentacion.update({
      where: clave, data: { stock: r3(num(fila.stock) - num(m.cantidad)) },
    });
  }
  await tx.movimientoTerminado.deleteMany({ where: { tipo, referencia_id: referenciaId } });
};

/**
 * Qué talla corresponde a una receta.
 *
 * Se busca por el enlace real (`presentaciones.formula_volumen_id`), no por el
 * nombre: el texto se escribía de cinco formas distintas y por eso existe ese
 * enlace desde la migración de tallas en ml.
 */
export const tallaDeFormula = async (formulaVolumenId: number) => {
  const p = await prisma.presentacion.findFirst({
    where: { formula_volumen_id: formulaVolumenId },
    select: { id: true },
  });
  return p?.id ?? null;
};

/** La talla que corresponde a unos ml (para las líneas de una venta). */
export const tallaDeMl = async (ml: number) => {
  const p = await prisma.presentacion.findFirst({ where: { ml }, select: { id: true } });
  return p?.id ?? null;
};

/**
 * Saca de los frascos armados lo que se pueda para una línea de venta.
 *
 * Devuelve cuántas unidades salieron de ahí y lo que costaron, para que quien
 * llama arme el resto con materiales. **Nunca deja el stock en negativo**: lo
 * que no hay, no sale de aquí.
 */
export const sacarDeTerminado = async (
  tx: Prisma.TransactionClient,
  opciones: { perfume_id: number; ml: number | null; cantidad: number; ventaId: number; fecha: Date },
) => {
  const { perfume_id, ml, cantidad, ventaId, fecha } = opciones;
  if (!ml || cantidad <= 0) return { unidades: 0, costo: 0 };

  const presentacion_id = await tallaDeMl(ml);
  if (!presentacion_id) return { unidades: 0, costo: 0 };

  const fila = await tx.perfumePresentacion.findUnique({
    where: { perfume_id_presentacion_id: { perfume_id, presentacion_id } },
  });
  const disponible = Math.floor(num(fila?.stock));
  if (disponible <= 0) return { unidades: 0, costo: 0 };

  const unidades = Math.min(cantidad, disponible);
  const res = await aplicarMovimientoTerminado(tx, {
    perfume_id, presentacion_id, tipo: 'venta',
    cantidad: -unidades, fecha, referencia_id: ventaId,
    nota: `Venta #${ventaId}`,
  });
  return { unidades, costo: res.costoAplicado * unidades };
};

/**
 * Qué hay armado hoy, listo para pintarlo en Inventario.
 *
 * Solo las combinaciones con existencias: la tabla `perfume_presentacion` tiene
 * una fila por cada perfume × talla del catálogo (cientos), y enseñarlas todas
 * en cero escondería las cinco que importan.
 *
 * **Los negativos SÍ se muestran.** Aparecen cuando se vendió algo que no
 * estaba armado o se borró un lote ya vendido; es el criterio acordado (dejar
 * pasar y avisar), y esconderlos sería avisar a nadie.
 */
export const listarTerminado = async () => {
  const filas = await prisma.perfumePresentacion.findMany({
    where: { NOT: { stock: 0 } },
    include: {
      perfume: { select: { nombre: true } },
      presentacion: { select: { nombre: true, ml: true } },
    },
  });

  const lista = filas
    .map((f) => {
      const cantidad = num(f.stock);
      const costo = num(f.costo_promedio);
      return {
        perfume_id: f.perfume_id,
        presentacion_id: f.presentacion_id,
        perfume: f.perfume.nombre,
        talla: f.presentacion.nombre,
        ml: f.presentacion.ml ?? null,
        cantidad,
        /** Lo que costó armar CADA frasco, congelado el día que se armó. */
        costo_unitario: r4(costo),
        valor: Math.round(cantidad * costo * 100) / 100,
      };
    })
    .sort((a, b) => a.perfume.localeCompare(b.perfume) || (a.ml ?? 0) - (b.ml ?? 0));

  return {
    filas: lista,
    unidades: r3(lista.reduce((s, f) => s + f.cantidad, 0)),
    /**
     * Plata que hoy está en frascos y no en materiales. Sin esta cifra, armar
     * un lote hace *desaparecer* valor del inventario: sale de los materiales
     * y no entra en ningún lado.
     */
    valor: Math.round(lista.reduce((s, f) => s + f.valor, 0) * 100) / 100,
  };
};

/** Cuántos frascos armados hay de un perfume (todas sus tallas). */
export const armadosDePerfume = async (perfumeId: number) => {
  const filas = await prisma.perfumePresentacion.findMany({
    where: { perfume_id: perfumeId }, select: { stock: true },
  });
  return filas.reduce((s, f) => s + num(f.stock), 0);
};
