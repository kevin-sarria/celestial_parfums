import { prisma } from '../config/prisma';
import { badRequest } from '../utils/httpError';
import { mapPerfume, perfumeInclude } from './perfume.mapeo';

/**
 * ESTAR O NO EN LA TIENDA.
 *
 * Salió de `perfume.repository.ts` al pasar las 500 líneas, cuando publicar dejó
 * de ser un simple interruptor y empezó a tener una regla propia.
 */

/**
 * Saca un perfume de la tienda o lo devuelve, sin borrar nada.
 *
 * No se publica nada con una talla en $0. Nació con los originales
 * (2026-09-29): nacen sin precio a propósito —el dueño los pone talla por
 * talla— y un clic apurado en "publicar" los habría puesto en la tienda
 * regalados. Sacarlo de la tienda nunca se bloquea.
 */
export const patchPublicadoPerfume = async (id: string, publicado: boolean) => {
  if (publicado) {
    const row = await prisma.perfume.findUnique({ where: { id: Number(id) }, include: perfumeInclude });
    const p = row ? mapPerfume(row) : null;
    const sinPrecio = p?.precios.filter((t) => !(t.precio > 0)) ?? [];
    if (sinPrecio.length) {
      throw badRequest(`Ponle precio a ${sinPrecio.map((t) => t.presentacion).join(', ')} antes de publicarlo: saldría en $0.`);
    }
    if (p && !(p.precio > 0)) throw badRequest('Ponle precio antes de publicarlo: saldría en $0.');
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
