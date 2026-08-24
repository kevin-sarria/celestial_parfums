import { prisma } from '../config/prisma';
import { SOLO_PUBLICADOS, WHERE_FAMILIA } from './perfume.repository';

/**
 * Los contadores del arranque de la pestaña Productos.
 *
 * Todo se CUENTA contra la base, nada se guarda: quien ya tiene sus productos
 * cargados no ve la lista nunca, y el día que borre uno la lista reaparece
 * sola diciendo la verdad. Ver la skill `arranque-guiado`.
 *
 * Vive en su propio archivo (y no al final de `perfume.repository.ts`) porque
 * ese archivo ya está en ~500 líneas: agregarle más lo habría roto la misma
 * regla que este contador ayuda a respetar en Productos.
 */
export interface PrimerosPasosProductos {
  accesorios_sin_ficha: number;
  lotes_sin_ficha_propia: number;
  productos: number;
  productos_publicados: number;
  con_ficha_accesorio: number;
  con_ficha_armado: number;
}

export const primerosPasosProductos = async (): Promise<PrimerosPasosProductos> => {
  const [insumosAccesorio, conFichaAccesorio, conFichaArmado, productos, publicados, lotes] =
    await Promise.all([
      prisma.insumoCosto.findMany({ where: { tipo: 'accesorio' }, select: { id: true } }),
      prisma.perfume.count({ where: { es_accesorio: true } }),
      prisma.perfume.count({ where: { solo_armado: true } }),
      prisma.perfume.count({ where: WHERE_FAMILIA.productos }),
      prisma.perfume.count({ where: { AND: [WHERE_FAMILIA.productos, SOLO_PUBLICADOS] } }),
      prisma.produccion.count(),
    ]);

  const enlazados = await prisma.perfume.findMany({
    where: { insumo_producto_id: { in: insumosAccesorio.map((i) => i.id) } },
    select: { insumo_producto_id: true },
  });
  const yaTienen = new Set(enlazados.map((p) => p.insumo_producto_id));

  return {
    accesorios_sin_ficha: insumosAccesorio.filter((i) => !yaTienen.has(i.id)).length,
    // APROXIMADO A PROPÓSITO: mientras NINGUNA ficha tenga `solo_armado`, no hay
    // forma de saber qué lote de producción pertenece a un producto propio (esa
    // trazabilidad lote→ficha llega en una ola posterior), así que se asume que
    // TODOS los lotes existentes están "huérfanos". En cuanto exista al menos una
    // ficha `solo_armado`, el contador baja a 0 de golpe (no se puede afinar más
    // sin esa trazabilidad). Solo alimenta un texto de ayuda, nunca una cifra de
    // plata: no lo mejores sin antes construir el enlace lote↔ficha.
    lotes_sin_ficha_propia: conFichaArmado === 0 ? lotes : 0,
    productos,
    productos_publicados: publicados,
    con_ficha_accesorio: conFichaAccesorio,
    con_ficha_armado: conFichaArmado,
  };
};
