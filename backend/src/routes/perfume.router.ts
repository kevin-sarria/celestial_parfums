import { Router } from 'express';
import {
  getRelatedPerfumes,
  getPerfumeBySlug,
  getDestacados,
  selectAllPerfumes,
  createPerfume,
  editPerfume,
  deletePerfume,
  patchDescuentoPerfume,
  patchAgotadoPerfume,
  getAromas,
  addAroma,
  removeAroma,
  editAroma,
  getOcasiones,
  addOcasion,
  removeOcasion,
  editOcasion,
  getCategorias,
  addCategoria,
  removeCategoria,
  editCategoria,
  getPresentaciones,
  addPresentacion,
  removePresentacion,
  editPresentacion,
} from '../controller/perfume.controller';
import { requireAdmin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createPerfumeSchema, patchDescuentoSchema, patchAgotadoSchema, nombreSchema } from '../schemas/perfume.schema';

export const perfumeRouter = Router();

// Public read endpoints
perfumeRouter.get('/by-slug/:slug/related', getRelatedPerfumes);
perfumeRouter.get('/by-slug/:slug', getPerfumeBySlug);
perfumeRouter.get('/destacados', getDestacados);
perfumeRouter.get('/', selectAllPerfumes);
perfumeRouter.get('/tipos-aroma', getAromas);
perfumeRouter.get('/ocasiones', getOcasiones);
perfumeRouter.get('/categorias', getCategorias);

// Admin-only write endpoints
perfumeRouter.post('/create', requireAdmin, validate(createPerfumeSchema), createPerfume);
perfumeRouter.patch('/update/:id', requireAdmin, validate(createPerfumeSchema), editPerfume);
perfumeRouter.delete('/delete/:id', requireAdmin, deletePerfume);
perfumeRouter.patch('/:id/descuento', requireAdmin, validate(patchDescuentoSchema), patchDescuentoPerfume);
perfumeRouter.patch('/:id/agotado', requireAdmin, validate(patchAgotadoSchema), patchAgotadoPerfume);

perfumeRouter.post('/tipos-aroma', requireAdmin, validate(nombreSchema), addAroma);
perfumeRouter.delete('/tipos-aroma/:id', requireAdmin, removeAroma);
perfumeRouter.patch('/tipos-aroma/:id', requireAdmin, validate(nombreSchema), editAroma);

perfumeRouter.post('/ocasiones', requireAdmin, validate(nombreSchema), addOcasion);
perfumeRouter.delete('/ocasiones/:id', requireAdmin, removeOcasion);
perfumeRouter.patch('/ocasiones/:id', requireAdmin, validate(nombreSchema), editOcasion);

perfumeRouter.post('/categorias', requireAdmin, validate(nombreSchema), addCategoria);
perfumeRouter.delete('/categorias/:id', requireAdmin, removeCategoria);
perfumeRouter.patch('/categorias/:id', requireAdmin, validate(nombreSchema), editCategoria);

perfumeRouter.get('/presentaciones', getPresentaciones);
perfumeRouter.post('/presentaciones', requireAdmin, validate(nombreSchema), addPresentacion);
perfumeRouter.delete('/presentaciones/:id', requireAdmin, removePresentacion);
perfumeRouter.patch('/presentaciones/:id', requireAdmin, validate(nombreSchema), editPresentacion);
