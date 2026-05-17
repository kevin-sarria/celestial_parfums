import { Router, Request, Response } from 'express';
import multer from 'multer';
import { importExcel } from '../services/import.service';

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

importRouter.post('/', upload.single('file'), async (req: Request, res: Response) => {
  const key = req.headers['x-import-key'];
  if (!process.env.IMPORT_KEY || key !== process.env.IMPORT_KEY) {
    res.status(401).json({ error: 'Clave de importación inválida o no configurada' });
    return;
  }

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
