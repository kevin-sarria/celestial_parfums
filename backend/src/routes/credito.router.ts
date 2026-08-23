import { Router } from 'express';
import { getCreditos, getTotales, addCredito, editCredito, addAbono, removeAbono, removeCredito } from '../controller/credito.controller';
import { requireAdmin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createCreditoSchema, addAbonoSchema } from '../schemas/credito.schema';

export const creditoRouter = Router();

creditoRouter.use(requireAdmin);

creditoRouter.get('/', getCreditos);
// Va antes que cualquier ruta con :id para que "totales" no se lea como un id
creditoRouter.get('/totales', getTotales);
creditoRouter.post('/', validate(createCreditoSchema), addCredito);
creditoRouter.patch('/:id/abono', validate(addAbonoSchema), addAbono);
creditoRouter.patch('/:id', validate(createCreditoSchema), editCredito);
creditoRouter.delete('/:id/abono/:abonoId', removeAbono);
creditoRouter.delete('/:id', removeCredito);
