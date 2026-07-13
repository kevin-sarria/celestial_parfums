import { Router, Request, Response } from 'express';
import multer from 'multer';
import { importExcel, importEntity, buildTemplate, exportEntity } from '../services/import.service';
import { IMPORT_SPECS } from '../schemas/import.spec';
import { requireAdmin } from '../middleware/auth.middleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.originalname.toLowerCase().endsWith('.xlsx') ||
      file.mimetype.includes('spreadsheetml') ||
      file.mimetype.includes('spreadsheet');
    ok ? cb(null, true) : cb(new Error('Solo se permiten archivos .xlsx'));
  },
});

export const importRouter = Router();

importRouter.post('/', requireAdmin, upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'Debes adjuntar el archivo Excel con el campo "file"' });
    return;
  }

  try {
    const result = await importExcel(req.file.buffer);
    const hayErrores = result.errores.length > 0;
    res.status(hayErrores ? 207 : 200).json({
      ok: !hayErrores,
      importados: {
        ventas:           result.ventas,
        clientes_creados: result.clientes_creados,
        creditos:         result.creditos,
        empresas_creadas: result.empresas_creadas,
        pagos:            result.pagos,
      },
      errores: result.errores,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** Estructura de columnas que espera la importacion de una entidad. */
importRouter.get('/:entity/spec', requireAdmin, (req: Request, res: Response) => {
  const entity = String(req.params.entity);
  const spec = IMPORT_SPECS[entity];
  if (!spec) {
    res.status(404).json({ error: 'Entidad no soportada para importacion' });
    return;
  }
  res.json({ data: { entity, ...spec } });
});

/** Descarga la plantilla Excel (.xlsx) para la entidad. */
importRouter.get('/:entity/template', requireAdmin, (req: Request, res: Response) => {
  const entity = String(req.params.entity);
  if (!IMPORT_SPECS[entity]) {
    res.status(404).json({ error: 'Entidad no soportada para importacion' });
    return;
  }
  const buffer = buildTemplate(entity);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="plantilla_${entity}.xlsx"`);
  res.send(buffer);
});

/** Exporta los datos actuales de la entidad en Excel con la estructura de la plantilla. */
importRouter.get('/:entity/export', requireAdmin, async (req: Request, res: Response) => {
  const entity = String(req.params.entity);
  if (!IMPORT_SPECS[entity]) {
    res.status(404).json({ error: 'Entidad no soportada para exportacion' });
    return;
  }
  try {
    const buffer = await exportEntity(entity);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="export_${entity}.xlsx"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** Importa masivamente una entidad desde un archivo Excel (.xlsx). */
importRouter.post('/:entity', requireAdmin, upload.single('file'), async (req: Request, res: Response) => {
  const entity = String(req.params.entity);
  if (!IMPORT_SPECS[entity]) {
    res.status(404).json({ error: 'Entidad no soportada para importacion' });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: 'Debes adjuntar el archivo Excel con el campo "file"' });
    return;
  }
  try {
    const result = await importEntity(entity, req.file.buffer);
    const hayErrores = result.errores.length > 0;
    res.status(hayErrores ? 207 : 200).json({ ok: !hayErrores, entity, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
