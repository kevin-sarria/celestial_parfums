import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { h } from '../middleware/error.middleware';
import * as portalService from '../services/portal.service';
import { getDescuentosDisponibles, emitirCodigo } from '../services/anuncio.service';
import { getCodigo, misReferidos } from '../repositories/referido.repository';

/** Portal del cliente final: consulta de su crédito y sus cuotas. */
export const portalRouter = Router();

/** Programa de referidos: código propio + amigos invitados. */
portalRouter.get('/referidos', requireAuth, h(async (req, res) => {
  const userId = req.jwtUser!.id;
  const [codigo, referidos] = await Promise.all([getCodigo(userId), misReferidos(userId)]);
  res.json({ data: { codigo, referidos } });
}));

portalRouter.get('/credito', requireAuth, h(async (req, res) => {
  res.json({ data: await portalService.getPortalCredito(req.jwtUser!.id) });
}));

/** Cupones de descuento vigentes que este usuario aún no ha usado. */
portalRouter.get('/descuentos', requireAuth, h(async (req, res) => {
  res.json({ data: await getDescuentosDisponibles(req.jwtUser!.id) });
}));

/** Emite el código único del cupón al enviar el pedido (un solo uso). */
portalRouter.post('/descuentos/:id/codigo', requireAuth, h(async (req, res) => {
  const data = await emitirCodigo(req.jwtUser!.id, Number(req.params.id));
  res.status(201).json({ data: { codigo: data.codigo } });
}));
