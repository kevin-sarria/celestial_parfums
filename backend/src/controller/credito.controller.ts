import { Request, Response } from 'express';
import * as creditoService from '../services/credito.service';

export const getCreditos = async (req: Request, res: Response) => {
  try {
    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const result = await creditoService.getAllCreditos(page, limit);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const addCredito = async (req: Request, res: Response) => {
  try {
    const data = await creditoService.createCredito(req.body);
    res.status(201).json({ message: 'Crédito registrado', data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const addAbono = async (req: Request, res: Response) => {
  try {
    const data = await creditoService.addAbono(req.params.id as string, Number(req.body.monto));
    res.json({ message: 'Abono registrado', data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const removeCredito = async (req: Request, res: Response) => {
  try {
    await creditoService.deleteCredito(req.params.id as string);
    res.json({ message: 'Crédito eliminado' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
