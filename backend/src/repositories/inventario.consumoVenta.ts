import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { r3, r4 } from '../utils/redondeo';
import { aplicarMovimiento, revertirMovimientos } from './inventario.repository';
import { revertirTerminado, sacarDeTerminado } from './inventario.terminado';
import { idsDeMaterialesGenerales } from './materialesGenerales';

/** Los Decimal de Prisma llegan como objeto; esto los baja a número. */
const num = (v: unknown) => Number(v);

/**
 * QUÉ GASTA UNA VENTA.
 *
 * Salió de `inventario.repository.ts` por tamaño, pero también porque es una
 * pieza con nombre propio: ya tenía su archivo de pruebas
 * (`inventario.consumoVenta.bd.test.ts`) y su hermano al lado
 * (`inventario.terminado.ts`, lo que ya está armado). El libro mayor de
 * movimientos —que es de lo que este archivo se sirve— se quedó allá.
 */

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

  const total = num(formula.ml_total);
  const esen = num(formula.esencia_ml);
  const sell = num(formula.sellador_ml);
  const fero = num(formula.feromonas_ml);

  const items: { insumo_id: number; cantidad: number }[] = [];
  const add = (id: number | null | undefined, cant: number) => {
    if (id && cant > 0) items.push({ insumo_id: id, cantidad: r3(cant) });
  };
  add(perfume.insumo_esencia_id, esen);
  // El diluyente es el RESTO, no un ingrediente con su propia medida.
  const generales = await idsDeMaterialesGenerales();
  add(generales.diluyente, r3(total - esen - sell - fero));
  add(generales.sellador, sell);
  add(generales.feromonas, fero);
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
 *  - **Un 1.1 jamás se fabrica al vender** (ver `sacarDeTerminado`): sale de lo
 *    armado o queda en negativo, pero no toca materiales.
 *
 * `avisos` es lo que hay que ENSEÑARLE al dueño después de guardar. Antes esto
 * se devolvía y nadie lo leía, así que una venta que no descontó nada se veía
 * igual de bien que una normal.
 */
export const consumirPorVenta = (
  tx: Prisma.TransactionClient,
  ventaId: number,
  fecha: Date,
  lineas: { perfume_id: number; ml: number | null; cantidad: number }[],
) => descontarSalida(tx, { referenciaId: ventaId, fecha, lineas });

/**
 * EL MOTOR: producto que SALE, sea por una venta o por una garantía.
 *
 * Son la misma operación —un frasco se va— y solo cambia el porqué, así que
 * cambia el `tipo` del movimiento y nada más. Estaba escrito solo para ventas y
 * la reposición de una devolución habría acabado siendo una copia con otro
 * nombre; la copia se habría quedado atrás la primera vez que se tocara esta.
 */
export const descontarSalida = async (
  tx: Prisma.TransactionClient,
  opciones: {
    referenciaId: number;
    fecha: Date;
    lineas: { perfume_id: number; ml: number | null; cantidad: number }[];
    tipo?: 'venta' | 'garantia';
    /** Texto que queda en el historial del material ("Garantía #12"). */
    etiqueta?: string;
  },
) => {
  const { referenciaId, fecha, lineas } = opciones;
  const tipo = opciones.tipo ?? 'venta';
  const etiqueta = opciones.etiqueta ?? `Venta #${referenciaId}`;
  let costo = 0;
  const sinCostear: string[] = [];
  const avisos: string[] = [];

  for (const l of lineas) {
    /**
     * PRIMERO los frascos que ya están armados.
     *
     * Regla acordada con el dueño: lo que ya se armó no se vuelve a fabricar.
     * Su costo es el que tuvo el día que se armó (congelado), no el que tendría
     * la receta hoy — esa plata ya se gastó.
     */
    const armado = await sacarDeTerminado(tx, {
      perfume_id: l.perfume_id, ml: l.ml, cantidad: l.cantidad,
      ventaId: referenciaId, fecha, tipo, etiqueta,
    });
    costo += armado.costo;

    if (armado.faltaron > 0) {
      avisos.push(`Vendiste ${armado.faltaron} × ${armado.nombre} sin tenerlo armado:`
        + ' quedó en negativo y NO se descontó material (los 1.1 no se fabrican al vender).');
    }

    const porArmar = l.cantidad - armado.unidades;
    // Si lo armado cubrió la línea entera, no se toca ni un material.
    if (porArmar <= 0) continue;

    // Un 1.1 al que no se le pudo apuntar la talla: tampoco se fabrica. Sin
    // esto, la única puerta que quedaba abierta seguiría descontando su receta.
    if (armado.soloArmado) {
      avisos.push(`No se descontó nada por ${armado.nombre}: es un 1.1 y su talla no está`
        + ' en el catálogo, así que no se pudo apuntar a ningún frasco armado.');
      continue;
    }

    // Un producto COMPRADO (una gorra, un splash) no tiene talla y aun así se
    // descuenta: su costo es lo que se pagó por él.
    const receta = await recetaDe(l.perfume_id, l.ml);
    if (!receta) { sinCostear.push(l.ml ? `talla ${l.ml} ml sin receta` : 'producto sin talla'); continue; }
    if (receta.sinEsencia) { sinCostear.push(`${receta.nombre} (sin esencia asignada)`); continue; }

    for (const it of receta.items) {
      const res = await aplicarMovimiento(tx, {
        insumo_id: it.insumo_id,
        tipo,
        cantidad: -r3(it.cantidad * porArmar),
        fecha,
        referencia_id: referenciaId,
        nota: etiqueta,
      });
      costo += res.costoAplicado * it.cantidad * porArmar;
    }
  }
  return {
    costo: Math.round(costo * 100) / 100,
    sinCostear: [...new Set(sinCostear)],
    avisos: [...new Set(avisos)],
  };
};

/**
 * Al editar o borrar una venta se devuelve lo que había salido: los materiales
 * Y los frascos que estaban armados. Revertir solo una de las dos partes dejaría
 * el descuadre al revés.
 */
export const revertirVenta = async (tx: Prisma.TransactionClient, ventaId: number) => {
  await revertirMovimientos(tx, 'venta', ventaId);
  await revertirTerminado(tx, 'venta', ventaId);
};
