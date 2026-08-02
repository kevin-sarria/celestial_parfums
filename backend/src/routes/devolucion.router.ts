import { Router } from 'express';
import * as repo from '../repositories/devolucion.repository';
import { requireAdmin, requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { h } from '../middleware/error.middleware';
import { uploadMemoria } from '../config/upload';
import { uploadLimiter } from '../middleware/limiters';
import { guardarVariasWebp } from '../utils/imagenWebp';
import { borrarImagenSubida } from '../utils/imagenes';
import { getPublicBaseUrl } from '../utils/publicUrl';
import { badRequest } from '../utils/httpError';
import { devolucionSchema, devolucionEstadoSchema, MOTIVOS } from '../schemas/devolucion.schema';

/**
 * Devoluciones y reclamos de garantía.
 *
 * Dos mitades: el CLIENTE abre su caso desde el portal (nace `pendiente`, sin
 * plata: cuánto se devuelve lo decide el admin) y el ADMIN gestiona todo lo
 * demás. El orden importa: las rutas de cliente van ANTES del `requireAdmin`.
 */
export const devolucionRouter = Router();

// ── Portal del cliente ───────────────────────────────────────────────────────
/** Sus compras pagadas con el avance de los reclamos que ya abrió. */
devolucionRouter.get('/mis-compras', requireAuth, h(async (req, res) => {
  res.json({ data: await repo.misCompras(req.jwtUser!.id) });
}));

/** Abre un reclamo sobre una compra suya, con hasta 3 fotos (WebP livianas). */
devolucionRouter.post('/solicitar', requireAuth, uploadLimiter,
  uploadMemoria.array('imagenes', 3), h(async (req, res) => {
    const ventaId = Number(req.body.venta_id);
    const motivo = String(req.body.motivo ?? '');
    if (!ventaId) throw badRequest('Falta la compra');
    if (!(MOTIVOS as readonly string[]).includes(motivo)) throw badRequest('Elige un motivo válido');
    const detalle = (req.body.detalle ?? '').toString().trim().slice(0, 2000) || null;

    const files = (req.files as Express.Multer.File[]) ?? [];
    const imagenes = files.length
      ? await guardarVariasWebp(files.map((f) => f.buffer), getPublicBaseUrl(req))
      : [];

    let data;
    try {
      data = await repo.solicitarDevolucion(req.jwtUser!.id, ventaId, motivo, detalle, imagenes);
    } catch (err) {
      // Las fotos ya están en disco: si el reclamo no procede (no es su compra,
      // ya tenía uno abierto…) se borran o quedarían huérfanas para siempre.
      imagenes.forEach(borrarImagenSubida);
      throw err;
    }
    res.status(201).json({
      message: 'Recibimos tu solicitud. Te escribiremos por WhatsApp para resolverla.',
      data,
    });
  }));

// ── Admin ────────────────────────────────────────────────────────────────────
devolucionRouter.use(requireAdmin);

devolucionRouter.get('/', h(async (req, res) => {
  res.json({ data: await repo.listarDevoluciones(String(req.query.estado ?? 'todas')) });
}));

/** Ventas candidatas para enganchar una devolución (buscador del formulario). */
devolucionRouter.get('/ventas', h(async (req, res) => {
  res.json({ data: await repo.buscarVentasParaDevolucion(String(req.query.q ?? '').trim()) });
}));

devolucionRouter.get('/:id', h(async (req, res) => {
  res.json({ data: await repo.obtenerDevolucion(Number(req.params.id)) });
}));

devolucionRouter.post('/', validate(devolucionSchema), h(async (req, res) => {
  res.status(201).json({ message: 'Devolución registrada', data: await repo.crearDevolucion(req.body) });
}));

devolucionRouter.patch('/:id', validate(devolucionSchema), h(async (req, res) => {
  res.json({ message: 'Devolución actualizada', data: await repo.actualizarDevolucion(Number(req.params.id), req.body) });
}));

devolucionRouter.patch('/:id/estado', validate(devolucionEstadoSchema), h(async (req, res) => {
  res.json({ data: await repo.cambiarEstadoDevolucion(Number(req.params.id), req.body.estado) });
}));

devolucionRouter.delete('/:id', h(async (req, res) => {
  await repo.eliminarDevolucion(Number(req.params.id));
  res.json({ message: 'Devolución eliminada' });
}));
