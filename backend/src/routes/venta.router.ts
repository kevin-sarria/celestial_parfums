import { Router } from 'express';
import { getVentas, addVenta, editVenta, removeVenta, getTotales } from '../controller/venta.controller';
import { requireAdmin } from '../middleware/auth.middleware';

export const ventaRouter = Router();

ventaRouter.use(requireAdmin);

ventaRouter.get('/', getVentas);
ventaRouter.get('/totales', getTotales);
ventaRouter.post('/', addVenta);
ventaRouter.patch('/:id', editVenta);
ventaRouter.delete('/:id', removeVenta);
