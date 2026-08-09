import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { badRequest } from '../utils/httpError';

/**
 * Motor de inventario: stock y **costo promedio ponderado** de cada insumo.
 *
 * Regla de oro: nada se toca a mano. Todo entra y sale por un movimiento
 * (`movimientos_inventario`), y `insumos_costo.stock`/`precio` son la
 * proyección de ese libro. Así el costo que usan las cotizaciones y los
 * márgenes es el que de verdad pagaste, no uno tecleado hace tres meses.
 */

const num = (v: unknown) => Number(v);
/** Redondeo a 3 decimales: los ml de una fórmula no necesitan más. */
const r3 = (n: number) => Math.round(n * 1000) / 1000;
/** El costo unitario sí lleva 4 decimales: a $0,0001/ml × 30 ml importa. */
const r4 = (n: number) => Math.round(n * 10000) / 10000;

export type TipoMovimiento = 'compra' | 'produccion' | 'garantia' | 'ajuste' | 'merma' | 'muestra' | 'venta';

interface MovimientoNuevo {
  insumo_id: number;
  tipo: TipoMovimiento;
  /** Positiva entra, negativa sale. */
  cantidad: number;
  /** Solo para entradas: a qué costo llegó. Las salidas usan el promedio. */
  costo_unitario?: number;
  fecha: Date;
  referencia_id?: number | null;
  nota?: string | null;
}

/**
 * Aplica un movimiento y deja el stock y el costo promedio al día.
 *
 * ENTRADA (compra): el promedio se recalcula ponderando lo que ya había con
 * lo que llega:  (stock×promedio + cantidad×costo) / (stock + cantidad).
 * Es el estándar contable y evita que una compra cara de 50 ml te dispare el
 * costo de los 500 ml que ya tenías.
 *
 * SALIDA (producción, garantía, merma): se valora al promedio vigente y el
 * promedio NO cambia — sacar material no altera lo que costó.
 *
 * Debe llamarse SIEMPRE dentro de una transacción: el movimiento y la
 * proyección tienen que cuadrar o no vale ninguno de los dos.
 */
export const aplicarMovimiento = async (tx: Prisma.TransactionClient, mov: MovimientoNuevo) => {
  const insumo = await tx.insumoCosto.findUnique({ where: { id: mov.insumo_id } });
  if (!insumo) throw badRequest('El insumo no existe');

  const stockActual = num(insumo.stock);
  const promedioActual = num(insumo.precio);
  const entra = mov.cantidad > 0;

  let nuevoPromedio = promedioActual;
  const costoAplicado = entra
    ? r4(mov.costo_unitario ?? promedioActual)
    : r4(promedioActual);

  if (entra) {
    const totalUnidades = stockActual + mov.cantidad;
    // Con stock en cero (o negativo por un descuadre) el promedio es el de la
    // compra: ponderar contra nada daría una división rara.
    nuevoPromedio = stockActual > 0 && totalUnidades > 0
      ? r4((stockActual * promedioActual + mov.cantidad * costoAplicado) / totalUnidades)
      : costoAplicado;
  }

  const nuevoStock = r3(stockActual + mov.cantidad);

  await tx.movimientoInventario.create({
    data: {
      insumo_id: mov.insumo_id,
      tipo: mov.tipo,
      cantidad: mov.cantidad,
      costo_unitario: costoAplicado,
      fecha: mov.fecha,
      referencia_id: mov.referencia_id ?? null,
      nota: mov.nota ?? null,
    },
  });

  await tx.insumoCosto.update({
    where: { id: mov.insumo_id },
    data: { stock: nuevoStock, precio: nuevoPromedio },
  });

  return { stock: nuevoStock, promedio: nuevoPromedio, costoAplicado };
};

/**
 * Cuánto vale UNA unidad de compra en la unidad base del insumo (ml o piezas).
 *
 * Los proveedores facturan ml y gramos **1 a 1** (así lo maneja el sector), por
 * eso `g` no lleva densidad. Los **litros SÍ multiplican por 1000**: sin esto,
 * teclear "20 L" de alcohol se registraba como 20 ml y el costo por ml quedaba
 * mil veces inflado — con el diluyente siendo casi la mitad del volumen de un
 * frasco, eso solo daba costos de producción absurdos.
 */
export const FACTOR_UNIDAD: Record<string, number> = {
  ml: 1,
  g: 1,
  l: 1000,
  kg: 1000,
  unidad: 1,
};

