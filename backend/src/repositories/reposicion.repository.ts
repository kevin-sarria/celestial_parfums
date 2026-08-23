import type { MovimientoTipo } from '@prisma/client';
import { prisma } from '../config/prisma';

/**
 * Pedido sugerido: qué material hay que reponer y cuánto pedir.
 *
 * Es una pantalla **solo informativa** — no mueve stock ni registra nada. Sale
 * de tres datos que ya existen: lo que hay, el punto de pedido y lo que se ha
 * consumido de verdad.
 *
 * El punto de pedido se configura **por gama** (una vez para las 151 árabes) y
 * cada esencia puede tener su excepción. Sin eso la alerta era inservible en la
 * práctica: se midió y solo 1 de 226 materiales tenía mínimo puesto, porque
 * ponerlo a mano en 219 esencias no lo hace nadie.
 */

const num = (v: unknown) => Number(v);
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Ventana de historial con la que se estima el consumo diario. */
const DIAS_HISTORIAL = 90;
/** Para cuántos días de venta se pide, cuando hay consumo con el que calcular. */
const DIAS_COBERTURA = 60;

/**
 * Movimientos que cuentan como CONSUMO real.
 *
 * `ajuste` queda FUERA a propósito. Es el conteo físico, y ahí caben dos cosas
 * que no son demanda: el stock inicial que se siembra al arrancar (hoy son 222
 * movimientos que meterían un número enorme) y el desperdicio del día a día,
 * que ya se absorbe al contar. Proyectar eso como si fueran ventas haría pedir
 * de más justo el primer mes.
 */
/**
 * Los movimientos que CUENTAN como consumo. Escribirlo como `MovimientoTipo[]`
 * y no como texto suelto es lo que hace que un tipo mal escrito —o uno que
 * mañana se renombre en el esquema— no compile, en vez de colarse y estimar el
 * consumo de menos sin que nadie lo note.
 */
const TIPOS_CONSUMO: MovimientoTipo[] = ['venta', 'produccion', 'muestra', 'merma', 'garantia'];

export interface FilaReposicion {
  id: number;
  nombre: string;
  tipo: string;
  unidad: string;
  gama: string | null;
  stock: number;
  minimo: number;
  /** true = el mínimo lo pone su gama, no es propio. */
  minimo_heredado: boolean;
  /** Cuánto se ha consumido al día, en promedio, en los últimos 90 días. */
  consumo_diario: number;
  /** Cuánto pedir. */
  sugerido: number;
  /** De dónde sale el sugerido, para poder explicarlo en pantalla. */
  base: 'consumo' | 'minimo';
  costo_promedio: number;
  /** Lo que costaría reponerlo al costo promedio de hoy. */
  costo_estimado: number;
}

export interface Reposicion {
  esencias: FilaReposicion[];
  implementos: FilaReposicion[];
  /** true = todavía no hay salidas registradas con las que estimar consumo. */
  sin_historial: boolean;
  dias_historial: number;
  dias_cobertura: number;
  costo_total: number;
}

