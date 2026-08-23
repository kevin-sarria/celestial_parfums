import { Router } from 'express';
import { getPagos, addPago, editPago, removePago, getTotalesPagos } from '../controller/pago.controller';
import { requireAdmin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createPagoSchema, configIvaSchema } from '../schemas/pago.schema';
import * as repo from '../repositories/pago.repository';
import { uploadSoportes } from '../config/upload';
import { uploadLimiter } from '../middleware/limiters';
import { guardarSoportes } from '../utils/soporteArchivo';
import { getPublicBaseUrl } from '../utils/publicUrl';
import { h } from '../middleware/error.middleware';
import { badRequest } from '../utils/httpError';

export const pagoRouter = Router();

pagoRouter.use(requireAdmin);

pagoRouter.get('/', getPagos);
pagoRouter.get('/totales', getTotalesPagos);

/**
 * Configuración tributaria: la tasa vigente y si el negocio descuenta el IVA.
 * La necesita el formulario de compra para mostrar la cuenta antes de guardar.
 */
pagoRouter.get('/config-iva', h(async (_req, res) => {
  res.json({ data: await repo.getConfigTributaria() });
}));

pagoRouter.patch('/config-iva', validate(configIvaSchema), h(async (req, res) => {
  res.json({ message: 'Configuración guardada', data: await repo.setConfigTributaria(req.body) });
}));
/** Sube las facturas/remisiones (imágenes o PDF) y devuelve sus URLs. */
pagoRouter.post('/soportes', uploadLimiter, uploadSoportes.array('archivos', 10), h(async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) throw badRequest('No llegó ningún archivo');
  const urls = await guardarSoportes(files, getPublicBaseUrl(req));
  res.status(201).json({ data: urls });
}));

pagoRouter.post('/', validate(createPagoSchema), addPago);
pagoRouter.patch('/:id', validate(createPagoSchema), editPago);
pagoRouter.delete('/:id', removePago);
