import { Router } from 'express';
import {
  getRelatedPerfumes,
  getPerfumeBySlug,
  selectAllPerfumes,
  createPerfume,
  editPerfume,
  deletePerfume,
  patchDescuentoPerfume,
  getAromas,
  addAroma,
  removeAroma,
  getOcasiones,
  addOcasion,
  removeOcasion,
  getCategorias,
  addCategoria,
  removeCategoria,
} from '../controller/perfume.controller';

export const perfumeRouter = Router();

perfumeRouter.get('/by-slug/:slug/related', getRelatedPerfumes);
perfumeRouter.get('/by-slug/:slug', getPerfumeBySlug);
perfumeRouter.get('/', selectAllPerfumes);
perfumeRouter.post('/create', createPerfume);
perfumeRouter.patch('/update/:id', editPerfume);
perfumeRouter.delete('/delete/:id', deletePerfume);
perfumeRouter.patch('/:id/descuento', patchDescuentoPerfume);

perfumeRouter.get('/tipos-aroma', getAromas);
perfumeRouter.post('/tipos-aroma', addAroma);
perfumeRouter.delete('/tipos-aroma/:id', removeAroma);

perfumeRouter.get('/ocasiones', getOcasiones);
perfumeRouter.post('/ocasiones', addOcasion);
perfumeRouter.delete('/ocasiones/:id', removeOcasion);

perfumeRouter.get('/categorias', getCategorias);
perfumeRouter.post('/categorias', addCategoria);
perfumeRouter.delete('/categorias/:id', removeCategoria);
