import { prisma } from '../config/prisma';

/**
 * LO QUE UNA FICHA NUEVA HEREDA DE OTRA DEL MISMO JUGO.
 *
 * Un 1.1 y su contratipo, o un original y el contratipo que ya vendías de esa
 * fragancia, huelen igual: descripción, notas, ocasiones, género, duración,
 * proyección y foto son las mismas, y volver a escribirlas es justo la fricción
 * que dejaba fichas a medio llenar.
 *
 * Se COPIA, no se enlaza: son productos que se venden distinto, y el día que se
 * separen, un enlace vivo obligaría a decidir cuál manda. El precio, las tallas
 * y el insumo NO viajan: es lo único que de verdad cambia entre los dos.
 *
 * Vive aparte porque la usan dos altas —la del 1.1 (`crearProductoArmado`) y la
 * del original (`productoOriginal.ts`)—, y copiar la lista de campos en cada una
 * garantiza que un día hereden cosas distintas.
 *
 * Devuelve los campos listos para `prisma.perfume.create`; `{}` si no hay de
 * dónde copiar o el perfume ya no existe.
 */
export const fichaHeredada = async (origenId: number | null | undefined) => {
  if (!origenId) return {};
  const origen = await prisma.perfume.findUnique({
    where: { id: origenId },
    include: {
      tipos_aroma: { select: { tipo_aroma_id: true } },
      ocasiones: { select: { ocasion_id: true } },
    },
  });
  if (!origen) return {};
  return {
    descripcion: origen.descripcion,
    duracion: origen.duracion,
    proyeccion: origen.proyeccion,
    genero: origen.genero,
    // La FOTO también se hereda (dueño, 2026-08-25): una ficha sin imagen se
    // vería rota en la tienda. Se cambia luego si él le toma una propia.
    imagen_url: origen.imagen_url,
    ...(origen.tipos_aroma.length
      ? { tipos_aroma: { create: origen.tipos_aroma.map((t) => ({ tipo_aroma_id: t.tipo_aroma_id })) } }
      : {}),
    ...(origen.ocasiones.length
      ? { ocasiones: { create: origen.ocasiones.map((o) => ({ ocasion_id: o.ocasion_id })) } }
      : {}),
  };
};
