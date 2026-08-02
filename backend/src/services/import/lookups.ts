import { prisma } from '../../config/prisma';
import { toStr } from './core';
import type { EntityImportResult } from './core';

/**
 * Catálogos simples de una sola columna (nombre): aromas, ocasiones,
 * categorías y presentaciones. Comparten exactamente la misma forma, así que
 * no hace falta una rama por cada uno.
 */
export const LOOKUP_DELEGATES: Record<string, () => any> = {
  aromas: () => prisma.tipoAroma,
  ocasiones: () => prisma.ocasion,
  categorias: () => prisma.categoria,
  presentaciones: () => prisma.presentacion,
};

export const exportarLookup = async (entity: string): Promise<Record<string, any>[] | null> => {
  const delegate = LOOKUP_DELEGATES[entity];
  if (!delegate) return null;
  const items = await delegate().findMany({ orderBy: { nombre: 'asc' } });
  return items.map((i: any) => ({ nombre: i.nombre }));
};

export const importarLookup = async (
  entity: string, rows: Record<string, any>[], result: EntityImportResult,
) => {
  const nombres = [...new Set(rows.map((r) => toStr(r['nombre'])).filter(Boolean))];
  // Los duplicados se omiten solos: reimportar la misma lista no rompe nada
  const created = await LOOKUP_DELEGATES[entity]().createMany({
    data: nombres.map((nombre) => ({ nombre })),
    skipDuplicates: true,
  });
  result.insertados = created.count;
  result.omitidos = nombres.length - created.count;
};
