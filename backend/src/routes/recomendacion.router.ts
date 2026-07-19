import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { h } from '../middleware/error.middleware';
import { validate } from '../middleware/validate.middleware';
import { filtrosRecomendacionSchema } from '../schemas/recomendacion.schema';
import * as recomendacionService from '../services/recomendacion.service';

/** "Tu perfume ideal": quiz + recomendaciones guardadas (solo registrados). */
export const recomendacionRouter = Router();

// El cálculo guardado del usuario (null si todavía no hace el quiz)
recomendacionRouter.get('/', requireAuth, h(async (req, res) => {
  res.json({ data: await recomendacionService.getRecomendacion(req.jwtUser!.id) });
}));

// Calcular (o recalcular al cambiar respuestas) y guardar
recomendacionRouter.post('/', requireAuth, validate(filtrosRecomendacionSchema), h(async (req, res) => {
  const data = await recomendacionService.calcularRecomendaciones(req.jwtUser!.id, req.body);
  res.status(201).json({ data });
}));
