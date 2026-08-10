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
  patchDescuentoCategoria,
  patchEsenciaMasiva,
  getSugerenciasEsencia,
  getEmparejarEsencias,
  postEmparejarEsencias,
  patchEnlacesEsencia,
  patchAgotadoPerfume,
  patchPublicadoPerfume,
  getResumenPublicacion,
  getImagenProxy,
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
  getPrecios,
  putPrecio,
} from '../controller/perfume.controller';
import { requireAdmin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createPerfumeSchema, patchDescuentoSchema, patchDescuentoCategoriaSchema, asignarEsenciaMasivaSchema, enlacesEsenciaSchema, emparejarEsenciasSchema, patchAgotadoSchema, patchPublicadoSchema, nombreSchema, precioListaSchema } from '../schemas/perfume.schema';

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
perfumeRouter.patch('/descuento/por-categoria', requireAdmin, validate(patchDescuentoCategoriaSchema), patchDescuentoCategoria);
perfumeRouter.patch('/:id/descuento', requireAdmin, validate(patchDescuentoSchema), patchDescuentoPerfume);
perfumeRouter.get('/esencia/sugerencias', requireAdmin, getSugerenciasEsencia);
// Puesta al día: las esencias que todavía no tienen su perfume en el catálogo
perfumeRouter.get('/esencia/emparejar', requireAdmin, getEmparejarEsencias);
perfumeRouter.post('/esencia/emparejar', requireAdmin, validate(emparejarEsenciasSchema), postEmparejarEsencias);
perfumeRouter.patch('/esencia/enlaces', requireAdmin, validate(enlacesEsenciaSchema), patchEnlacesEsencia);
perfumeRouter.patch('/esencia/masiva', requireAdmin, validate(asignarEsenciaMasivaSchema), patchEsenciaMasiva);
perfumeRouter.patch('/:id/agotado', requireAdmin, validate(patchAgotadoSchema), patchAgotadoPerfume);
// Sacar de la tienda / devolver a la tienda (distinto de agotado: desaparece)
perfumeRouter.patch('/:id/publicado', requireAdmin, validate(patchPublicadoSchema), patchPublicadoPerfume);
perfumeRouter.get('/resumen-publicacion', requireAdmin, getResumenPublicacion);
// Trae una foto alojada en otro sitio para que el PDF pueda imprimirla
perfumeRouter.get('/imagen-proxy', requireAdmin, getImagenProxy);

perfumeRouter.post('/tipos-aroma', requireAdmin, validate(nombreSchema), addAroma);
perfumeRouter.delete('/tipos-aroma/:id', requireAdmin, removeAroma);
perfumeRouter.patch('/tipos-aroma/:id', requireAdmin, validate(nombreSchema), editAroma);

perfumeRouter.post('/ocasiones', requireAdmin, validate(nombreSchema), addOcasion);
perfumeRouter.delete('/ocasiones/:id', requireAdmin, removeOcasion);
perfumeRouter.patch('/ocasiones/:id', requireAdmin, validate(nombreSchema), editOcasion);

perfumeRouter.post('/categorias', requireAdmin, validate(nombreSchema), addCategoria);
perfumeRouter.delete('/categorias/:id', requireAdmin, removeCategoria);
perfumeRouter.patch('/categorias/:id', requireAdmin, validate(nombreSchema), editCategoria);

// Lista de precios: qué vale cada presentación en cada categoría
perfumeRouter.get('/precios', requireAdmin, getPrecios);
perfumeRouter.patch('/precios', requireAdmin, validate(precioListaSchema), putPrecio);

perfumeRouter.get('/presentaciones', getPresentaciones);
perfumeRouter.post('/presentaciones', requireAdmin, validate(nombreSchema), addPresentacion);
perfumeRouter.delete('/presentaciones/:id', requireAdmin, removePresentacion);
perfumeRouter.patch('/presentaciones/:id', requireAdmin, validate(nombreSchema), editPresentacion);
