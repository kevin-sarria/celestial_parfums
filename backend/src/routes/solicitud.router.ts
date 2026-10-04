import { Router } from 'express';
import { requireAdmin, requirePermiso, requirePersonal } from '../middleware/auth.middleware';
import { h } from '../middleware/error.middleware';
import { badRequest } from '../utils/httpError';
import * as repo from '../repositories/solicitud.repository';

/**
 * Lo que el personal pide y el dueño decide (ver `solicitud.repository.ts`).
 * Los descuentos se piden solos al registrar (`controlPrecio.ts`); aquí se
 * piden los borrados, se listan y se resuelven.
 */
export const solicitudRouter = Router();

solicitudRouter.get('/', requirePersonal, h(async (req, res) => {
  const estado = typeof req.query.estado === 'string' ? req.query.estado : undefined;
  res.json({ data: await repo.listarSolicitudes(req.jwtUser!.rol_id, req.jwtUser!.id, estado) });
}));

// Pedir que se borre: lo puede pedir quien puede registrar en ese módulo
solicitudRouter.post('/borrar-venta/:id', requirePermiso('ventas.registrar', 'ventas.editar'), h(async (req, res) => {
  const s = await repo.pedirBorrado('borrar_venta', Number(req.params.id), req.jwtUser!.id, String(req.body?.motivo ?? ''));
  res.status(201).json({ message: 'Se le pidió al dueño que la borre', data: { id: s.id } });
}));
solicitudRouter.post('/borrar-credito/:id', requirePermiso('creditos.registrar'), h(async (req, res) => {
  const s = await repo.pedirBorrado('borrar_credito', Number(req.params.id), req.jwtUser!.id, String(req.body?.motivo ?? ''));
  res.status(201).json({ message: 'Se le pidió al dueño que lo borre', data: { id: s.id } });
}));

solicitudRouter.post('/:id/:decision', requireAdmin, h(async (req, res) => {
  const decision = req.params.decision;
  if (decision !== 'aprobar' && decision !== 'rechazar') throw badRequest('Decisión inválida');
  const data = await repo.resolverSolicitud(Number(req.params.id), decision === 'aprobar', req.jwtUser!.id,
    typeof req.body?.respuesta === 'string' ? req.body.respuesta : undefined);
  res.json({ message: decision === 'aprobar' ? 'Solicitud aprobada' : 'Solicitud rechazada', data });
}));
