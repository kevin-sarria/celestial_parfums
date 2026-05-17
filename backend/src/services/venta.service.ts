import * as repo from '../repositories/venta.repository';
import { CreateVentaDTO } from '../types/venta.type';

export const getAllVentas = (page: number, limit: number) => repo.getAllVentas(page, limit);

export const createVenta = (data: CreateVentaDTO) => {
  if (!data.dia || !data.persona || !data.referencia_perfume || !data.valor_venta)
    throw new Error('Día, persona, referencia y valor son obligatorios');
  if (data.cantidad_perfumes < 1)
    throw new Error('La cantidad de perfumes debe ser al menos 1');
  return repo.createVenta(data);
};

export const updateVenta = (id: string, data: CreateVentaDTO) => {
  if (!data.dia || !data.persona || !data.referencia_perfume || !data.valor_venta)
    throw new Error('Día, persona, referencia y valor son obligatorios');
  return repo.updateVenta(id, data);
};

export const deleteVenta = (id: string) => repo.deleteVenta(id);

export const getVentaTotales = () => repo.getVentaTotales();