export const aBase = (cantidad: number, unidad: string) =>
  r3(cantidad * (FACTOR_UNIDAD[unidad] ?? 1));

export type IvaModo = 'incluido' | 'agregado' | 'sin_iva';

/** Cómo se liquida el IVA de una compra, resuelto contra el proveedor. */
export interface IvaCompra {
  modo: IvaModo;
  tasa: number;
  /** true = el negocio lo descuenta ante la DIAN, así que NO es costo. */
  descontable: boolean;
}

/**
 * Parte un valor de línea en base gravable e IVA, según cómo factura ESE proveedor.
 *
 * Existe porque el IVA no es global: el distribuidor principal entrega el precio
 * ya con impuesto, otros lo suman aparte y las compras al exterior no lo cobran.
 * Aplicarle 19% a todos contaría el impuesto dos veces con el proveedor más grande.
 */
export const desglosarIva = (subtotal: number, modo: IvaModo, tasa: number) => {
  if (modo === 'sin_iva' || tasa <= 0) return { base: r4(subtotal), iva: 0 };
  if (modo === 'agregado') return { base: r4(subtotal), iva: r4(subtotal * tasa) };
  const base = subtotal / (1 + tasa); // 'incluido': el valor ya lo trae dentro
  return { base: r4(base), iva: r4(subtotal - base) };
};

/**
 * Cuánto cuesta de verdad una unidad de cada línea de la compra.
 *
 * Suma lo que se pagó: el material, su IVA (cuando no se descuenta) y la parte
 * proporcional del flete. El prorrateo del transporte se hace sobre el valor CON
 * impuesto, que es lo que de verdad pesa cada línea en la factura.
 *
 * Devuelve el costo por unidad BASE (por ml, no por litro), que es como se valora
 * el inventario y como lo consumen las fórmulas.
 *
 * `iva` es opcional: sin él se comporta exactamente igual que antes.
 */
export const costosConFlete = (
  lineas: { cantidad: number; subtotal: number; unidad_compra?: string }[],
  flete: number,
  iva?: IvaCompra,
): number[] => {
  // Costo = base gravable + el IVA SOLO si no se descuenta.
  // Ojo: no es `subtotal + iva`. Con el modo `incluido` el subtotal ya trae el
  // impuesto dentro, así que sumárselo lo contaría dos veces — que es
  // precisamente el error que esta función existe para evitar.
  const valores = lineas.map((l) => {
    if (!iva) return l.subtotal;
    const { base, iva: impuesto } = desglosarIva(l.subtotal, iva.modo, iva.tasa);
    return iva.descontable ? base : base + impuesto;
  });
  const total = valores.reduce((s, v) => s + v, 0);
  return lineas.map((l, i) => {
    const base = aBase(l.cantidad, l.unidad_compra ?? 'unidad');
    if (base <= 0) return 0;
    const parteFlete = total > 0 ? (valores[i] / total) * flete : 0;
    return r4((valores[i] + parteFlete) / base);
  });
};

/**
 * Deshace los movimientos de una referencia (al borrar una compra o una
 * producción). Se recorre al revés para que el promedio se destense en el
 * orden inverso al que se armó.
 */
export const revertirMovimientos = async (
  tx: Prisma.TransactionClient, tipo: TipoMovimiento, referenciaId: number,
) => {
  const movs = await tx.movimientoInventario.findMany({
    where: { tipo, referencia_id: referenciaId },
    orderBy: { id: 'desc' },
  });
  for (const m of movs) {
    const insumo = await tx.insumoCosto.findUnique({ where: { id: m.insumo_id } });
    if (!insumo) continue;
    const stock = num(insumo.stock) - num(m.cantidad);
    await tx.insumoCosto.update({
      where: { id: m.insumo_id },
      data: { stock: r3(stock) },
    });
  }
  await tx.movimientoInventario.deleteMany({ where: { tipo, referencia_id: referenciaId } });
  // El promedio se reconstruye del libro: revertirlo "a ojo" lo iría torciendo
  const insumos = [...new Set(movs.map((m) => m.insumo_id))];
  for (const id of insumos) await recalcularPromedio(tx, id);
};

/**
 * Reconstruye el costo promedio de un insumo recorriendo su libro de
 * movimientos desde cero. Es la red de seguridad: si algo se descuadra,
 * este es el número correcto.
 */
