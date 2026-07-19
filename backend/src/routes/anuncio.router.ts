import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.middleware';
import { h } from '../middleware/error.middleware';
import { validate } from '../middleware/validate.middleware';
import { createAnuncioSchema, estadoCodigoSchema } from '../schemas/anuncio.schema';
import * as anuncioService from '../services/anuncio.service';

/** Publicidad: ventanas emergentes del catálogo y cupones de descuento. */
export const anuncioRouter = Router();

// Público: anuncios activos y vigentes (el frontend filtra por audiencia)
anuncioRouter.get('/', h(async (_req, res) => {
  res.json({ data: await anuncioService.getAnunciosPublicos() });
}));

// ── Códigos únicos de descuento ─────────────────────────────────────────────
// (antes de las rutas /:id para que "codigos" no se interprete como id)

// Admin: certificar si un código recibido por WhatsApp es real
anuncioRouter.get('/codigos/:codigo', requireAdmin, h(async (req, res) => {
  res.json({ data: await anuncioService.validarCodigo(String(req.params.codigo)) });
}));

// Admin: anular o reactivar un código
anuncioRouter.patch('/codigos/:codigo', requireAdmin, validate(estadoCodigoSchema), h(async (req, res) => {
  await anuncioService.setEstadoCodigo(String(req.params.codigo), req.body.estado);
  res.json({ message: req.body.estado === 'anulado' ? 'Código anulado' : 'Código reactivado' });
}));

// Público: visitante sin cuenta pide su código único al enviar el pedido
anuncioRouter.post('/:id/codigo', h(async (req, res) => {
  const data = await anuncioService.emitirCodigoAnonimo(Number(req.params.id));
  res.status(201).json({ data: { codigo: data.codigo } });
}));

// Admin
anuncioRouter.get('/admin', requireAdmin, h(async (_req, res) => {
  res.json({ data: await anuncioService.getAnunciosAdmin() });
}));

anuncioRouter.post('/', requireAdmin, validate(createAnuncioSchema), h(async (req, res) => {
  const data = await anuncioService.createAnuncio(req.body);
  res.status(201).json({ message: 'Anuncio creado', data });
}));

anuncioRouter.patch('/:id', requireAdmin, validate(createAnuncioSchema), h(async (req, res) => {
  const data = await anuncioService.updateAnuncio(Number(req.params.id), req.body);
  res.json({ message: 'Anuncio actualizado', data });
}));

anuncioRouter.delete('/:id', requireAdmin, h(async (req, res) => {
  await anuncioService.deleteAnuncio(Number(req.params.id));
  res.json({ message: 'Anuncio eliminado' });
}));
