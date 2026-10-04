import { Router } from 'express';
import { getCreditos, getTotales, addCredito, editCredito, addAbono, removeAbono, removeCredito } from '../controller/credito.controller';
import { requirePermiso } from '../middleware/auth.middleware';
import { controlPrecio } from '../middleware/controlPrecio';
import { validate } from '../middleware/validate.middleware';
import { createCreditoSchema, addAbonoSchema } from '../schemas/credito.schema';

export const creditoRouter = Router();

// Cada ruta con su permiso (2026-10-04, ver `permisos/catalogo.ts`)
creditoRouter.get('/', requirePermiso('creditos.ver'), getCreditos);
// Va antes que cualquier ruta con :id para que "totales" no se lea como un id
creditoRouter.get('/totales', requirePermiso('creditos.ver'), getTotales);
creditoRouter.post('/', requirePermiso('creditos.registrar'), validate(createCreditoSchema), controlPrecio('credito', 'registrar'), addCredito);
creditoRouter.patch('/:id/abono', requirePermiso('creditos.abonar'), validate(addAbonoSchema), addAbono);
creditoRouter.patch('/:id', requirePermiso('creditos.registrar'), validate(createCreditoSchema), controlPrecio('credito', 'corregir'), editCredito);
creditoRouter.delete('/:id/abono/:abonoId', requirePermiso('creditos.borrar'), removeAbono);
// Sin este permiso no se borra: se PIDE en /api/solicitudes y decide el dueño
creditoRouter.delete('/:id', requirePermiso('creditos.borrar'), removeCredito);
