import { Request, Response } from 'express';
import * as clienteService from '../services/cliente.service';

export const getClientes = async (_req: Request, res: Response) => {
  try {
    const data = await clienteService.getAllClientes();
    res.json({ data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const addCliente = async (req: Request, res: Response) => {
  try {
    const data = await clienteService.createCliente(req.body);
    res.status(201).json({ message: 'Cliente registrado', data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const editCliente = async (req: Request, res: Response) => {
  try {
    const data = await clienteService.updateCliente(req.params.id as string, req.body);
    res.json({ message: 'Cliente actualizado', data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const removeCliente = async (req: Request, res: Response) => {
  try {
    await clienteService.deleteCliente(req.params.id as string);
    res.json({ message: 'Cliente eliminado' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