export const recalcularPromedio = async (tx: Prisma.TransactionClient, insumoId: number) => {
  const movs = await tx.movimientoInventario.findMany({
    where: { insumo_id: insumoId },
    orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
  });
  let stock = 0;
  let promedio = 0;
  for (const m of movs) {
    const cant = num(m.cantidad);
    if (cant > 0) {
      const total = stock + cant;
      promedio = stock > 0 && total > 0
        ? r4((stock * promedio + cant * num(m.costo_unitario)) / total)
        : r4(num(m.costo_unitario));
    }
    stock += cant;
  }
  await tx.insumoCosto.update({
    where: { id: insumoId },
    data: { stock: r3(stock), ...(movs.length ? { precio: promedio } : {}) },
  });
  return { stock: r3(stock), promedio };
};

/** Movimientos de un insumo, para la ficha de inventario del dashboard. */
export const movimientosDeInsumo = async (insumoId: number, limite = 100) => {
  const rows = await prisma.movimientoInventario.findMany({
    where: { insumo_id: insumoId },
    orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
    take: limite,
  });
  return rows.map((m) => ({
    id: m.id,
    tipo: m.tipo,
    cantidad: num(m.cantidad),
    costo_unitario: num(m.costo_unitario),
    fecha: m.fecha.toISOString().slice(0, 10),
    referencia_id: m.referencia_id,
    nota: m.nota,
  }));
};

// ── Ajustes por conteo físico ───────────────────────────────────────────────

/**
 * "Conté y tengo X": el sistema calcula la diferencia contra el stock actual y
 * la registra como movimiento. Sirve para sembrar el stock inicial (de 0 a lo
 * que haya) y para corregir mermas o roturas.
 */
export const ajustarStock = async (data: {
  insumo_id: number; cantidad_final: number; costo_unitario?: number;
  stock_minimo?: number | null; fecha: string; nota?: string | null;
}) => prisma.$transaction(async (tx) => {
  const insumo = await tx.insumoCosto.findUnique({ where: { id: data.insumo_id } });
  if (!insumo) throw badRequest('El insumo no existe');
  // El punto de pedido se guarda siempre, aunque la cantidad no cambie
  if (data.stock_minimo != null) {
    await tx.insumoCosto.update({
      where: { id: data.insumo_id }, data: { stock_minimo: data.stock_minimo },
    });
  }
  const delta = r3(data.cantidad_final - num(insumo.stock));
  if (delta === 0) return { sinCambios: true, stock: num(insumo.stock), promedio: num(insumo.precio) };

  const res = await aplicarMovimiento(tx, {
    insumo_id: data.insumo_id,
    tipo: 'ajuste',
    cantidad: delta,
    // Solo pesa si entra material; al sacar se valora al promedio vigente
    costo_unitario: delta > 0 ? data.costo_unitario : undefined,
    fecha: new Date(data.fecha),
    nota: data.nota ?? (delta > 0 ? 'Ajuste: entra material' : 'Ajuste: sale material'),
  });
  return { sinCambios: false, ...res, delta };
});

// ── Producción ──────────────────────────────────────────────────────────────

/**
 * Registra un lote armado y descuenta sus insumos. El costo del lote se calcula
 * con el promedio VIGENTE de cada insumo y se congela: si mañana sube la
 * esencia, lo que costó este lote no cambia.
 */
export const registrarProduccion = async (data: {
  fecha: string; formula_volumen_id: number; cantidad: number;
  perfume_id?: number | null; envase_insumo_id?: number | null;
  consumos: { insumo_id: number; cantidad: number }[]; nota?: string | null;
}) => prisma.$transaction(async (tx) => {
  const fecha = new Date(data.fecha);
  // Se crea primero para tener el id al que apuntan los movimientos
  const prod = await tx.produccion.create({
    data: {
      fecha,
      formula_volumen_id: data.formula_volumen_id,
      perfume_id: data.perfume_id ?? null,
      envase_insumo_id: data.envase_insumo_id ?? null,
      cantidad: data.cantidad,
      costo_unitario: 0,
      costo_total: 0,
      nota: data.nota ?? null,
    },
  });

  let costoTotal = 0;
  for (const c of data.consumos) {
    const res = await aplicarMovimiento(tx, {
      insumo_id: c.insumo_id,
      tipo: 'produccion',
      cantidad: -Math.abs(c.cantidad),
      fecha,
      referencia_id: prod.id,
      nota: `Lote de ${data.cantidad} u`,
    });
    costoTotal += res.costoAplicado * Math.abs(c.cantidad);
  }

  const total = Math.round(costoTotal * 100) / 100;
  return tx.produccion.update({
    where: { id: prod.id },
    data: { costo_total: total, costo_unitario: r4(total / data.cantidad) },
    include: { formula: { select: { nombre: true } } },
  });
});

