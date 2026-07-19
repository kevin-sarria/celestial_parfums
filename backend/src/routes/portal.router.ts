import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { h } from '../middleware/error.middleware';
import * as portalService from '../services/portal.service';
import { getDescuentosDisponibles, emitirCodigo } from '../services/anuncio.service';

/** Portal del cliente final: consulta de su crédito y sus cuotas. */
export const portalRouter = Router();

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
