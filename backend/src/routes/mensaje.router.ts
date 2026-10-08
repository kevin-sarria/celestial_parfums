import { Router } from 'express';
import { requireAdmin, requirePermiso } from '../middleware/auth.middleware';
import { h } from '../middleware/error.middleware';
import { validate } from '../middleware/validate.middleware';
import { plantillaMensajeSchema } from '../schemas/mensaje.schema';
import * as mensajeService from '../services/mensaje.service';

/**
 * El maestro de mensajes (ver `docs/...`, 2026-10-04).
 *
 * Escribirlos es solo del dueño: son sus palabras y salen a nombre del negocio.
 * LEERLOS lo necesita también quien cobra —el botón de recordar el pago vive en
 * Créditos—, así que el listado pide permiso de créditos y no ser dueño.
 */
export const mensajeRouter = Router();

mensajeRouter.get('/', requirePermiso('creditos.ver', 'creditos.registrar', 'ventas.ver', 'clientes.ver', 'inventario.ver'), h(async (req, res) => {
  const caso = typeof req.query.caso === 'string' && req.query.caso ? req.query.caso : null;
  res.json({ data: caso ? await mensajeService.listar(caso) : await mensajeService.listarTodas() });
}));

mensajeRouter.post('/', requireAdmin, validate(plantillaMensajeSchema), h(async (req, res) => {
  const data = await mensajeService.crear(req.body);
  res.status(201).json({ message: 'Mensaje guardado', data });
}));

mensajeRouter.patch('/:id', requireAdmin, validate(plantillaMensajeSchema), h(async (req, res) => {
  const data = await mensajeService.actualizar(Number(req.params.id), req.body);
  res.json({ message: 'Mensaje actualizado', data });
}));

mensajeRouter.delete('/:id', requireAdmin, h(async (req, res) => {
  await mensajeService.borrar(Number(req.params.id));
  res.json({ message: 'Mensaje eliminado' });
}));