export const listarProducciones = async (limite = 60) => {
  const rows = await prisma.produccion.findMany({
    orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
    take: limite,
    include: { formula: { select: { nombre: true } }, perfume: { select: { nombre: true } } },
  });
  return rows.map((p) => ({
    id: p.id,
    fecha: p.fecha.toISOString().slice(0, 10),
    formula_volumen_id: p.formula_volumen_id,
    volumen_nombre: p.formula?.nombre ?? '',
    perfume_nombre: p.perfume?.nombre ?? null,
    cantidad: p.cantidad,
    costo_unitario: num(p.costo_unitario),
    costo_total: num(p.costo_total),
    nota: p.nota,
  }));
};

/** Borrar un lote devuelve sus insumos al inventario. */
export const eliminarProduccion = (id: number) => prisma.$transaction(async (tx) => {
  await revertirMovimientos(tx, 'produccion', id);
  return tx.produccion.delete({ where: { id } });
});

/** Foto del inventario para el dashboard: qué hay y cuánto vale. */
/**
 * Qué hay en bodega.
 *
 * Incluye los APAGADOS a propósito, al final y marcados: es la pantalla donde
 * el dueño trabaja con sus materiales, así que también es donde los jubila y
 * donde tiene que poder volver a encenderlos. Filtrarlos aquí dejaría un insumo
 * apagado sin ninguna pantalla desde la cual recuperarlo.
 *
 * Los totales sí cuentan SOLO los activos: un material jubilado ya no es parte
 * de lo que tienes para trabajar.
 */
export const resumenInventario = async () => {
  const insumos = await prisma.insumoCosto.findMany({
    orderBy: [{ activo: 'desc' }, { tipo: 'asc' }, { nombre: 'asc' }],
  });
  const filas = insumos.map((i) => {
    const stock = num(i.stock);
    const precio = num(i.precio);
    const minimo = num(i.stock_minimo);
    return {
      id: i.id,
      nombre: i.nombre,
      tipo: i.tipo,
      unidad: i.unidad,
      /** Solo esencias: su gama. Null en envases, accesorios y el resto. */
      gama: i.gama ?? null,
      activo: i.activo,
      stock,
      stock_minimo: minimo,
      // Con mínimo en 0 la alerta está apagada: no todo insumo la necesita.
      // Un apagado nunca alerta: ya no se compra.
      bajo_minimo: i.activo && minimo > 0 && stock <= minimo,
      /** Cuánto pedir para volver al doble del mínimo (colchón razonable). */
      sugerido: i.activo && minimo > 0 && stock <= minimo ? Math.max(0, Math.round((minimo * 2 - stock) * 1000) / 1000) : 0,
      costo_promedio: precio,
      valor: Math.round(stock * precio * 100) / 100,
    };
  });
  return {
    insumos: filas,
    // Solo lo activo: lo jubilado no cuenta como inventario de trabajo
    valor_total: Math.round(filas.filter((f) => f.activo).reduce((s, f) => s + f.valor, 0) * 100) / 100,
  };
};


/**
 * Saca material sin que haya venta: muestras del mostrario, minis de regalo o
 * una merma identificada. Se valora al costo promedio vigente, así sabes
 * cuánta plata se va por cada vía.
 *
 * El desperdicio pequeño del día a día (los gramos que se van de más al
 * servir) NO hace falta anotarlo uno por uno: el conteo físico lo absorbe.
 */
export const registrarSalida = async (data: {
  insumo_id: number; cantidad: number; unidad: string;
  motivo: 'muestra' | 'merma'; fecha: string; nota?: string | null;
}) => prisma.$transaction(async (tx) => {
  const cantidad = aBase(data.cantidad, data.unidad);
  if (cantidad <= 0) throw badRequest('La cantidad debe ser mayor a 0');
  const res = await aplicarMovimiento(tx, {
    insumo_id: data.insumo_id,
    tipo: data.motivo,
    cantidad: -cantidad,
    fecha: new Date(data.fecha),
    nota: data.nota ?? (data.motivo === 'muestra' ? 'Muestra / mostrario' : 'Merma'),
  });
  return { ...res, costo: Math.round(res.costoAplicado * cantidad * 100) / 100 };
});

