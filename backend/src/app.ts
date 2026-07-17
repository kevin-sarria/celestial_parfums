import dotenv from 'dotenv';
dotenv.config();
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import logger from './config/logger';
import { swaggerSpec } from './config/swagger';
import { perfumeRouter } from './routes/perfume.router';
import { authRouter } from './routes/auth.router';
import { uploadRouter } from './routes/upload.router';
import { comboRouter } from './routes/combo.router';
import { ventaRouter } from './routes/venta.router';
import { creditoRouter } from './routes/credito.router';
import { pagoRouter } from './routes/pago.router';
import { clienteRouter } from './routes/cliente.router';
import { empresaRouter } from './routes/empresa.router';
import { importRouter } from './routes/import.router';
import { contactoRouter } from './routes/contacto.router';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const isProduction = process.env.NODE_ENV === 'production';

// Detrás de un proxy inverso (nginx, etc.): confía en X-Forwarded-* para que
// req.protocol sea 'https' y las URLs de /uploads se construyan correctamente.
if (isProduction) app.set('trust proxy', true);

// Orígenes permitidos: FRONTEND_URL admite varios separados por coma
// (ej: https://www.celestialparfums.com,https://celestialparfums.com).
const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// En desarrollo se acepta cualquier puerto de localhost/127.0.0.1, porque
// Vite salta de puerto (5173 → 5174…) cuando el habitual está ocupado.
const isLocalhostOrigin = (origin: string) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

const corsOrigin = (
  origin: string | undefined,
  cb: (err: Error | null, allow?: boolean) => void,
) => {
  // Sin header Origin (curl, apps móviles, health checks) se permite.
  if (!origin) return cb(null, true);
  if (allowedOrigins.includes(origin)) return cb(null, true);
  if (!isProduction && isLocalhostOrigin(origin)) return cb(null, true);
  cb(new Error(`Origen no permitido por CORS: ${origin}`));
};

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-import-key'],
}));

const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Demasiados intentos, intenta de nuevo en 15 minutos' } });

app.use(globalLimiter);
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
// Las imágenes se sirven bajo /api/uploads para que en producción pasen por el
// mismo proxy que el resto de la API (nginx solo redirige /api al backend).
// Se mantiene /uploads por compatibilidad con URLs antiguas ya guardadas en BD.
const uploadsStatic = express.static(path.join(__dirname, '../public/uploads'));
app.use('/api/uploads', uploadsStatic);
app.use('/uploads', uploadsStatic);

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (_req, res) => { res.json(swaggerSpec); });

app.get('/', (_req, res) => {
  res.send('Api Funcionando');
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/google', authLimiter);
app.use('/api/parfums', perfumeRouter);
app.use('/api/auth', authRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/combos', comboRouter);
app.use('/api/ventas', ventaRouter);
app.use('/api/creditos', creditoRouter);
app.use('/api/pagos', pagoRouter);
app.use('/api/clientes', clienteRouter);
app.use('/api/empresas', empresaRouter);
app.use('/api/import', importRouter);
app.use('/api/contacto', contactoRouter);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err.message, { stack: err.stack });
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  logger.info(`Servidor corriendo en http://localhost:${PORT}`);
});
