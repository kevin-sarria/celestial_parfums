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
import { validate } from '../middleware/validate.middleware';
import { createPerfumeSchema, patchDescuentoSchema, patchAgotadoSchema, nombreSchema } from '../schemas/perfume.schema';

export const perfumeRouter = Router();

// Public read endpoints
perfumeRouter.get('/by-slug/:slug/related', getRelatedPerfumes);
perfumeRouter.get('/by-slug/:slug', getPerfumeBySlug);
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

perfumeRouter.post('/ocasiones', requireAdmin, validate(nombreSchema), addOcasion);
perfumeRouter.delete('/ocasiones/:id', requireAdmin, removeOcasion);

perfumeRouter.post('/categorias', requireAdmin, validate(nombreSchema), addCategoria);
perfumeRouter.delete('/categorias/:id', requireAdmin, removeCategoria);

perfumeRouter.get('/presentaciones', getPresentaciones);
perfumeRouter.post('/presentaciones', requireAdmin, validate(nombreSchema), addPresentacion);
perfumeRouter.delete('/presentaciones/:id', requireAdmin, removePresentacion);
