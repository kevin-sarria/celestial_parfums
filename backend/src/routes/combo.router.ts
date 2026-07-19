import { Router } from 'express';
import { getRelatedCombos, getComboBySlug, getCombos, addCombo, editCombo, removeCombo, patchDescuentoCombo } from '../controller/combo.controller';
import { requireAdmin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createComboSchema, patchDescuentoComboSchema } from '../schemas/combo.schema';

export const comboRouter = Router();

// Public read endpoints
comboRouter.get('/by-slug/:slug/related', getRelatedCombos);
comboRouter.get('/by-slug/:slug', getComboBySlug);
comboRouter.get('/', getCombos);

// Admin-only write endpoints
comboRouter.post('/', requireAdmin, validate(createComboSchema), addCombo);
comboRouter.patch('/:id', requireAdmin, validate(createComboSchema), editCombo);
comboRouter.delete('/:id', requireAdmin, removeCombo);
comboRouter.patch('/:id/descuento', requireAdmin, validate(patchDescuentoComboSchema), patchDescuentoCombo);
