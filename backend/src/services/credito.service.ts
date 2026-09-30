import * as repo from '../repositories/credito.repository';
import { CreateCreditoDTO } from '../types/credito.type';
import { bustCatalogoCache } from './perfume.service';

export const getAllCreditos = (
  page: number, limit: number, search?: string, conTotales = false, filtrosAnd?: object[],
) => repo.getAllCreditos(page, limit, search, conTotales, filtrosAnd);

/** Resumen de la cartera (cuánto te deben, cuánto está vencido, abonos del mes). */
export const getTotales = () => repo.getCreditoTotales();

const validarCredito = (data: CreateCreditoDTO) => {
  if (!data.fecha || !data.user_id || !data.articulos)
    throw new Error('Fecha, persona y artículos son obligatorios');
  if (data.deuda_inicial <= 0)
    throw new Error('La deuda inicial debe ser mayor a 0');
};

/**
 * Un crédito saca mercancía del inventario igual que una venta, así que cambia
 * lo que la tienda puede ofrecer. Sin limpiar el catálogo guardado, la última
 * botella dada a crédito seguía apareciendo disponible hasta 5 minutos (dueño,
 * 2026-09-30, con la Nautica Voyage Original). Las ventas ya lo hacían.
 */
const conCatalogoFresco = async <T>(cambio: Promise<T>) => {
  const resultado = await cambio;
  bustCatalogoCache();
  return resultado;
};

export const createCredito = (data: CreateCreditoDTO) => {
  validarCredito(data);
  return conCatalogoFresco(repo.createCredito(data));
};

export const updateCredito = (id: string, data: CreateCreditoDTO) => {
  validarCredito(data);
  return conCatalogoFresco(repo.updateCredito(id, data));
};

export const addAbono = (id: string, monto: number) => {
  if (!monto || monto <= 0) throw new Error('El monto del abono debe ser mayor a 0');
  return repo.addAbono(id, monto);
};

export const deleteAbono = (creditoId: string, abonoId: string) => repo.deleteAbono(creditoId, abonoId);

export const deleteCredito = (id: string) => conCatalogoFresco(repo.deleteCredito(id));
