import { Request, Response } from 'express';
import * as empresaService from '../services/empresa.service';

export const getEmpresas = async (_req: Request, res: Response) => {
  try {
    const data = await empresaService.getAllEmpresas();
    res.json({ data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const addEmpresa = async (req: Request, res: Response) => {
  try {
    const data = await empresaService.createEmpresa(req.body);
    res.status(201).json({ message: 'Empresa registrada', data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const editEmpresa = async (req: Request, res: Response) => {
  try {
    const data = await empresaService.updateEmpresa(req.params.id as string, req.body);
    res.json({ message: 'Empresa actualizada', data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const removeEmpresa = async (req: Request, res: Response) => {
  try {
    await empresaService.deleteEmpresa(req.params.id as string);
    res.json({ message: 'Empresa eliminada' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
