import { Router } from 'express';
import { getCreditos, addCredito, addAbono, removeCredito } from '../controller/credito.controller';
import { requireAdmin } from '../middleware/auth.middleware';

export const creditoRouter = Router();

creditoRouter.use(requireAdmin);

creditoRouter.get('/', getCreditos);
creditoRouter.post('/', addCredito);
creditoRouter.patch('/:id/abono', addAbono);
creditoRouter.delete('/:id', removeCredito);
