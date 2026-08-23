import { prisma } from '../config/prisma';
import { mlDelNombre } from '../utils/tallas';

/**
 * Las CLASIFICACIONES del catálogo: aromas, ocasiones, categorías y tallas.
 *
 * Salieron de `perfume.repository.ts` (iba en 713 líneas) porque no son leer y
 * escribir perfumes: son las cuatro tablas que el dueño administra desde
 * *Clasificaciones* y de las que el perfume solo cuelga. Aquí no hay ninguna
 * regla de precio ni de disponibilidad — esas viven en `perfume.mapeo.ts`.
 *
 * Lo único que NO es CRUD simple está comentado donde ocurre: borrar una
 * categoría muda sus perfumes antes, y una talla nueva nace sabiendo sus ml.
 */

// ── Aromas ──────────────────────────────────────────────────────────────────

export const getAllAromas = () =>
  prisma.tipoAroma.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } });

export const createAroma = async (nombre: string) => {
  const row = await prisma.tipoAroma.create({ data: { nombre } });
  return row.id;
};

export const deleteAroma = (id: string) =>
  prisma.tipoAroma.delete({ where: { id: Number(id) } });

export const updateAroma = (id: string, nombre: string) =>
  prisma.tipoAroma.update({ where: { id: Number(id) }, data: { nombre } });

// ── Ocasiones ───────────────────────────────────────────────────────────────

export const getAllOcasiones = () =>
  prisma.ocasion.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } });

export const createOcasion = async (nombre: string) => {
  const row = await prisma.ocasion.create({ data: { nombre } });
  return row.id;
};

export const deleteOcasion = (id: string) =>
  prisma.ocasion.delete({ where: { id: Number(id) } });

export const updateOcasion = (id: string, nombre: string) =>
  prisma.ocasion.update({ where: { id: Number(id) }, data: { nombre } });

// ── Categorías ──────────────────────────────────────────────────────────────

/**
 * `usos` = cuántos perfumes la tienen. El dashboard lo necesita porque borrar
 * una categoría en uso NO falla (la FK es SET NULL): dejaría esos perfumes sin
 * categoría y, como el precio sale de la lista categoría × talla, les cambiaría
 * el precio al de respaldo. Con el conteo, la interfaz obliga a mudarlos antes.
 */
export const getAllCategorias = async () => {
  const rows = await prisma.categoria.findMany({
    select: { id: true, nombre: true, descuento: true, _count: { select: { perfumes: true } } },
    orderBy: { nombre: 'asc' },
  });
  return rows.map(({ _count, ...c }) => ({ ...c, usos: _count.perfumes }));
};

/**
 * Borra la categoría mudando antes sus perfumes a `destinoId`.
 * Va en una transacción: si la mudanza falla, la categoría no se borra y nadie
 * queda huérfano. Sin destino solo se permite si no la usa ningún perfume.
 */
export const deleteCategoriaConMudanza = async (id: number, destinoId: number | null) => {
  const usos = await prisma.perfume.count({ where: { categoria_id: id } });
  if (usos > 0 && destinoId == null) {
    throw new Error(
      `${usos} perfume(s) usan esta categoría. Elige a cuál moverlos antes de eliminarla.`,
    );
  }
  if (destinoId === id) throw new Error('No puedes mover los perfumes a la categoría que vas a eliminar.');
  return prisma.$transaction(async (tx) => {
    if (usos > 0 && destinoId != null) {
      const destino = await tx.categoria.findUnique({ where: { id: destinoId } });
      if (!destino) throw new Error('La categoría de destino ya no existe.');
      await tx.perfume.updateMany({ where: { categoria_id: id }, data: { categoria_id: destinoId } });
    }
    await tx.categoria.delete({ where: { id } });
    return { movidos: destinoId != null ? usos : 0 };
  });
};

export const createCategoria = async (nombre: string) => {
  const row = await prisma.categoria.create({ data: { nombre } });
  return row.id;
};

export const deleteCategoria = (id: string) =>
  prisma.categoria.delete({ where: { id: Number(id) } });

export const updateCategoria = (id: string, nombre: string) =>
  prisma.categoria.update({ where: { id: Number(id) }, data: { nombre } });

// ── Presentaciones ─────────────────────────────────────────────────────────

export const getAllPresentaciones = () =>
  // `ml` viaja con la talla para poder MOSTRAR cuáles se costean: una talla sin
  // número el sistema la trata como "no es un tamaño", y eso solo se nota hoy
  // cuando una venta suya entra con costo cero.
  prisma.presentacion.findMany({
    select: { id: true, nombre: true, ml: true },
    orderBy: { nombre: 'asc' },
  });

/**
 * El tamaño que dice el nombre, con su receta ya enganchada.
 *
 * Una talla sin `ml` el sistema la trata como "no es un tamaño" y **no la
 * costea**: cada venta suya entraría con costo cero. Por eso el número se
 * deduce al crearla o renombrarla, y no se le pide al dueño — que además no
 * tiene dónde escribirlo.
 *
 * Si el nombre no dice ningún tamaño se devuelve `{}` **a propósito**: eso deja
 * intacto lo que ya hubiera. Poner null borraría en silencio el enlace de una
 * talla que sí se costea, solo por haberla renombrado a "Frasco chico".
 */
const tamanoDelNombre = async (nombre: string) => {
  const ml = mlDelNombre(nombre);
  if (ml == null) return {};
  // Por NÚMERO, nunca por texto: es lo que hizo casar el catálogo con el costeo.
  const receta = await prisma.formulaVolumen.findFirst({ where: { ml_total: ml } });
  return { ml, formula_volumen_id: receta?.id ?? null };
};

export const createPresentacion = async (nombre: string) => {
  const row = await prisma.presentacion.create({
    data: { nombre, ...(await tamanoDelNombre(nombre)) },
  });
  return row.id;
};

export const deletePresentacion = (id: string) =>
  prisma.presentacion.delete({ where: { id: Number(id) } });

export const updatePresentacion = async (id: string, nombre: string) =>
  prisma.presentacion.update({
    where: { id: Number(id) },
    data: { nombre, ...(await tamanoDelNombre(nombre)) },
  });
