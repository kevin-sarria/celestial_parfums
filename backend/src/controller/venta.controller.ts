import { Request, Response } from 'express';
import * as ventaService from '../services/venta.service';
import { parsePagination } from '../utils/pagination';

export const getVentas = async (req: Request, res: Response) => {
  try {
    const { page, limit } = parsePagination(req.query as any);
    const result = await ventaService.getAllVentas(page, limit);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const addVenta = async (req: Request, res: Response) => {
  try {
    const data = await ventaService.createVenta(req.body);
    res.status(201).json({ message: 'Venta registrada', data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const editVenta = async (req: Request, res: Response) => {
  try {
    const data = await ventaService.updateVenta(req.params.id as string, req.body);
    res.json({ message: 'Venta actualizada', data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const removeVenta = async (req: Request, res: Response) => {
  try {
    await ventaService.deleteVenta(req.params.id as string);
    res.json({ message: 'Venta eliminada' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getTotales = async (_req: Request, res: Response) => {
  try {
    const data = await ventaService.getVentaTotales();
    res.json({ data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
