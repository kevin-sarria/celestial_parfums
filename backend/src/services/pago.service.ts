import * as repo from '../repositories/pago.repository';
import { CreatePagoDTO } from '../types/pago.type';

export const getAllPagos = (page: number, limit: number, search?: string) => repo.getAllPagos(page, limit, search);

export const createPago = (data: CreatePagoDTO) => {
  if (!data.dia || !data.empresa_id || !data.valor_compra)
    throw new Error('Día, empresa y valor de compra son obligatorios');
  if (data.valor_compra <= 0)
    throw new Error('El valor de compra debe ser mayor a 0');
  return repo.createPago(data);
};

export const updatePago = (id: string, data: CreatePagoDTO) => {
  if (!data.dia || !data.empresa_id || !data.valor_compra)
    throw new Error('Día, empresa y valor de compra son obligatorios');
  return repo.updatePago(id, data);
};

export const deletePago = (id: string) => repo.deletePago(id);

export const getPagoTotales = () => repo.getPagoTotales();
