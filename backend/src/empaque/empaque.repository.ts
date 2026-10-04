import type { LineaEmpaque } from '@prisma/client';
import { prisma } from '../config/prisma';
import { badRequest } from '../utils/httpError';
import {
  cargarPedido, detectarCombosServidor, unidadesDelPedido, tallaYPrecio, type PedidoCargado,
} from '../permisos/precioPedido';
import { empaqueDelPedido, type ReglaEmpaque, type UnidadPedido } from './empaqueDelPedido';
import { lineaEmpaqueDe } from './lineaEmpaque';

/**
 * EL EMPAQUE POR LÍNEA Y TALLA, en la base (dueño, 2026-10-04). Ver
 * `empaqueDelPedido.ts` para la cuenta y la tabla `empaque_linea`.
 */

/** Las reglas como las usa la cuenta. */
export const reglasDeEmpaque = async (): Promise<ReglaEmpaque[]> =>
  (await prisma.empaqueLinea.findMany({ orderBy: { id: 'asc' } }))
    .map((r) => ({ linea: r.linea, presentacion_id: r.presentacion_id, perfume_id: r.perfume_id, cantidad: r.cantidad }));

/**
 * Todo lo que necesita la pantalla Empaque y el formulario de venta: las
 * reglas, los accesorios que se pueden elegir y las tallas.
 */
export const leerEmpaque = async () => {
  const [reglas, accesorios, tallas] = await Promise.all([
    reglasDeEmpaque(),
    prisma.perfume.findMany({ where: { es_accesorio: true }, select: { id: true, nombre: true, publicado: true }, orderBy: { nombre: 'asc' } }),
    prisma.presentacion.findMany({ select: { id: true, nombre: true, ml: true }, orderBy: [{ ml: 'asc' }, { nombre: 'asc' }] }),
  ]);
  return { reglas, accesorios, tallas };
};

/**
 * Reemplaza el empaque de UNA línea entera de una vez (lo que la pantalla
 * guarda). Se valida que cada producto sea un accesorio: un perfume como
 * "empaque" se regalaría en cada venta sin que nadie lo notara.
 */
export const guardarEmpaqueDeLinea = async (
  linea: LineaEmpaque,
  filas: { presentacion_id: number | null; perfume_id: number; cantidad: number }[],
) => {
  const ids = [...new Set(filas.map((f) => f.perfume_id))];
  const accesorios = await prisma.perfume.count({ where: { id: { in: ids }, es_accesorio: true } });
  if (accesorios !== ids.length) throw badRequest('Solo se pueden poner accesorios en el empaque');
  if (linea !== 'botella_completa' && filas.some((f) => f.presentacion_id == null)) {
    throw badRequest('Falta la talla');
  }
  // Una sola fila por talla y accesorio: si viene repetido, se suma
  const unicas = new Map<string, { presentacion_id: number | null; perfume_id: number; cantidad: number }>();
  for (const f of filas) {
    const presentacion_id = linea === 'botella_completa' ? null : f.presentacion_id;
    const k = `${presentacion_id}|${f.perfume_id}`;
    const previa = unicas.get(k);
    unicas.set(k, { presentacion_id, perfume_id: f.perfume_id, cantidad: (previa?.cantidad ?? 0) + f.cantidad });
  }
  await prisma.$transaction([
    prisma.empaqueLinea.deleteMany({ where: { linea } }),
    prisma.empaqueLinea.createMany({ data: [...unicas.values()].filter((f) => f.cantidad > 0).map((f) => ({ linea, ...f })) }),
  ]);
  return leerEmpaque();
};

/**
 * Lo que le toca de empaque a un pedido, con la misma detección de combos que
 * el precio. Las unidades regaladas no arman combo ni llevan empaque (igual
 * que en el panel: `itemsDeLineas` usa las cobradas).
 */
export const empaqueParaPedido = async (
  lineas: { perfume_id: number; ml: number | null; cantidad: number; regalo: number }[],
  cargado?: PedidoCargado,
) => {
  const pedido = cargado ?? await cargarPedido(lineas);
  const cobradas = lineas.map((l) => ({ perfume_id: l.perfume_id, ml: l.ml, cantidad: Math.max(0, l.cantidad - l.regalo) }));
  const { enCombo, armados } = detectarCombosServidor(unidadesDelPedido(cobradas, pedido), pedido.combos);

  const unidades: UnidadPedido[] = cobradas.map((l, i) => {
    const p = pedido.porId.get(l.perfume_id);
    const { talla } = p ? tallaYPrecio(p, l.ml) : { talla: undefined };
    return {
      linea: p ? lineaEmpaqueDe(p.linea, !!talla?.botella_completa) : null,
      presentacion_id: talla?.presentacion_id ?? null,
      cantidad: l.cantidad,
      enCombo: enCombo.get(i) ?? 0,
    };
  });
  const kits = armados.map((a) => ({ ...a, kit: pedido.combos.find((c) => c.id === a.comboId)?.kit ?? [] }));
  return empaqueDelPedido(unidades, kits, await reglasDeEmpaque());
};

/**
 * Lo que la tienda le dice al cliente bajo cada talla: "Incluye bolsa de
 * organza y perfumero" (opción A del dueño, 2026-10-04). Sale del MISMO dato
 * que se regala al vender, así que no puede prometer algo que no se entrega.
 */
export const conIncluye = async <T extends {
  linea: Parameters<typeof lineaEmpaqueDe>[0];
  precios: { presentacion_id: number; botella_completa: boolean }[];
}>(perfume: T) => {
  const reglas = await reglasDeEmpaque();
  const ids = [...new Set(reglas.map((r) => r.perfume_id))];
  const nombres = new Map((await prisma.perfume.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true } }))
    .map((p) => [p.id, p.nombre]));
  return {
    ...perfume,
    precios: perfume.precios.map((t) => {
      const linea = lineaEmpaqueDe(perfume.linea, t.botella_completa);
      const talla = linea === 'botella_completa' ? null : t.presentacion_id;
      const incluye = reglas
        .filter((r) => r.linea === linea && r.presentacion_id === talla)
        .map((r) => ({ nombre: nombres.get(r.perfume_id) ?? '', cantidad: r.cantidad }))
        .filter((i) => i.nombre);
      return { ...t, incluye };
    }),
  };
};
