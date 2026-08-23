import { prisma } from '../config/prisma';

/**
 * LA LISTA DE PRECIOS: cuánto vale cada categoría en cada talla.
 *
 * Es su propio archivo porque no es "el perfume": es la tabla de la que los
 * perfumes HEREDAN precio cuando no tienen uno propio, y por eso tocarla mueve
 * a todos los de esa categoría de una sola vez. La cascada completa —precio
 * propio de la talla, luego esta lista, luego el de respaldo del perfume— está
 * explicada y resuelta en `perfume.mapeo.ts`; aquí solo se lee y se escribe.
 */

// ── Lista de precios (categoría × presentación) ─────────────────────────────

/** Toda la lista, para pintar la tabla de precios del dashboard. */
export const selectPrecios = async () => {
  const rows = await prisma.precioLista.findMany({
    include: { categoria: true, presentacion: true },
    orderBy: [{ categoria: { nombre: 'asc' } }, { presentacion: { nombre: 'asc' } }],
  });
  return rows.map((r) => ({
    categoria_id:    r.categoria_id,
    categoria:       r.categoria.nombre,
    presentacion_id: r.presentacion_id,
    presentacion:    r.presentacion.nombre,
    precio:          Number(r.precio),
  }));
};

/**
 * Fija (o borra) el precio estándar de una categoría en una presentación.
 * precio null = esa combinación deja de tener precio de lista.
 */
export const setPrecioLista = async (categoriaId: number, presentacionId: number, precio: number | null) => {
  const where = { categoria_id_presentacion_id: { categoria_id: categoriaId, presentacion_id: presentacionId } };
  if (precio == null) {
    await prisma.precioLista.deleteMany({ where: { categoria_id: categoriaId, presentacion_id: presentacionId } });
    return { borrado: true };
  }
  await prisma.precioLista.upsert({
    where,
    create: { categoria_id: categoriaId, presentacion_id: presentacionId, precio },
    update: { precio },
  });
  // Cuántos perfumes quedan cobrando este precio (los que no tienen uno propio)
  const afectados = await prisma.perfume.count({
    where: {
      categoria_id: categoriaId,
      presentaciones: { some: { presentacion_id: presentacionId, precio: null } },
    },
  });
  return { afectados };
};
