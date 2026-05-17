import * as repo from '../repositories/empresa.repository';
import { CreateEmpresaDTO } from '../types/empresa.type';

export const getAllEmpresas = () => repo.getAllEmpresas();

export const createEmpresa = (data: CreateEmpresaDTO) => {
  if (!data.nombre?.trim())
    throw new Error('El nombre de la empresa es obligatorio');
  return repo.createEmpresa(data);
};

export const updateEmpresa = (id: string, data: CreateEmpresaDTO) => {
  if (!data.nombre?.trim())
    throw new Error('El nombre de la empresa es obligatorio');
  return repo.updateEmpresa(id, data);
};

export const deleteEmpresa = (id: string) => repo.deleteEmpresa(id);
