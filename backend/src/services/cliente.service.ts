import * as repo from '../repositories/cliente.repository';
import { CreateClienteDTO } from '../types/cliente.type';

export const getAllClientes = () => repo.getAllClientes();

export const createCliente = (data: CreateClienteDTO) => {
  if (!data.nombre?.trim() || !data.apellido?.trim())
    throw new Error('Nombre y apellido son obligatorios');
  return repo.createCliente(data);
};

export const updateCliente = (id: string, data: CreateClienteDTO) => {
  if (!data.nombre?.trim() || !data.apellido?.trim())
    throw new Error('Nombre y apellido son obligatorios');
  return repo.updateCliente(id, data);
};

export const deleteCliente = (id: string) => repo.deleteCliente(id);