export const calcularReposicion = async (): Promise<Reposicion> => {
  const desde = new Date();
  desde.setDate(desde.getDate() - DIAS_HISTORIAL);

  const [insumos, salidas] = await Promise.all([
    prisma.insumoCosto.findMany({
      where: { activo: true },
      include: { gama: true },
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
    }),
    prisma.movimientoInventario.groupBy({
      by: ['insumo_id'],
      where: { tipo: { in: TIPOS_CONSUMO }, fecha: { gte: desde } },
      _sum: { cantidad: true },
    }),
  ]);

  // Las salidas van en negativo: se le da la vuelta para leerlo como consumo
  const consumoPorInsumo = new Map(
    salidas.map((s) => [s.insumo_id, Math.max(0, -num(s._sum.cantidad))]),
  );

  const filas: FilaReposicion[] = [];
  for (const i of insumos) {
    const stock = num(i.stock);
    // El mínimo propio MANDA sobre el de la gama; null = "usa el de mi gama"
    const propio = i.stock_minimo != null;
    const minimo = propio ? num(i.stock_minimo) : num(i.gama?.stock_minimo ?? 0);
    const consumoDiario = r3((consumoPorInsumo.get(i.id) ?? 0) / DIAS_HISTORIAL);

    // Sin mínimo configurado no se alerta: no todo material lo necesita, y
    // avisar de todo es lo mismo que no avisar de nada.
    if (minimo <= 0 || stock > minimo) continue;

    /**
     * Cuánto pedir. Con consumo medido se pide para cubrir los próximos
     * DIAS_COBERTURA días; sin él, se vuelve al doble del mínimo, que es el
     * colchón que ya usaba la lista de compras de Inventario.
     */
    const porConsumo = consumoDiario > 0
      ? r3(consumoDiario * DIAS_COBERTURA - stock)
      : 0;
    const porMinimo = r3(minimo * 2 - stock);
    const sugerido = Math.max(0, porConsumo > porMinimo ? porConsumo : porMinimo);
    const precio = num(i.precio);

    filas.push({
      id: i.id,
      nombre: i.nombre,
      tipo: i.tipo,
      unidad: i.unidad,
      gama: i.gama?.nombre ?? null,
      stock,
      minimo,
      minimo_heredado: !propio && i.gama != null,
      consumo_diario: consumoDiario,
      sugerido,
      base: porConsumo > porMinimo ? 'consumo' : 'minimo',
      costo_promedio: precio,
      costo_estimado: Math.round(sugerido * precio),
    });
  }

  // Las esencias van aparte de todo lo demás: se piden a otro proveedor y se
  // deciden con otra cabeza (la gama manda), así que mezclarlas estorba.
  const esencias = filas.filter((f) => f.gama != null);
  const implementos = filas.filter((f) => f.gama == null);

  return {
    esencias,
    implementos,
    sin_historial: consumoPorInsumo.size === 0,
    dias_historial: DIAS_HISTORIAL,
    dias_cobertura: DIAS_COBERTURA,
    costo_total: filas.reduce((s, f) => s + f.costo_estimado, 0),
  };
};

/**
 * Cambia SOLO el punto de pedido de un material, sin tocar existencias.
 *
 * Hasta ahora el mínimo se ponía desde el modal de Ajustar, que es un conteo
 * físico y deja su movimiento. Corregir un mínimo no es contar: no debe
 * ensuciar el libro de inventario con un movimiento que no ocurrió.
 *
 * `null` lo devuelve a heredar el de su gama.
 */
export const fijarMinimoInsumo = (id: number, minimo: number | null) =>
  prisma.insumoCosto.update({
    where: { id },
    data: { stock_minimo: minimo },
    select: { id: true, nombre: true, stock_minimo: true },
  });

/** Punto de pedido por defecto de todas las esencias de una gama. */
export const fijarMinimoGama = (id: number, minimo: number) =>
  prisma.gamaEsencia.update({
    where: { id },
    data: { stock_minimo: minimo },
    select: { id: true, nombre: true, stock_minimo: true },
  });

/**
 * Guarda los puntos de pedido de varias gamas **y devuelve la lista ya
 * recalculada**.
 *
 * Las dos mitades van juntas por una razón de fondo: cambiar un mínimo no
 * cambia una casilla, **cambia la pantalla entera** — qué materiales están bajo
 * mínimo, cuánto pedir de cada uno y cuánto costará el pedido. Ese cálculo no
 * se puede rehacer en el navegador porque necesita el consumo de los últimos 90
 * días, que vive aquí.
 *
 * Devolviéndola en la misma respuesta, guardar cuesta **un solo viaje** en vez
 * de uno por gama más otro para volver a pedir la lista.
 *
 * Va en transacción: si una gama falla, no se guarda ninguna. Cuatro casillas
 * de un mismo formulario no pueden quedar a medio guardar.
 */
export const fijarMinimosGamas = async (minimos: { id: number; minimo: number }[]) => {
  await prisma.$transaction(
    minimos.map(({ id, minimo }) => prisma.gamaEsencia.update({
      where: { id },
      data: { stock_minimo: minimo },
    })),
  );
  return calcularReposicion();
};
