import { Router } from 'express';
import { getVentas, addVenta, editVenta, removeVenta, getTotales, relinkPerfumes, getPorMes } from '../controller/venta.controller';
import { requireAdmin, requirePermiso } from '../middleware/auth.middleware';
import { controlPrecio } from '../middleware/controlPrecio';
import { validate } from '../middleware/validate.middleware';
import { createVentaSchema } from '../schemas/venta.schema';

export const ventaRouter = Router();

// Cada ruta con su permiso (2026-10-04): el personal entra según su rol, y lo
// que no tiene permiso propio sigue siendo solo del dueño. Los costos y la
// ganancia de estas respuestas los esconde `ocultarCostos` a quien no puede verlos.
ventaRouter.get('/', requirePermiso('ventas.ver'), getVentas);
ventaRouter.get('/totales', requirePermiso('ventas.ver'), getTotales);
ventaRouter.get('/por-mes', requirePermiso('ventas.ver'), getPorMes);
ventaRouter.post('/', requirePermiso('ventas.registrar'), validate(createVentaSchema), controlPrecio('venta', 'registrar'), addVenta);
ventaRouter.post('/enlazar-perfumes', requireAdmin, relinkPerfumes);
ventaRouter.patch('/:id', requirePermiso('ventas.editar'), validate(createVentaSchema), controlPrecio('venta', 'corregir'), editVenta);
// Sin este permiso no se borra: se PIDE en /api/solicitudes y decide el dueño
ventaRouter.delete('/:id', requirePermiso('ventas.borrar'), removeVenta);
