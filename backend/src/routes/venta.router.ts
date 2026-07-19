import { Router } from 'express';
import { getVentas, addVenta, editVenta, removeVenta, getTotales, relinkPerfumes } from '../controller/venta.controller';
import { requireAdmin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createVentaSchema } from '../schemas/venta.schema';

export const ventaRouter = Router();

ventaRouter.use(requireAdmin);

ventaRouter.get('/', getVentas);
ventaRouter.get('/totales', getTotales);
ventaRouter.post('/', validate(createVentaSchema), addVenta);
ventaRouter.post('/enlazar-perfumes', relinkPerfumes);
ventaRouter.patch('/:id', validate(createVentaSchema), editVenta);
ventaRouter.delete('/:id', removeVenta);
