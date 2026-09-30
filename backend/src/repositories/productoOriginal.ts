import { prisma } from '../config/prisma';
import { badRequest } from '../utils/httpError';
import { TALLAS_DECANT_ML } from '../utils/decants';
import { palabras } from './emparejarEsencias.repository';
import { fichaHeredada } from './fichaHeredada';

/**
 * EL CUARTO HERMANO: la ficha de un perfume ORIGINAL, nacida en la compra.
 *
 * Los otros tres crean lo que sale de una esencia, lo que se revende tal cual y
 * lo que se arma antes de venderse. Este crea el original: una botella que se
 * vende entera o partida en decants, las dos cosas del MISMO stock en ml
 * (dueño, 2026-09-29, opción A). Nace de una barrera real: el dueño compró 15
 * originales y el modal de material nuevo no tenía cómo decir "esto es una
 * botella original", así que algunos nunca iban a llegar al catálogo.
 *
 * Nace:
 *  - **fraccionado**, con la botella como su insumo: de ahí sale el stock de
 *    los decants y de la botella completa;
 *  - en la categoría **Original** (se crea si no existe);
 *  - con las tallas de decant de siempre MÁS la botella completa;
 *  - **sin precios y fuera de la tienda**: el dueño los pone talla por talla
 *    (cada original le costó distinto) y lo publica cuando la ficha esté
 *    completa. Publicar con una talla en $0 lo impide `patchPublicadoPerfume`.
 *
 * Si ya vendías esa fragancia en contratipo, `copiar_de_perfume_id` trae su
 * ficha —foto, notas, descripción— para no volver a escribirla.
 */
export const crearOriginal = async (datos: {
  insumo_id: number;
  nombre: string;
  ml_botella: number;
  copiar_de_perfume_id?: number | null;
}) => {
  const nombre = datos.nombre.trim().slice(0, 150);
  if (!nombre) throw badRequest('Ponle un nombre al perfume (por ejemplo "Khamrah Original")');

  // Mismo criterio que sus hermanos: lo que ya existe no se toca, se avisa.
  const clave = palabras(nombre).join(' ');
  const existentes = await prisma.perfume.findMany({ select: { id: true, nombre: true } });
  const yaEsta = existentes.find((p) => palabras(p.nombre).join(' ') === clave);
  if (yaEsta) return { id: yaEsta.id, nombre: yaEsta.nombre, accion: 'ya_existe' as const };

  const [categoriaId, tallas, heredado] = await Promise.all([
    categoriaOriginal(),
    // Sin repetidos: una botella de 10 ml ya es una de las tallas de decant
    Promise.all([...new Set([...TALLAS_DECANT_ML, datos.ml_botella])].map(tallaDeMl)),
    fichaHeredada(datos.copiar_de_perfume_id),
  ]);

  const creado = await prisma.perfume.create({
    data: {
      ...heredado,
      nombre,
      // Respaldo en cero a propósito: el precio real va talla por talla, y un
      // número inventado aquí se colaría en la tienda si una quedara vacía.
      precio: 0,
      publicado: false,
      tipo_producto: 'fraccionado',
      insumo_producto_id: datos.insumo_id,
      categoria_id: categoriaId,
      presentaciones: { create: tallas.map((presentacion_id) => ({ presentacion_id })) },
    },
  });
  return { id: creado.id, nombre: creado.nombre, accion: 'creado' as const };
};

/**
 * La categoría "Original". Se busca sin tildes ni mayúsculas y se crea si no
 * está: el dueño ya la tenía, pero una base nueva no debería romper el alta.
 */
const categoriaOriginal = async () => {
  const todas = await prisma.categoria.findMany({ select: { id: true, nombre: true } });
  const esta = todas.find((c) => palabras(c.nombre).join(' ') === 'original');
  if (esta) return esta.id;
  return (await prisma.categoria.create({ data: { nombre: 'Original' } })).id;
};

/**
 * La talla de `ml` mililitros: la que ya existe con ese tamaño o una nueva.
 * Se busca por el NÚMERO, no por el texto —el catálogo tiene "30ML" y "6 ML"—,
 * que es justo para lo que nació `presentacion.ml`.
 */
const tallaDeMl = async (ml: number) => {
  const existe = await prisma.presentacion.findFirst({ where: { ml }, select: { id: true } });
  if (existe) return existe.id;
  return (await prisma.presentacion.upsert({
    where: { nombre: `${ml}ML` },
    update: {},
    create: { nombre: `${ml}ML`, ml },
    select: { id: true },
  })).id;
};
