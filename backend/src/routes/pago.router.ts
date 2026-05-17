import { Router } from 'express';
import { getPagos, addPago, editPago, removePago, getTotalesPagos } from '../controller/pago.controller';
import { requireAdmin } from '../middleware/auth.middleware';

export const pagoRouter = Router();

pagoRouter.use(requireAdmin);

pagoRouter.get('/', getPagos);
pagoRouter.get('/totales', getTotalesPagos);
pagoRouter.post('/', addPago);
pagoRouter.patch('/:id', editPago);
pagoRouter.delete('/:id', removePago);
