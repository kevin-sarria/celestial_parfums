import type { Prisma } from '@prisma/client';
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
  enPerfumes: number;
  enTallas: number;
  total: number;
}

export const contarUsos = async (id: number, cli: Cliente = prisma): Promise<UsosDeInsumo> => {
  const [movimientos, compras, comoEnvase, comoEsencia, enPerfumes, enTallas] =
    await Promise.all([
      cli.movimientoInventario.count({ where: { insumo_id: id } }),
      cli.compraItem.count({ where: { insumo_id: id } }),
      cli.formulaVolumen.count({ where: { envase_insumo_id: id } }),
      cli.formulaVolumen.count({ where: { esencia_insumo_id: id } }),
      cli.perfume.count({ where: { OR: [{ insumo_esencia_id: id }, { insumo_producto_id: id }] } }),
      cli.perfumePresentacion.count({ where: { envase_insumo_id: id } }),
    ]);

  const usos = {
    movimientos,
    compras,
    comoEnvase,
    comoEsencia,
    enPerfumes,
    enTallas,
  };
  return { ...usos, total: Object.values(usos).reduce((s, n) => s + n, 0) };
};

/** Lo que retiene a un insumo, dicho en el idioma del dueño. Vacío = se puede borrar. */
export const motivosQueRetienen = (u: UsosDeInsumo): string[] => {
  const motivos: string[] = [];
  if (u.movimientos > 0) motivos.push(`tiene ${u.movimientos} movimiento(s) de inventario`);
  if (u.compras > 0) motivos.push(`aparece en ${u.compras} compra(s)`);
  if (u.comoEnvase + u.comoEsencia > 0) motivos.push('lo usa la receta de algún tamaño');
  if (u.enPerfumes > 0) motivos.push(`${u.enPerfumes} perfume(s) lo tienen asignado`);
  if (u.enTallas > 0) motivos.push('alguna talla lo lleva');
  return motivos;
};
