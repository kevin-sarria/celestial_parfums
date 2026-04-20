import { Router } from 'express';
import { getRelatedCombos, getComboBySlug, getCombos, addCombo, editCombo, removeCombo, patchDescuentoCombo } from '../controller/combo.controller';

export const comboRouter = Router();

comboRouter.get('/by-slug/:slug/related', getRelatedCombos);
comboRouter.get('/by-slug/:slug', getComboBySlug);
comboRouter.get('/', getCombos);
comboRouter.post('/', addCombo);
comboRouter.patch('/:id', editCombo);
comboRouter.delete('/:id', removeCombo);
comboRouter.patch('/:id/descuento', patchDescuentoCombo);
