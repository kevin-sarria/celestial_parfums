import * as repo from '../repositories/pago.repository';
import { CreatePagoDTO } from '../types/pago.type';
import { bustCatalogoCache } from './perfume.service';

export const getAllPagos = (page: number, limit: number, search?: string) => repo.getAllPagos(page, limit, search);

/**
 * Una compra CON LÍNEAS mete material en bodega, y eso cambia qué perfumes se
 * pueden armar hoy — o sea, cuáles dejan de salir agotados en la tienda. Un
 * pago suelto (sin líneas) no mueve inventario y no tiene por qué tirar el
 * caché del catálogo. Editar o borrar también cuentan: revierten movimientos.
 */
const tocaInventario = (data: CreatePagoDTO) => (data.items?.length ?? 0) > 0;

export const createPago = async (data: CreatePagoDTO, baseUrl: string) => {
  if (!data.dia || !data.empresa_id || !data.valor_compra)
    throw new Error('Día, empresa y valor de compra son obligatorios');
  if (data.valor_compra <= 0)
    throw new Error('El valor de compra debe ser mayor a 0');
  const pago = await repo.createPago(data, baseUrl);
  if (tocaInventario(data)) bustCatalogoCache();
  return pago;
};

export const updatePago = async (id: string, data: CreatePagoDTO, baseUrl: string) => {
  if (!data.dia || !data.empresa_id || !data.valor_compra)
    throw new Error('Día, empresa y valor de compra son obligatorios');
  const pago = await repo.updatePago(id, data, baseUrl);
  // Al editar se revierten los movimientos viejos y se aplican los nuevos, así
  // que el stock cambia aunque esta versión venga sin líneas.
  bustCatalogoCache();
  return pago;
};

export const deletePago = async (id: string) => {
  const r = await repo.deletePago(id);
  bustCatalogoCache();
  return r;
};

export const getPagoTotales = () => repo.getPagoTotales();
