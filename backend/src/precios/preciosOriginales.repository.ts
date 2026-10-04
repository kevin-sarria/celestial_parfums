import type { MetaGanancia } from '@prisma/client';
import { prisma } from '../config/prisma';
import { badRequest } from '../utils/httpError';
import { mapPerfumePanel, perfumeInclude } from '../repositories/perfume.mapeo';
import { reglasDeEmpaque } from '../empaque/empaque.repository';
import { costoDeTalla } from './costoTalla';

/**
 * PRECIOS DE LOS ORIGINALES (dueño, 2026-10-04): cada talla con lo que cuesta
 * de verdad, su precio y la meta propia del perfume, para que la pantalla
 * sugiera. Diseño en `docs/superpowers/specs/2026-10-04-precios-originales-design.md`.
 */

const num = (v: unknown) => Number(v ?? 0);

export const listarOriginales = async () => {
  const [filas, reglas] = await Promise.all([
    prisma.perfume.findMany({
      where: { tipo_producto: 'fraccionado' },
      include: perfumeInclude,
      orderBy: { nombre: 'asc' },
    }),
    reglasDeEmpaque(),
  ]);

  // Lo que cuesta cada material que entra en la cuenta: frascos y empaque
  const accesorios = await prisma.perfume.findMany({
    where: { id: { in: [...new Set(reglas.map((r) => r.perfume_id))] } },
    select: { id: true, insumo_producto_id: true },
  });
  const insumoDeAccesorio = new Map(accesorios.map((a) => [a.id, a.insumo_producto_id]));
  const idsInsumo = new Set<number>();
  for (const f of filas) {
    for (const r of f.presentaciones) {
      const frasco = r.envase_insumo_id ?? r.presentacion.formula?.envase_insumo_id;
      if (frasco) idsInsumo.add(frasco);
    }
  }
  for (const id of insumoDeAccesorio.values()) if (id) idsInsumo.add(id);
  const costoInsumo = new Map((await prisma.insumoCosto.findMany({
    where: { id: { in: [...idsInsumo] } }, select: { id: true, precio: true },
  })).map((i) => [i.id, num(i.precio)]));

  const empaqueDe = (linea: 'decant' | 'botella_completa', presentacionId: number | null) => reglas
    .filter((r) => r.linea === linea && r.presentacion_id === (linea === 'botella_completa' ? null : presentacionId))
    .reduce((s, r) => s + r.cantidad * (costoInsumo.get(insumoDeAccesorio.get(r.perfume_id) ?? -1) ?? 0), 0);

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
        const botellaCompleta = !!t?.botella_completa;
        const frasco = r.envase_insumo_id ?? r.presentacion.formula?.envase_insumo_id;
        return {
          presentacion_id: r.presentacion_id,
          nombre: r.presentacion.nombre,
          ml,
          botella_completa: botellaCompleta,
          costo: costoDeTalla({
            ml, mlBotella, costoMl,
            frasco: frasco ? costoInsumo.get(frasco) ?? 0 : 0,
            empaque: empaqueDe(botellaCompleta ? 'botella_completa' : 'decant', r.presentacion_id),
          }),
          /** Lo que cobra hoy (0 = no tiene precio y la tienda la esconde). */
          precio: t?.precio ?? 0,
          propio: r.precio != null,
        };
      }),
    };
  });
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
