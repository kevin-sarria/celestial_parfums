import multer from 'multer';
import path from 'path';
import fs from 'fs';

export const uploadsDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!file.mimetype.startsWith('image/') || !ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error('Solo se permiten imágenes (jpg, png, gif, webp)'));
    }
    cb(null, true);
  },
});

/**
 * Subida EN MEMORIA (no a disco): las fotos se procesan con sharp → WebP antes
 * de guardarlas. Se usa para reseñas y pruebas de premio (varias fotos livianas).
 */
export const uploadMemoria = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB de origen; sharp la deja livianísima
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Solo se permiten imágenes'));
    cb(null, true);
  },
});

/**
 * Soportes de compras a proveedores: fotos de la factura o el PDF que manda la
 * distribuidora. Va en memoria para que las imágenes pasen por sharp.
 *
 * Doble candado a propósito: se valida el mimetype **y** la extensión. Con solo
 * uno, un archivo llamado `factura.pdf` con contenido de otra cosa (o al revés)
 * podría colarse. Nada de SVG: admite scripts.
 */
const SOPORTE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

export const uploadSoportes = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const esImagen = file.mimetype.startsWith('image/') && file.mimetype !== 'image/svg+xml';
    const esPdf = file.mimetype === 'application/pdf' && ext === '.pdf';
    if (!SOPORTE_EXT.includes(ext) || !(esImagen || esPdf)) {
      return cb(new Error('Solo se permiten imágenes (jpg, png, webp) o PDF'));
    }
    cb(null, true);
  },
});
