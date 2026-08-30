import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

/**
 * LOS TRES MATERIALES QUE NO SON DE NADIE: diluyente, sellador y feromonas.
 *
 * Cada fragancia tiene SU esencia enlazada por id, pero estos tres los comparten
 * todas y no cuelgan de ninguna receta: se buscan por el nombre. Es frágil a
 * propósito —el dueño los escribe como quiera— y por eso se busca por un trozo
 * sin tilde ni mayúscula inicial ("iluyente", "ellador", "eromona").
 *
 * Vive aquí, y no copiado en cada sitio que lo necesita, porque lo usan la venta
 * (`recetaDe`) y la maceración: dos copias de esta búsqueda acabarían buscando
 * cosas distintas el día que alguien afine una.
 */

/** Trozo de nombre por el que se reconoce cada uno. */
export const CLAVES = { diluyente: 'iluyente', sellador: 'ellador', feromonas: 'eromona' } as const;

export type MaterialGeneral = keyof typeof CLAVES;

const buscar = async (cli: Prisma.TransactionClient | typeof prisma, clave: string) => {
  const i = await cli.insumoCosto.findFirst({
    where: { tipo: 'materia_prima', nombre: { contains: clave } },
    select: { id: true },
  });
  return i?.id ?? null;
};

/** El id de uno de los tres, o null si el dueño todavía no lo tiene cargado. */
export const idDeMaterial = (
  cual: MaterialGeneral, cli: Prisma.TransactionClient | typeof prisma = prisma,
) => buscar(cli, CLAVES[cual]);

/** Los tres de una vez, para quien los necesita juntos (macerar). */
export const idsDeMaterialesGenerales = async (
  cli: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<Record<MaterialGeneral, number | null>> => {
  const [diluyente, sellador, feromonas] = await Promise.all([
    buscar(cli, CLAVES.diluyente), buscar(cli, CLAVES.sellador), buscar(cli, CLAVES.feromonas),
  ]);
  return { diluyente, sellador, feromonas };
};
