import * as repo from '../repositories/credito.repository';
import { CreateCreditoDTO } from '../types/credito.type';

export const getAllCreditos = (page: number, limit: number) => repo.getAllCreditos(page, limit);

export const createCredito = (data: CreateCreditoDTO) => {
  if (!data.fecha || !data.cliente_id || !data.articulos)
    throw new Error('Fecha, cliente y artículos son obligatorios');
  if (data.deuda_inicial <= 0)
    throw new Error('La deuda inicial debe ser mayor a 0');
  return repo.createCredito(data);
};

export const addAbono = (id: string, monto: number) => {
  if (!monto || monto <= 0) throw new Error('El monto del abono debe ser mayor a 0');
  return repo.addAbono(id, monto);
};

export const deleteCredito = (id: string) => repo.deleteCredito(id);
