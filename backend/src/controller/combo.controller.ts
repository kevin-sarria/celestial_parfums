import { Request, Response } from 'express';
import * as comboService from '../services/combo.service';
import { parsePagination } from '../utils/pagination';

export const getRelatedCombos = async (req: Request, res: Response) => {
  try {
    const data = await comboService.getRelatedCombos(req.params.slug as string);
    res.status(200).json({ data });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
};

export const getComboBySlug = async (req: Request, res: Response) => {
  try {
    const data = await comboService.getComboBySlug(req.params.slug as string);
    res.status(200).json({ data });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
};

export const getCombos = async (req: Request, res: Response) => {
  try {
    if (req.query.page) {
      const { page, limit } = parsePagination(req.query as any);
      const result = await comboService.getCombosPaginated(page, limit);
      res.json(result);
    } else {
      const data = await comboService.getAllCombos();
      res.json({ data });
    }
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const addCombo = async (req: Request, res: Response) => {
  try {
    const id = await comboService.createCombo(req.body);
    res.status(201).json({ message: 'Combo creado', data: { id } });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const editCombo = async (req: Request, res: Response) => {
  try {
    await comboService.updateCombo(req.params.id as string, req.body);
    res.json({ message: 'Combo actualizado' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const removeCombo = async (req: Request, res: Response) => {
  try {
    await comboService.deleteCombo(req.params.id as string);
    res.json({ message: 'Combo eliminado' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const patchDescuentoCombo = async (req: Request, res: Response) => {
  try {
    await comboService.patchComboDescuento(req.params.id as string, Number(req.body.descuento));
    res.json({ message: 'Descuento actualizado' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
