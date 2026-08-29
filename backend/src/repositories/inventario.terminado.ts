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

/**
 * Rehace el costo promedio de una ficha×talla desde el libro.
 *
 * El promedio es una PROYECCIÓN de `movimientos_terminado`, igual que el stock:
 * se pondera lo que entró y sigue vivo. Antes solo se tocaba al entrar frascos,
 * así que revertir un lote restaba las unidades y dejaba el costo del lote
 * borrado mintiendo — invisible mientras borrar era raro, y rutina desde que un
 * lote se puede editar (2026-08-25).
 */
export const recalcularPromedioTerminado = async (
  tx: Prisma.TransactionClient, perfume_id: number, presentacion_id: number,
) => {
  const movs = await tx.movimientoTerminado.findMany({
    where: { perfume_id, presentacion_id },
    select: { cantidad: true, costo_unitario: true },
  });

  let unidades = 0;
  let plata = 0;
  for (const m of movs) {
    const cantidad = num(m.cantidad);
    // Solo las ENTRADAS forman el promedio: una salida se valora al promedio
    // vigente y no lo mueve. Es la misma regla que rige los materiales.
    if (cantidad > 0) { unidades += cantidad; plata += cantidad * num(m.costo_unitario); }
  }

  const promedio = unidades > 0 ? r4(plata / unidades) : 0;
  await tx.perfumePresentacion.updateMany({
    where: { perfume_id, presentacion_id }, data: { costo_promedio: promedio },
  });
  return promedio;
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

  // El promedio se rehace del libro: restarlo "a ojo" lo iría torciendo.
  const fichas = new Map(movs.map((m) => [`${m.perfume_id}|${m.presentacion_id}`, m]));
  for (const f of fichas.values()) {
    await recalcularPromedioTerminado(tx, f.perfume_id, f.presentacion_id);
  }
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

export interface SalidaDeTerminado {
  /** Unidades de la línea que salieron de lo armado (el resto se fabrica). */
  unidades: number;
  costo: number;
  /** Unidades que salieron SIN haber estado armadas (solo los 1.1): el aviso. */
  faltaron: number;
  /** true = es un 1.1; quien llama NO puede fabricar lo que falte. */
  soloArmado: boolean;
  nombre: string;
}

const vacia = (soloArmado = false, nombre = ''): SalidaDeTerminado =>
  ({ unidades: 0, costo: 0, faltaron: 0, soloArmado, nombre });

/**
 * Saca de los frascos armados lo que se pueda para una línea de venta.
 *
 * Devuelve cuántas unidades salieron de ahí y lo que costaron, para que quien
 * llama arme el resto con materiales.
 *
 * ## Los 1.1 son la excepción, y es una regla de plata (2026-08-29)
 *
 * Un perfume corriente que no esté armado se fabrica al vender: se descuenta su
 * receta. **Un 1.1 no se puede fabricar** — es una fragancia original envasada
 * por el dueño, no un contratipo que salga de una esencia. Antes, vender uno sin
 * frascos armados descontaba esencia + envase 1.1 como si lo hubiera armado: la
 * tienda lo escondía (sale "Sin armar"), pero **una venta cargada a mano en el
 * dashboard sí pasaba**, y dejaba materiales descontados por un frasco que nunca
 * existió.
 *
 * **Decisión del dueño**: dejar pasar y avisar. La venta se registra —ya
 * ocurrió—, el frasco queda en negativo, **no se toca ni un material** y la
 * respuesta lo dice. Es la misma regla que ya rige el inventario de materiales:
 * el sistema nunca bloquea algo que pasó en la vida real, pero tampoco lo tapa.
 */
export const sacarDeTerminado = async (
  tx: Prisma.TransactionClient,
  opciones: { perfume_id: number; ml: number | null; cantidad: number; ventaId: number; fecha: Date },
): Promise<SalidaDeTerminado> => {
  const { perfume_id, ml, cantidad, ventaId, fecha } = opciones;
  const perfume = await tx.perfume.findUnique({
    where: { id: perfume_id }, select: { nombre: true, solo_armado: true },
  });
  const soloArmado = perfume?.solo_armado ?? false;
  const nombre = perfume?.nombre ?? `perfume #${perfume_id}`;
  if (cantidad <= 0) return vacia(soloArmado, nombre);

  // Sin talla reconocible no hay dónde apuntar el frasco. Quien llama se entera
  // por `soloArmado` de que tampoco puede fabricarlo con materiales.
  const presentacion_id = ml ? await tallaDeMl(ml) : null;
  if (!presentacion_id) return vacia(soloArmado, nombre);

  const fila = await tx.perfumePresentacion.findUnique({
    where: { perfume_id_presentacion_id: { perfume_id, presentacion_id } },
  });
  const disponible = Math.max(0, Math.floor(num(fila?.stock)));

  // El 1.1 sale entero aunque no haya: lo que falta queda en negativo y se avisa.
  const unidades = soloArmado ? cantidad : Math.min(cantidad, disponible);
  if (unidades <= 0) return vacia(soloArmado, nombre);

  const res = await aplicarMovimientoTerminado(tx, {
    perfume_id, presentacion_id, tipo: 'venta',
    cantidad: -unidades, fecha, referencia_id: ventaId,
    nota: `Venta #${ventaId}`,
  });
  return {
    unidades,
    costo: res.costoAplicado * unidades,
    faltaron: Math.max(0, unidades - disponible),
    soloArmado,
    nombre,
  };
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
