import * as repo from '../repositories/credito.repository';
import { CreateCreditoDTO } from '../types/credito.type';

export const getAllCreditos = (page: number, limit: number, search?: string) => repo.getAllCreditos(page, limit, search);

const validarCredito = (data: CreateCreditoDTO) => {
  if (!data.fecha || !data.user_id || !data.articulos)
    throw new Error('Fecha, persona y artículos son obligatorios');
  if (data.deuda_inicial <= 0)
    throw new Error('La deuda inicial debe ser mayor a 0');
};

export const createCredito = (data: CreateCreditoDTO) => {
  validarCredito(data);
  return repo.createCredito(data);
};

export const updateCredito = (id: string, data: CreateCreditoDTO) => {
  validarCredito(data);
  return repo.updateCredito(id, data);
};

export const addAbono = (id: string, monto: number) => {
  if (!monto || monto <= 0) throw new Error('El monto del abono debe ser mayor a 0');
  return repo.addAbono(id, monto);
};

export const deleteAbono = (abonoId: string) => repo.deleteAbono(abonoId);

export const deleteCredito = (id: string) => repo.deleteCredito(id);
