import { prisma } from '../config/prisma';
import { badRequest } from '../utils/httpError';
import { mapPerfumePanel, perfumeInclude } from './perfume.mapeo';

/**
 * ESTAR O NO EN LA TIENDA.
 *
 * Salió de `perfume.repository.ts` al pasar las 500 líneas, cuando publicar dejó
 * de ser un simple interruptor y empezó a tener una regla propia.
 */

/**
 * Saca un perfume de la tienda o lo devuelve, sin borrar nada.
 *
 * Basta con que UNA talla tenga precio. Las que siguen en $0 no bloquean: la
 * tienda las esconde hasta que tengan precio (`mapPerfume`, opción B del
 * dueño, 2026-10-02). Antes (2026-09-29) se exigían todas, y un original con
 * su botella ya puesta no salía mientras faltara un decant. Lo que sí se frena
 * es publicar algo sin NINGÚN precio: saldría en $0 o como ficha sin tallas.
 * Sacarlo de la tienda nunca se bloquea.
 */
export const patchPublicadoPerfume = async (id: string, publicado: boolean) => {
  if (publicado) {
    const row = await prisma.perfume.findUnique({ where: { id: Number(id) }, include: perfumeInclude });
    const p = row ? mapPerfumePanel(row) : null;
    const conPrecio = p?.precios.length ? p.precios.some((t) => t.precio > 0) : (p?.precio ?? 0) > 0;
    if (p && !conPrecio) throw badRequest('Ponle precio al menos a una talla antes de publicarlo: saldría en $0.');
  }
  return prisma.perfume.update({ where: { id: Number(id) }, data: { publicado } });
};

/**
 * Lo que hace falta para el aviso de "perfumes por revisar" del dashboard.
 *
 * `sin_esencia` cuenta los FABRICADOS sin esencia asignada: esos no descuentan
 * inventario al venderse y su costo entra en cero, así que la ganancia del mes
 * sale inflada. Se cuentan solo los que siguen publicados, que son los que de
 * verdad pueden venderse hoy.
 */
export const resumenPublicacion = async () => {
  const [ocultos, sinEsencia] = await Promise.all([
    prisma.perfume.count({ where: { publicado: false } }),
    prisma.perfume.count({
      where: { publicado: true, tipo_producto: 'fabricado', insumo_esencia_id: null },
    }),
  ]);
  return { ocultos, sin_esencia: sinEsencia };
};
