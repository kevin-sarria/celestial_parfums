import { Request, Response } from 'express';
import * as pagoService from '../services/pago.service';
import { parsePagination } from '../utils/pagination';

export const getPagos = async (req: Request, res: Response) => {
  try {
    const { page, limit } = parsePagination(req.query as any);
    const result = await pagoService.getAllPagos(page, limit);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const addPago = async (req: Request, res: Response) => {
  try {
    const data = await pagoService.createPago(req.body);
    res.status(201).json({ message: 'Pago registrado', data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const editPago = async (req: Request, res: Response) => {
  try {
    const data = await pagoService.updatePago(req.params.id as string, req.body);
    res.json({ message: 'Pago actualizado', data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const removePago = async (req: Request, res: Response) => {
  try {
    await pagoService.deletePago(req.params.id as string);
    res.json({ message: 'Pago eliminado' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getTotalesPagos = async (_req: Request, res: Response) => {
  try {
    const data = await pagoService.getPagoTotales();
    res.json({ data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