/** Cuánto se ha ido este mes por muestras, mermas y ajustes (para el resumen). */
export const salidasDelMes = async () => {
  const ahora = new Date();
  const inicio = new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), 1));
  const movs = await prisma.movimientoInventario.findMany({
    where: { fecha: { gte: inicio }, tipo: { in: ['muestra', 'merma', 'ajuste'] } },
  });
  const suma = (tipo: string) => Math.round(movs
    .filter((m) => m.tipo === tipo && num(m.cantidad) < 0)
    .reduce((s, m) => s + Math.abs(num(m.cantidad)) * num(m.costo_unitario), 0) * 100) / 100;
  return { muestras: suma('muestra'), mermas: suma('merma'), ajustes: suma('ajuste') };
};

// ── Consumo por venta ───────────────────────────────────────────────────────

/**
 * Qué insumos gasta UNA unidad de un perfume en una talla, y cuánto cuesta.
 *
 * La esencia sale del PERFUME (cada fragancia tiene la suya, con su costo); el
 * envase y los accesorios, de la receta de la talla. Si el perfume no tiene
 * esencia asignada devuelve null: no se descuenta nada y se lista aparte, que
 * es lo acordado — usar una esencia genérica descuadraría ese insumo y daría
 * un costo falso.
 */
export const recetaDe = async (perfumeId: number, ml: number | null) => {
  const [perfume, presentacion] = await Promise.all([
    prisma.perfume.findUnique({
      where: { id: perfumeId },
      select: {
        nombre: true, insumo_esencia_id: true,
        tipo_producto: true, insumo_producto_id: true, ml_utiles: true,
      },
    }),
    ml
      ? prisma.presentacion.findFirst({
          where: { ml },
          include: {
            formula: { include: { accesorios: true } },
            // Frasco y accesorios propios de ESTE perfume en ESTA talla
            perfumes: { where: { perfume_id: perfumeId } },
          },
        })
      : null,
  ]);
  if (!perfume) return null;

  // COMPRADO: no se fabrica, se revende. Sale UNA unidad del propio producto.
  if (perfume.tipo_producto === 'comprado') {
    if (!perfume.insumo_producto_id) return { sinEsencia: true, nombre: perfume.nombre, items: [] };
    return { sinEsencia: false, nombre: perfume.nombre, items: [{ insumo_id: perfume.insumo_producto_id, cantidad: 1 }] };
  }

  const formula = presentacion?.formula;

  // FRACCIONADO: sale el líquido de la botella original + el envase del decant.
  // Se descuenta lo NOMINAL del decant; la merma de trasvase se refleja en
  // `ml_utiles` al costear la botella, no aquí.
  if (perfume.tipo_producto === 'fraccionado') {
    // Sin talla no se sabe cuántos ml lleva el decant: no se descuenta.
    if (!perfume.insumo_producto_id || !ml) return { sinEsencia: true, nombre: perfume.nombre, items: [] };
    const items = [{ insumo_id: perfume.insumo_producto_id, cantidad: ml }];
    const envaseDecant = presentacion?.perfumes?.[0]?.envase_insumo_id ?? formula?.envase_insumo_id;
    if (envaseDecant) items.push({ insumo_id: envaseDecant, cantidad: 1 });
    return { sinEsencia: false, nombre: perfume.nombre, items };
  }

  // FABRICADO: la receta de la talla
  if (!formula) return null;
  if (!perfume.insumo_esencia_id) return { sinEsencia: true, nombre: perfume.nombre, items: [] };

  const porNombre = async (clave: string) => {
    const i = await prisma.insumoCosto.findFirst({
      where: { tipo: 'materia_prima', nombre: { contains: clave } },
    });
    return i?.id ?? null;
  };
  const total = num(formula.ml_total);
  const esen = num(formula.esencia_ml);
  const sell = num(formula.sellador_ml);
  const fero = num(formula.feromonas_ml);

  const items: { insumo_id: number; cantidad: number }[] = [];
  const add = (id: number | null | undefined, cant: number) => {
    if (id && cant > 0) items.push({ insumo_id: id, cantidad: r3(cant) });
  };
  add(perfume.insumo_esencia_id, esen);
  add(await porNombre('iluyente'), r3(total - esen - sell - fero));
  add(await porNombre('ellador'), sell);
  add(await porNombre('eromona'), fero);
  // El frasco y la caja de ESTA referencia mandan sobre los de la receta:
  // un 1.1 de Sauvage no usa el mismo frasco que uno de Bleu.
  const propio = presentacion?.perfumes?.[0];
  add(propio?.envase_insumo_id ?? formula.envase_insumo_id, 1);
  const accesoriosPropios = (propio?.accesorios as number[] | null) ?? null;
  if (accesoriosPropios?.length) accesoriosPropios.forEach((id) => add(id, 1));
  else formula.accesorios.forEach((a) => add(a.insumo_id, 1));
  return { sinEsencia: false, nombre: perfume.nombre, items };
};

