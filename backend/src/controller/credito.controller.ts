import { Request, Response } from 'express';
import * as creditoService from '../services/credito.service';
import { parsePagination, parseSearch } from '../utils/pagination';
import { mensajeSeguro } from '../utils/errorSeguro';

export const getCreditos = async (req: Request, res: Response) => {
  try {
    const { page, limit } = parsePagination(req.query as any);
    const result = await creditoService.getAllCreditos(page, limit, parseSearch(req.query as any));
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const getTotales = async (_req: Request, res: Response) => {
  try {
    res.json({ data: await creditoService.getTotales() });
  } catch (error: any) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const addCredito = async (req: Request, res: Response) => {
  try {
    const data = await creditoService.createCredito(req.body);
    res.status(201).json({ message: 'Crédito registrado', data });
  } catch (error: any) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const editCredito = async (req: Request, res: Response) => {
  try {
    const data = await creditoService.updateCredito(req.params.id as string, req.body);
    res.json({ message: 'Crédito actualizado', data });
  } catch (error: any) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const addAbono = async (req: Request, res: Response) => {
  try {
    const data = await creditoService.addAbono(req.params.id as string, Number(req.body.monto));
    res.json({ message: 'Abono registrado', data });
  } catch (error: any) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const removeAbono = async (req: Request, res: Response) => {
  try {
    await creditoService.deleteAbono(req.params.abonoId as string);
    res.json({ message: 'Abono eliminado' });
  } catch (error: any) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};

export const removeCredito = async (req: Request, res: Response) => {
  try {
    await creditoService.deleteCredito(req.params.id as string);
    res.json({ message: 'Crédito eliminado' });
  } catch (error: any) {
    res.status(400).json({ error: mensajeSeguro(error) });
  }
};
