import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../middleware/auth.middleware';
import { h } from '../middleware/error.middleware';
import { validate } from '../middleware/validate.middleware';
import { aplicarPrecios, listarOriginales, ponerMeta } from '../precios/preciosOriginales.repository';
import { bustCatalogoCache } from '../services/perfume.service';

/** PRECIOS DE LOS ORIGINALES (2026-10-04). Costo y margen: solo el dueño. */
export const preciosRouter = Router();
preciosRouter.use(requireAdmin);

const metaSchema = z.object({
  meta: z.object({ tipo: z.enum(['porcentaje', 'pesos']), valor: z.number().positive().max(10_000_000) }).nullable(),
});
const preciosSchema = z.object({
  precios: z.array(z.object({
    perfume_id: z.number().int().positive(),
    presentacion_id: z.number().int().positive(),
    precio: z.number().int().positive().max(100_000_000),
  })).min(1).max(1000),
});

preciosRouter.get('/', h(async (_req, res) => { res.json({ data: await listarOriginales() }); }));

preciosRouter.patch('/:id/meta', validate(metaSchema), h(async (req, res) => {
  await ponerMeta(Number(req.params.id), req.body.meta);
  res.json({ message: req.body.meta ? 'Meta propia guardada' : 'Vuelve a la meta general', data: await listarOriginales() });
}));

preciosRouter.patch('/precios', validate(preciosSchema), h(async (req, res) => {
  const n = await aplicarPrecios(req.body.precios);
  // Los decants que estaban en $0 aparecen en la tienda: el catálogo cambió
  bustCatalogoCache();
  res.json({ message: `${n} precio(s) guardado(s)`, data: await listarOriginales() });
}));
