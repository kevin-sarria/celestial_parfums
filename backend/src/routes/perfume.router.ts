import { Router } from 'express';
import {
  getRelatedPerfumes,
  getPerfumeBySlug,
  selectAllPerfumes,
  createPerfume,
  editPerfume,
  deletePerfume,
  patchDescuentoPerfume,
  patchAgotadoPerfume,
  getAromas,
  addAroma,
  removeAroma,
  getOcasiones,
  addOcasion,
  removeOcasion,
  getCategorias,
  addCategoria,
  removeCategoria,
  getPresentaciones,
  addPresentacion,
  removePresentacion,
} from '../controller/perfume.controller';
import { requireAdmin } from '../middleware/auth.middleware';

export const perfumeRouter = Router();

// Public read endpoints
perfumeRouter.get('/by-slug/:slug/related', getRelatedPerfumes);
perfumeRouter.get('/by-slug/:slug', getPerfumeBySlug);
perfumeRouter.get('/', selectAllPerfumes);
perfumeRouter.get('/tipos-aroma', getAromas);
perfumeRouter.get('/ocasiones', getOcasiones);
perfumeRouter.get('/categorias', getCategorias);

// Admin-only write endpoints
perfumeRouter.post('/create', requireAdmin, createPerfume);
perfumeRouter.patch('/update/:id', requireAdmin, editPerfume);
perfumeRouter.delete('/delete/:id', requireAdmin, deletePerfume);
perfumeRouter.patch('/:id/descuento', requireAdmin, patchDescuentoPerfume);
perfumeRouter.patch('/:id/agotado', requireAdmin, patchAgotadoPerfume);

perfumeRouter.post('/tipos-aroma', requireAdmin, addAroma);
perfumeRouter.delete('/tipos-aroma/:id', requireAdmin, removeAroma);

perfumeRouter.post('/ocasiones', requireAdmin, addOcasion);
perfumeRouter.delete('/ocasiones/:id', requireAdmin, removeOcasion);

perfumeRouter.post('/categorias', requireAdmin, addCategoria);
perfumeRouter.delete('/categorias/:id', requireAdmin, removeCategoria);

perfumeRouter.get('/presentaciones', getPresentaciones);
perfumeRouter.post('/presentaciones', requireAdmin, addPresentacion);
perfumeRouter.delete('/presentaciones/:id', requireAdmin, removePresentacion);
