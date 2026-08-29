import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

/**
 * DE DÓNDE CUELGA UN MATERIAL.
 *
 * Una sola lista, dos usos: el borrado la mira para decir qué lo retiene, y la
 * fusión la mira para saber qué tiene que mudar. Estaba escrita solo dentro de
 * `eliminarInsumo`; al aparecer la fusión se sacó aquí, porque dos copias de
 * "dónde puede estar un insumo" se desincronizan el día que se agregue una
 * tabla nueva — y lo que caiga en el hueco se borraría en silencio.
 */

type Cliente = Prisma.TransactionClient | typeof prisma;

export interface UsosDeInsumo {
  movimientos: number;
  compras: number;
  comoEnvase: number;
  comoEsencia: number;
  enAccesorios: number;
  enPerfumes: number;
  enTallas: number;
  /** Tallas que lo llevan dentro de su lista de accesorios (columna JSON). */
  enListasDeAccesorios: number;
  total: number;
}

/**
 * Las tallas que llevan este insumo DENTRO de su columna JSON `accesorios`.
 *
 * Se filtra en memoria y no con `JSON_CONTAINS`: el SQL de JSON no se escribe
 * igual en MySQL que en MariaDB (`CAST(… AS JSON)` no existe en MariaDB), y
 * esto corre en las dos. Son unos cientos de filas de tres columnas, en una
 * operación de administración que se hace de tarde en tarde.
 */
export const tallasConAccesorio = async (id: number, cli: Cliente = prisma) => {
  const filas = await cli.perfumePresentacion.findMany({
    select: { perfume_id: true, presentacion_id: true, accesorios: true },
  });
  return filas.filter((f) => idsDeJson(f.accesorios).includes(id));
};

/** Lo que no sea número se descarta: la columna es JSON y puede traer cualquier cosa. */
export const idsDeJson = (v: Prisma.JsonValue): number[] =>
  (Array.isArray(v) ? v : []).filter((x): x is number => typeof x === 'number');

export const contarUsos = async (id: number, cli: Cliente = prisma): Promise<UsosDeInsumo> => {
  const [movimientos, compras, comoEnvase, comoEsencia, enAccesorios, enPerfumes, enTallas, listas] =
    await Promise.all([
      cli.movimientoInventario.count({ where: { insumo_id: id } }),
      cli.compraItem.count({ where: { insumo_id: id } }),
      cli.formulaVolumen.count({ where: { envase_insumo_id: id } }),
      cli.formulaVolumen.count({ where: { esencia_insumo_id: id } }),
      cli.formulaAccesorio.count({ where: { insumo_id: id } }),
      cli.perfume.count({ where: { OR: [{ insumo_esencia_id: id }, { insumo_producto_id: id }] } }),
      cli.perfumePresentacion.count({ where: { envase_insumo_id: id } }),
      tallasConAccesorio(id, cli),
    ]);

  const usos = {
    movimientos,
    compras,
    comoEnvase,
    comoEsencia,
    enAccesorios,
    enPerfumes,
    enTallas,
    enListasDeAccesorios: listas.length,
  };
  return { ...usos, total: Object.values(usos).reduce((s, n) => s + n, 0) };
};

/** Lo que retiene a un insumo, dicho en el idioma del dueño. Vacío = se puede borrar. */
export const motivosQueRetienen = (u: UsosDeInsumo): string[] => {
  const motivos: string[] = [];
  if (u.movimientos > 0) motivos.push(`tiene ${u.movimientos} movimiento(s) de inventario`);
  if (u.compras > 0) motivos.push(`aparece en ${u.compras} compra(s)`);
  if (u.comoEnvase + u.comoEsencia + u.enAccesorios > 0) motivos.push('lo usa la receta de algún tamaño');
  if (u.enPerfumes > 0) motivos.push(`${u.enPerfumes} perfume(s) lo tienen asignado`);
  if (u.enTallas + u.enListasDeAccesorios > 0) motivos.push('alguna talla lo lleva');
  return motivos;
};
