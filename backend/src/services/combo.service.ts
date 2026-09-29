import * as comboRepo from '../repositories/combo.repository';
import { prisma } from '../config/prisma';
import { badRequest } from '../utils/httpError';
import { CreateComboDTO } from '../types/combo.type';

export const getAllCombos = () => comboRepo.selectAllCombos();

export const getCombosPaginated = (page: number, limit: number, search?: string, filtrosAnd?: object[]) =>
  comboRepo.selectCombosPaginated(page, limit, search, filtrosAnd);

/**
 * El kit solo lleva ACCESORIOS (perfumero, bolsa, tarjeta), y cada uno una vez:
 * una fragancia "de regalo" en el kit se descontaría del inventario como un
 * perfume entero sin que nadie lo decidiera en esa venta.
 */
const validarContenido = async (contenido: CreateComboDTO['contenido']) => {
  if (!contenido?.length) return;
  const ids = contenido.map((k) => k.perfume_id);
  if (new Set(ids).size !== ids.length) throw badRequest('Un accesorio aparece dos veces en el kit: súmale la cantidad');
  const accesorios = await prisma.perfume.count({ where: { id: { in: ids }, es_accesorio: true } });
  if (accesorios !== ids.length) throw badRequest('El kit del combo solo puede llevar accesorios (perfumero, bolsa, tarjeta)');
};

export const createCombo = async (data: CreateComboDTO) => {
  if (!data?.nombre?.trim()) throw new Error('El nombre es obligatorio');
  if (!data.cantidad || data.cantidad < 1) throw new Error('La cantidad debe ser mayor a 0');
  if (!data.precio || data.precio < 0) throw new Error('El precio es obligatorio');
  await validarContenido(data.contenido);
  return comboRepo.createCombo(data);
};

export const updateCombo = async (id: string, data: CreateComboDTO) => {
  if (!data?.nombre?.trim()) throw new Error('El nombre es obligatorio');
  if (!data.cantidad || data.cantidad < 1) throw new Error('La cantidad debe ser mayor a 0');
  if (!data.precio || data.precio < 0) throw new Error('El precio es obligatorio');
  await validarContenido(data.contenido);
  return comboRepo.updateCombo(id, data);
};

export const deleteCombo = (id: string) => comboRepo.deleteCombo(id);

export const patchComboDescuento = (id: string, descuento: number) => {
  const d = Math.max(0, Math.min(100, descuento));
  return comboRepo.patchComboDescuento(id, d);
};

export const getComboBySlug = async (slug: string) => {
  const normalizedSlug = slug.toLowerCase().trim();
  const combo = await comboRepo.findComboBySlug(normalizedSlug);
  if (!combo) throw new Error('Combo no encontrado');
  return combo;
};

export const getRelatedCombos = async (slug: string) => {
  const normalizedSlug = slug.toLowerCase().trim();
  const combo = await comboRepo.findComboBySlug(normalizedSlug);
  if (!combo) throw new Error('Combo no encontrado');
  return comboRepo.findRelatedCombos(combo.id);
};
