import * as comboRepo from '../repositories/combo.repository';
import { CreateComboDTO } from '../types/combo.type';

export const getAllCombos = () => comboRepo.selectAllCombos();

export const getCombosPaginated = (page: number, limit: number, search?: string) =>
  comboRepo.selectCombosPaginated(page, limit, search);

export const createCombo = async (data: CreateComboDTO) => {
  if (!data?.nombre?.trim()) throw new Error('El nombre es obligatorio');
  if (!data.cantidad || data.cantidad < 1) throw new Error('La cantidad debe ser mayor a 0');
  if (!data.precio || data.precio < 0) throw new Error('El precio es obligatorio');
  return comboRepo.createCombo(data);
};

export const updateCombo = async (id: string, data: CreateComboDTO) => {
  if (!data?.nombre?.trim()) throw new Error('El nombre es obligatorio');
  if (!data.cantidad || data.cantidad < 1) throw new Error('La cantidad debe ser mayor a 0');
  if (!data.precio || data.precio < 0) throw new Error('El precio es obligatorio');
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
