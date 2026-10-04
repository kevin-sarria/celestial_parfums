import type { MetaGanancia } from '@prisma/client';
import { prisma } from '../config/prisma';
import { badRequest } from '../utils/httpError';
import { mapPerfumePanel, perfumeInclude } from '../repositories/perfume.mapeo';
import { reglasDeEmpaque } from '../empaque/empaque.repository';
import { esBotellaCompleta } from '../utils/decants';
import { costoDeTalla } from './costoTalla';

/**
 * PRECIOS DE LOS ORIGINALES (dueño, 2026-10-04): cada talla con lo que cuesta
 * de verdad, su precio y la meta propia del perfume, para que la pantalla
 * sugiera. Diseño en `docs/superpowers/specs/2026-10-04-precios-originales-design.md`.
 */

const num = (v: unknown) => Number(v ?? 0);

/**
 * Lo que hace falta para costear tallas: el costo de cada material (frascos y
 * empaque) y las reglas de empaque. Lo usan la lista de originales y la ficha
 * del perfume, para que "te cuesta" sea UNA sola cuenta en toda la app.
 */
const contextoDeCosto = async (frascos: number[]) => {
  const reglas = await reglasDeEmpaque();
  const accesorios = await prisma.perfume.findMany({
    where: { id: { in: [...new Set(reglas.map((r) => r.perfume_id))] } },
    select: { id: true, insumo_producto_id: true },
  });
  const insumoDeAccesorio = new Map(accesorios.map((a) => [a.id, a.insumo_producto_id]));
  const ids = new Set(frascos);
  for (const id of insumoDeAccesorio.values()) if (id) ids.add(id);
  const costoInsumo = new Map((await prisma.insumoCosto.findMany({
    where: { id: { in: [...ids] } }, select: { id: true, precio: true },
  })).map((i) => [i.id, num(i.precio)]));
  const empaqueDe = (linea: 'decant' | 'botella_completa', presentacionId: number) => reglas
    .filter((r) => r.linea === linea && r.presentacion_id === (linea === 'botella_completa' ? null : presentacionId))
    .reduce((s, r) => s + r.cantidad * (costoInsumo.get(insumoDeAccesorio.get(r.perfume_id) ?? -1) ?? 0), 0);
  return {
    costo: (t: { presentacion_id: number; ml: number; frasco: number | null }, mlBotella: number | null, costoMl: number) =>
      costoDeTalla({
        ml: t.ml, mlBotella, costoMl,
        frasco: t.frasco ? costoInsumo.get(t.frasco) ?? 0 : 0,
        empaque: empaqueDe(esBotellaCompleta(t.ml, mlBotella) ? 'botella_completa' : 'decant', t.presentacion_id),
      }),
  };
};

export const listarOriginales = async () => {
  const filas = await prisma.perfume.findMany({
    where: { tipo_producto: 'fraccionado' },
    include: perfumeInclude,
    orderBy: { nombre: 'asc' },
  });
  const frascoDe = (r: (typeof filas)[number]['presentaciones'][number]) =>
    r.envase_insumo_id ?? r.presentacion.formula?.envase_insumo_id ?? null;
  const ctx = await contextoDeCosto(filas.flatMap((f) => f.presentaciones.map(frascoDe).filter((x): x is number => x != null)));

  return filas.map((f) => {
    const p = mapPerfumePanel(f);
    const mlBotella = f.insumo_producto?.ml_botella ?? null;
    const costoMl = num(f.insumo_producto?.precio);
    return {
      id: f.id,
      nombre: f.nombre,
      publicado: f.publicado,
      ml_botella: mlBotella,
      meta: f.meta_ganancia_tipo ? { tipo: f.meta_ganancia_tipo, valor: num(f.meta_ganancia_valor) } : null,
      tallas: f.presentaciones.filter((r) => r.presentacion.ml != null).map((r) => {
        const ml = r.presentacion.ml!;
        const t = p.precios.find((x) => x.presentacion_id === r.presentacion_id);
        return {
          presentacion_id: r.presentacion_id,
          nombre: r.presentacion.nombre,
          ml,
          botella_completa: !!t?.botella_completa,
          costo: ctx.costo({ presentacion_id: r.presentacion_id, ml, frasco: frascoDe(r) }, mlBotella, costoMl),
          /** Lo que cobra hoy (0 = no tiene precio y la tienda la esconde). */
          precio: t?.precio ?? 0,
          propio: r.precio != null,
        };
      }),
    };
  });
};

/**
 * El costo de unas tallas que todavía se están editando en la ficha de un
 * original (botella elegida, frasco por talla aún sin guardar). Misma cuenta
 * que la lista: la ficha ya no la repite en la pantalla.
 */
export const costosDeFicha = async (
  insumoProductoId: number,
  tallas: { presentacion_id: number; envase_insumo_id: number | null }[],
) => {
  const [botella, presentaciones] = await Promise.all([
    prisma.insumoCosto.findUnique({ where: { id: insumoProductoId }, select: { precio: true, ml_botella: true } }),
    prisma.presentacion.findMany({
      where: { id: { in: tallas.map((t) => t.presentacion_id) } },
      select: { id: true, ml: true, formula: { select: { envase_insumo_id: true } } },
    }),
  ]);
  if (!botella) throw badRequest('Esa botella ya no existe');
  const conTalla = tallas.flatMap((t) => {
    const pr = presentaciones.find((x) => x.id === t.presentacion_id);
    return pr?.ml != null ? [{ presentacion_id: t.presentacion_id, ml: pr.ml, frasco: t.envase_insumo_id ?? pr.formula?.envase_insumo_id ?? null }] : [];
  });
  const ctx = await contextoDeCosto(conTalla.map((t) => t.frasco).filter((x): x is number => x != null));
  return conTalla.map((t) => ({ presentacion_id: t.presentacion_id, costo: ctx.costo(t, botella.ml_botella, num(botella.precio)) }));
};

/** La meta propia de un original; `null` = vuelve a la general de la pantalla. */
export const ponerMeta = async (id: number, meta: { tipo: MetaGanancia; valor: number } | null) => {
  const p = await prisma.perfume.findUnique({ where: { id }, select: { tipo_producto: true } });
  if (!p) throw badRequest('Ese perfume ya no existe');
  if (p.tipo_producto !== 'fraccionado') throw badRequest('La meta propia es solo para originales');
  if (meta?.tipo === 'porcentaje' && !(meta.valor >= 1 && meta.valor <= 90)) {
    throw badRequest('La ganancia en porcentaje va de 1 a 90');
  }
  await prisma.perfume.update({
    where: { id },
    data: { meta_ganancia_tipo: meta?.tipo ?? null, meta_ganancia_valor: meta?.valor ?? null },
  });
};

/**
 * Escribe el precio PROPIO de cada talla. Solo tallas que el perfume ya
 * vende: un precio no agrega una talla nueva (eso es de la ficha).
 */
export const aplicarPrecios = async (precios: { perfume_id: number; presentacion_id: number; precio: number }[]) => {
  const ids = [...new Set(precios.map((x) => x.perfume_id))];
  const originales = await prisma.perfume.count({ where: { id: { in: ids }, tipo_producto: 'fraccionado' } });
  if (originales !== ids.length) throw badRequest('Aquí solo se les pone precio a los originales');
  const cambios = await prisma.$transaction(precios.map((x) => prisma.perfumePresentacion.updateMany({
    where: { perfume_id: x.perfume_id, presentacion_id: x.presentacion_id },
    data: { precio: x.precio },
  })));
  return cambios.reduce((s, c) => s + c.count, 0);
};
