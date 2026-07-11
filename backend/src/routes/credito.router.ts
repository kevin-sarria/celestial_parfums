import { Router } from 'express';
import { getCreditos, addCredito, addAbono, removeAbono, removeCredito } from '../controller/credito.controller';
import { requireAdmin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createCreditoSchema, addAbonoSchema } from '../schemas/credito.schema';

export const creditoRouter = Router();

creditoRouter.use(requireAdmin);

creditoRouter.get('/', getCreditos);
creditoRouter.post('/', validate(createCreditoSchema), addCredito);
creditoRouter.patch('/:id/abono', validate(addAbonoSchema), addAbono);
creditoRouter.delete('/:id/abono/:abonoId', removeAbono);
creditoRouter.delete('/:id', removeCredito);
