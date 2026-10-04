import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requirePermiso } from '../middleware/auth.middleware';
import { h } from '../middleware/error.middleware';
import { validate } from '../middleware/validate.middleware';
import { guardarEmpaqueDeLinea, leerEmpaque } from '../empaque/empaque.repository';

/**
 * EL EMPAQUE POR LÍNEA Y TALLA (2026-10-04). Lo lee quien registra ventas o
 * créditos (el formulario ofrece el empaque con eso); lo cambia solo el dueño.
 */
export const empaqueRouter = Router();

const LINEAS = ['contratipo', 'uno_uno', 'decant', 'botella_completa', 'producto'] as const;

const empaqueLineaSchema = z.object({
  linea: z.enum(LINEAS),
  filas: z.array(z.object({
    presentacion_id: z.number().int().positive().nullable(),
    perfume_id: z.number().int().positive(),
    cantidad: z.number().int().min(0).max(50),
  })).max(200),
});

empaqueRouter.get('/', requirePermiso('ventas.registrar', 'creditos.registrar'), h(async (_req, res) => {
  res.json({ data: await leerEmpaque() });
}));

empaqueRouter.patch('/', requireAdmin, validate(empaqueLineaSchema), h(async (req, res) => {
  res.json({ message: 'Empaque guardado', data: await guardarEmpaqueDeLinea(req.body.linea, req.body.filas) });
}));
