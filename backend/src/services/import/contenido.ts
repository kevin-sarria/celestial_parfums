import { ContenidoEstado } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { cacheClear } from '../../utils/cache';
import { aEnum, valoresDeEnum } from '../../utils/enums';
import type { EntityImportResult, FilaExcel } from './core';

/**
 * Contenido escrito por los CLIENTES: reseñas y fotos de premios entregados.
 *
 * Regla de este módulo: **se exporta todo, pero solo se importa la moderación**.
 * No hay forma de crear una reseña desde un archivo, a propósito:
 *  - Una reseña solo existe si alguien COMPRÓ ese perfume (compra verificada);
 *    un importador que las cree se salta esa barrera y sería publicidad
 *    engañosa (Ley 1480), sancionable por la SIC.
 *  - Y en lo práctico: si las estrellas se inventan, dejan de decirle al dueño
 *    qué fragancia gustó de verdad — pierde el dato justo cuando lo necesita
 *    para decidir qué reponer.
 *
 * El exportador SÍ hace falta: es el respaldo del contenido de los clientes y
 * la forma de responder un derecho de acceso a datos (Ley 1581 de 2012).
 */

const fmt = (d: Date) => d.toISOString().slice(0, 10);
const imgs = (v: unknown) => (Array.isArray(v) ? (v as string[]).join(', ') : '');
const txt = (v: unknown) => String(v ?? '').trim().toLowerCase();

export const filasResenas = async () => {
  const rows = await prisma.resena.findMany({
    orderBy: [{ created_at: 'desc' }],
    include: {
      user: { select: { nombre: true, apellido: true, email: true } },
      perfume: { select: { nombre: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    perfume: r.perfume?.nombre ?? '',
    cliente: `${r.user?.nombre ?? ''} ${r.user?.apellido ?? ''}`.trim(),
    correo: r.user?.email ?? '',
    estrellas: r.rating,
    comentario: r.comentario ?? '',
    fotos: imgs(r.imagenes),
    estado: r.estado,
    fecha: fmt(r.created_at),
  }));
};

export const filasEntregas = async () => {
  const rows = await prisma.recompensaEntrega.findMany({
    orderBy: [{ created_at: 'desc' }],
    include: { user: { select: { nombre: true, apellido: true, email: true } } },
  });
  return rows.map((e) => ({
    id: e.id,
    cliente: `${e.user?.nombre ?? ''} ${e.user?.apellido ?? ''}`.trim(),
    correo: e.user?.email ?? '',
    premio: e.premio,
    fotos: imgs(e.imagenes),
    estado: e.estado,
    fecha: fmt(e.created_at),
  }));
};


/**
 * Moderación en lote: solo cambia el `estado` de registros que YA existen,
 * buscados por su id. Ni crea ni edita lo que el cliente escribió.
 */
/**
 * Lo ÚNICO que la moderación necesita de un modelo: leerlo por id y cambiarle
 * el estado. Escribirlo así —en vez de `delegate: any`— deja que sirva igual
 * para reseñas y para entregas, pero sin apagar el chequeo: si mañana un modelo
 * no tiene `estado`, el error sale aquí y no en producción.
 */
type Moderable = {
  findUnique(args: { where: { id: number } }): Promise<{ estado: ContenidoEstado } | null>;
  update(args: { where: { id: number }; data: { estado: ContenidoEstado } }): Promise<unknown>;
};

const moderar = async (
  delegate: Moderable, rows: FilaExcel[], result: EntityImportResult, quees: string,
) => {
  for (const [i, row] of rows.entries()) {
    const fila = i + 2;
    const id = Number(row.id);
    const estado = aEnum(ContenidoEstado, row.estado);
    if (!id) {
      result.errores.push(`Fila ${fila}: falta el id (no se pueden crear ${quees} desde un archivo, solo moderarlas)`);
      result.omitidos++; continue;
    }
    if (!estado) {
      result.errores.push(`Fila ${fila}: estado debe ser ${valoresDeEnum(ContenidoEstado).join(', ')}`);
      result.omitidos++; continue;
    }
    const existente = await delegate.findUnique({ where: { id } });
    if (!existente) {
      result.errores.push(`Fila ${fila}: no existe el registro ${id}`);
      result.omitidos++; continue;
    }
    if (existente.estado === estado) { result.omitidos++; continue; }
    await delegate.update({ where: { id }, data: { estado } });
    result.actualizados++;
  }
};

export const importarContenido = async (
  entity: string, rows: FilaExcel[], result: EntityImportResult,
): Promise<boolean> => {
  if (entity === 'resenas') {
    await moderar(prisma.resena, rows, result, 'reseñas');
    cacheClear('parfums:'); // el promedio de estrellas se muestra en el catálogo
    return true;
  }
  if (entity === 'entregas') {
    await moderar(prisma.recompensaEntrega, rows, result, 'entregas');
    return true;
  }
  return false;
};

export const exportarContenido = async (entity: string): Promise<FilaExcel[] | null> => {
  if (entity === 'resenas') return filasResenas();
  if (entity === 'entregas') return filasEntregas();
  return null;
};
