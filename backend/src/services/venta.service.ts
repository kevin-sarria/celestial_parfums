import * as repo from '../repositories/venta.repository';
import { CreateVentaDTO } from '../types/venta.type';
import { bustCatalogoCache } from './perfume.service';

export const getAllVentas = (
  page: number, limit: number, search?: string, conTotales = false, filtrosAnd?: object[],
) => repo.getAllVentas(page, limit, search, conTotales, filtrosAnd);

export const createVenta = async (data: CreateVentaDTO) => {
  if (!data.dia || !data.persona || !data.valor_venta)
    throw new Error('Día, persona y valor son obligatorios');
  // La validación real está en Zod (acepta líneas nuevas o ids antiguos). Aquí
  // había otra copia de "al menos 1 perfume" que impedía vender solo un perfumero.
  const result = await repo.createVenta(data);
  bustCatalogoCache(); // las ventas alimentan "los más vendidos"
  return result;
};

export const updateVenta = async (id: string, data: CreateVentaDTO) => {
  if (!data.dia || !data.persona || !data.valor_venta)
    throw new Error('Día, persona y valor son obligatorios');
  // La validación real está en Zod (acepta líneas nuevas o ids antiguos)
  const result = await repo.updateVenta(id, data);
  bustCatalogoCache();
  return result;
};

export const deleteVenta = async (id: string) => {
  const result = await repo.deleteVenta(id);
  bustCatalogoCache();
  return result;
};

export const getVentaTotales = () => repo.getVentaTotales();

export const relinkVentasPerfume = async () => {
  const result = await repo.relinkVentasPerfume();
  bustCatalogoCache();
  return result;
};

export const getVentasPorMes = () => repo.getVentasPorMes();
