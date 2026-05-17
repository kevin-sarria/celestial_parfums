import { Router } from 'express';
import { getRelatedCombos, getComboBySlug, getCombos, addCombo, editCombo, removeCombo, patchDescuentoCombo } from '../controller/combo.controller';
import { requireAdmin } from '../middleware/auth.middleware';

export const comboRouter = Router();

// Public read endpoints
comboRouter.get('/by-slug/:slug/related', getRelatedCombos);
comboRouter.get('/by-slug/:slug', getComboBySlug);
comboRouter.get('/', getCombos);

// Admin-only write endpoints
comboRouter.post('/', requireAdmin, addCombo);
comboRouter.patch('/:id', requireAdmin, editCombo);
comboRouter.delete('/:id', requireAdmin, removeCombo);
comboRouter.patch('/:id/descuento', requireAdmin, patchDescuentoCombo);
