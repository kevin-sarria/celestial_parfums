import { Router } from 'express';
import multer from 'multer';
import { importExcel, importEntity, buildTemplate, exportEntity, bustImportCache } from '../services/import.service';
import { IMPORT_SPECS } from '../schemas/import.spec';
import { requireAdmin } from '../middleware/auth.middleware';
import { h } from '../middleware/error.middleware';
import { badRequest, notFound } from '../utils/httpError';

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

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const specDe = (entity: string) => {
  const spec = IMPORT_SPECS[entity];
  if (!spec) throw notFound('Entidad no soportada para importacion');
  return spec;
};

export const importRouter = Router();

importRouter.post('/', requireAdmin, upload.single('file'), h(async (req, res) => {
  if (!req.file) throw badRequest('Debes adjuntar el archivo Excel con el campo "file"');
  const result = await importExcel(req.file.buffer);
  bustImportCache();
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
}));

/** Estructura de columnas que espera la importacion de una entidad. */
importRouter.get('/:entity/spec', requireAdmin, h(async (req, res) => {
  const entity = String(req.params.entity);
  res.json({ data: { entity, ...specDe(entity) } });
}));

/** Descarga la plantilla Excel (.xlsx) para la entidad. */
importRouter.get('/:entity/template', requireAdmin, h(async (req, res) => {
  const entity = String(req.params.entity);
  specDe(entity);
  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="plantilla_${entity}.xlsx"`);
  res.send(buildTemplate(entity));
}));

/** Exporta los datos actuales de la entidad en Excel con la estructura de la plantilla. */
importRouter.get('/:entity/export', requireAdmin, h(async (req, res) => {
  const entity = String(req.params.entity);
  specDe(entity);
  const buffer = await exportEntity(entity);
  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="export_${entity}.xlsx"`);
  res.send(buffer);
}));

/** Importa masivamente una entidad desde un archivo Excel (.xlsx). */
importRouter.post('/:entity', requireAdmin, upload.single('file'), h(async (req, res) => {
  const entity = String(req.params.entity);
  specDe(entity);
  if (!req.file) throw badRequest('Debes adjuntar el archivo Excel con el campo "file"');
  const result = await importEntity(entity, req.file.buffer);
  bustImportCache();
  const hayErrores = result.errores.length > 0;
  res.status(hayErrores ? 207 : 200).json({ ok: !hayErrores, entity, ...result });
}));
