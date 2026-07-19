import { Request, Response } from 'express';
import * as perfumeService from '../services/perfume.service';
import { parsePagination, parseSearch } from '../utils/pagination';

export const getRelatedPerfumes = async (req: Request, res: Response) => {
  try {
    const data = await perfumeService.getRelatedPerfumes(req.params.slug as string);
    res.status(200).json({ data });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
};

export const getDestacados = async (_req: Request, res: Response) => {
  try {
    const data = await perfumeService.getDestacados();
    res.json({ data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getPerfumeBySlug = async (req: Request, res: Response) => {
  try {
    const data = await perfumeService.getPerfumeBySlug(req.params.slug as string);
    res.status(200).json({ data });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
};

/** Lista separada por comas saneada (máx. 20 valores). */
const parseLista = (v: unknown): string[] | undefined => {
  if (typeof v !== 'string' || !v.trim()) return undefined;
  const items = v.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20);
  return items.length ? items : undefined;
};

export const selectAllPerfumes = async (req: Request, res: Response) => {
  try {
    if (req.query.page) {
      const { page, limit } = parsePagination(req.query as any);
      const generoRaw = typeof req.query.genero === 'string' ? req.query.genero : '';
      const result = await perfumeService.allPerfumesPaginated(page, limit, parseSearch(req.query as any), {
        genero: ['dama', 'caballero', 'unisex'].includes(generoRaw) ? (generoRaw as 'dama' | 'caballero' | 'unisex') : undefined,
        categorias: parseLista(req.query.categorias),
        aromas: parseLista(req.query.aromas),
        ocasiones: parseLista(req.query.ocasiones),
      });
      res.json(result);
    } else {
      const result = await perfumeService.allPerfumes();
      res.status(200).json({ message: 'Datos Encontrados Correctamente', data: result });
    }
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const createPerfume = async (req: Request, res: Response) => {
  try {
    const result = await perfumeService.createPerfume(req.body);
    res.status(201).json({ message: 'Perfume creado correctamente', data: result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const editPerfume = async (req: Request, res: Response) => {
  try {
    const result = await perfumeService.editPerfume(req.params.id as string, req.body);
    res.status(200).json({ message: 'Perfume actualizado correctamente', data: result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const deletePerfume = async (req: Request, res: Response) => {
  try {
    await perfumeService.deletePerfume(req.params.id as string);
    res.status(200).json({ message: 'Perfume eliminado correctamente' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const patchDescuentoPerfume = async (req: Request, res: Response) => {
  try {
    await perfumeService.patchDescuentoPerfume(req.params.id as string, Number(req.body.descuento));
    res.json({ message: 'Descuento actualizado' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const patchDescuentoCategoria = async (req: Request, res: Response) => {
  try {
    const count = await perfumeService.patchDescuentoPorCategoria(
      Number(req.body.categoria_id),
      Number(req.body.descuento),
    );
    res.json({ message: `Descuento aplicado a ${count} perfumes`, count });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const patchAgotadoPerfume = async (req: Request, res: Response) => {
  try {
    await perfumeService.patchAgotadoPerfume(req.params.id as string, Boolean(req.body.agotado));
    res.json({ message: 'Estado de stock actualizado' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getAromas = async (_req: Request, res: Response) => {
  try {
    const data = await perfumeService.getAllAromas();
    res.status(200).json({ data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const addAroma = async (req: Request, res: Response) => {
  try {
    const id = await perfumeService.createAroma(req.body.nombre);
    res.status(201).json({ message: 'Aroma creado', data: { id } });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const removeAroma = async (req: Request, res: Response) => {
  try {
    await perfumeService.deleteAroma(req.params.id as string);
    res.status(200).json({ message: 'Aroma eliminado' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const editAroma = async (req: Request, res: Response) => {
  try {
    await perfumeService.updateAroma(req.params.id as string, req.body.nombre);
    res.status(200).json({ message: 'Aroma actualizado' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getOcasiones = async (_req: Request, res: Response) => {
  try {
    const data = await perfumeService.getAllOcasiones();
    res.status(200).json({ data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const addOcasion = async (req: Request, res: Response) => {
  try {
    const id = await perfumeService.createOcasion(req.body.nombre);
    res.status(201).json({ message: 'Ocasión creada', data: { id } });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const removeOcasion = async (req: Request, res: Response) => {
  try {
    await perfumeService.deleteOcasion(req.params.id as string);
    res.status(200).json({ message: 'Ocasión eliminada' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const editOcasion = async (req: Request, res: Response) => {
  try {
    await perfumeService.updateOcasion(req.params.id as string, req.body.nombre);
    res.status(200).json({ message: 'Ocasión actualizada' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getCategorias = async (_req: Request, res: Response) => {
  try {
    const data = await perfumeService.getAllCategorias();
    res.status(200).json({ data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const addCategoria = async (req: Request, res: Response) => {
  try {
    const id = await perfumeService.createCategoria(req.body.nombre);
    res.status(201).json({ message: 'Categoría creada', data: { id } });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const removeCategoria = async (req: Request, res: Response) => {
  try {
    await perfumeService.deleteCategoria(req.params.id as string);
    res.status(200).json({ message: 'Categoría eliminada' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const editCategoria = async (req: Request, res: Response) => {
  try {
    await perfumeService.updateCategoria(req.params.id as string, req.body.nombre);
    res.status(200).json({ message: 'Categoría actualizada' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getPresentaciones = async (_req: Request, res: Response) => {
  try {
    const data = await perfumeService.getAllPresentaciones();
    res.status(200).json({ data });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const addPresentacion = async (req: Request, res: Response) => {
  try {
    const id = await perfumeService.createPresentacion(req.body.nombre);
    res.status(201).json({ message: 'Presentación creada', data: { id } });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const removePresentacion = async (req: Request, res: Response) => {
  try {
    await perfumeService.deletePresentacion(req.params.id as string);
    res.status(200).json({ message: 'Presentación eliminada' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const editPresentacion = async (req: Request, res: Response) => {
  try {
    await perfumeService.updatePresentacion(req.params.id as string, req.body.nombre);
    res.status(200).json({ message: 'Presentación actualizada' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
