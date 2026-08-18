import { Request, Response } from 'express';
import * as pagoService from '../services/pago.service';
import { mapaFiltrosPagos } from '../repositories/pago.repository';
import { parsePagination, parseSearch } from '../utils/pagination';
import { parseFiltros } from '../utils/filtros';
import { mensajeSeguro } from '../utils/errorSeguro';
import { getPublicBaseUrl } from '../utils/publicUrl';

export const getPagos = async (req: Request, res: Response) => {
  try {
    const { page, limit } = parsePagination(req.query as any);
    const result = await pagoService.getAllPagos(
      page, limit, parseSearch(req.query as any), req.query.con_totales === '1',
      parseFiltros(req.query as any, mapaFiltrosPagos),
    );
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const addPago = async (req: Request, res: Response) => {
  try {
    const data = await pagoService.createPago(req.body, getPublicBaseUrl(req));
    res.status(201).json({ message: 'Pago registrado', data });
  } catch (error: any) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const editPago = async (req: Request, res: Response) => {
  try {
    const data = await pagoService.updatePago(req.params.id as string, req.body, getPublicBaseUrl(req));
    res.json({ message: 'Pago actualizado', data });
  } catch (error: any) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const removePago = async (req: Request, res: Response) => {
  try {
    await pagoService.deletePago(req.params.id as string);
    res.json({ message: 'Pago eliminado' });
  } catch (error: any) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const getTotalesPagos = async (_req: Request, res: Response) => {
  try {
    const data = await pagoService.getPagoTotales();
    res.json({ data });
  } catch (error: any) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};