/**
 * Descuenta del inventario lo que gastó una venta y devuelve lo que costó.
 *
 * Reglas acordadas con el dueño:
 *  - Se descuenta AL REGISTRAR la venta (el producto ya salió, aunque sea a crédito).
 *  - Si no alcanza el stock NO se bloquea: la venta ya ocurrió; el stock queda
 *    en negativo y la pestaña lo muestra en ámbar.
 *  - Línea sin talla o perfume sin esencia: no se descuenta y se reporta.
 */
export const consumirPorVenta = async (
  tx: Prisma.TransactionClient,
  ventaId: number,
  fecha: Date,
  lineas: { perfume_id: number; ml: number | null; cantidad: number }[],
) => {
  let costo = 0;
  const sinCostear: string[] = [];

  for (const l of lineas) {
    // Un producto COMPRADO (una gorra, un splash) no tiene talla y aun así se
    // descuenta: su costo es lo que se pagó por él.
    const receta = await recetaDe(l.perfume_id, l.ml);
    if (!receta) { sinCostear.push(l.ml ? `talla ${l.ml} ml sin receta` : 'producto sin talla'); continue; }
    if (receta.sinEsencia) { sinCostear.push(`${receta.nombre} (sin esencia asignada)`); continue; }

    for (const it of receta.items) {
      const res = await aplicarMovimiento(tx, {
        insumo_id: it.insumo_id,
        tipo: 'venta',
        cantidad: -r3(it.cantidad * l.cantidad),
        fecha,
        referencia_id: ventaId,
        nota: `Venta #${ventaId}`,
      });
      costo += res.costoAplicado * it.cantidad * l.cantidad;
    }
  }
  return { costo: Math.round(costo * 100) / 100, sinCostear: [...new Set(sinCostear)] };
};

/** Al editar o borrar una venta se devuelve al inventario lo que había salido. */
export const revertirVenta = (tx: Prisma.TransactionClient, ventaId: number) =>
  revertirMovimientos(tx, 'venta', ventaId);

/** Perfumes que ya se vendieron pero no tienen esencia asignada (para configurar). */
export const perfumesSinCostear = async () => {
  const rows = await prisma.perfume.findMany({
    where: {
      ventas: { some: {} },
      OR: [
        { tipo_producto: 'fabricado', insumo_esencia_id: null },
        { tipo_producto: { in: ['comprado', 'fraccionado'] }, insumo_producto_id: null },
      ],
    },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
    take: 100,
  });
  return rows;
};

/**
 * Progreso del arranque del inventario, para la lista de "Primeros pasos".
 *
 * Se deduce SIEMPRE de los datos reales, nunca de una bandera de "ya lo hizo":
 * una bandera mentiría el día que se cargue algo por Excel o se borre un
 * registro, y quien ya tiene su inventario andando nunca debe ver la lista.
 */
export const primerosPasos = async () => {
  // Solo los FABRICADOS necesitan esencia: una gorra o un splash comprado no
  // lleva receta. Contra el total de perfumes, el paso nunca se completaría.
  const fabricado = { tipo_producto: 'fabricado' as const };
  const [materiales, conteos, compras, faltanEsencia, fabricados] = await Promise.all([
    prisma.insumoCosto.count(),
    prisma.movimientoInventario.count({ where: { tipo: 'ajuste' } }),
    prisma.compraItem.count(),
    prisma.perfume.count({ where: { ...fabricado, insumo_esencia_id: null } }),
    prisma.perfume.count({ where: fabricado }),
  ]);
  return { materiales, conteos, compras, faltan_esencia: faltanEsencia, fabricados };
};
