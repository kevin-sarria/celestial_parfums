import { Router } from 'express';
import { getPagos, addPago, editPago, removePago, getTotalesPagos } from '../controller/pago.controller';
import { requireAdmin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createPagoSchema } from '../schemas/pago.schema';

export const pagoRouter = Router();

pagoRouter.use(requireAdmin);

pagoRouter.get('/', getPagos);
pagoRouter.get('/totales', getTotalesPagos);
pagoRouter.post('/', validate(createPagoSchema), addPago);
pagoRouter.patch('/:id', validate(createPagoSchema), editPago);
pagoRouter.delete('/:id', removePago);
