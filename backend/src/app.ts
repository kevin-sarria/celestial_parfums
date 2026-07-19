import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import compression from 'compression';
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
import { empresaRouter } from './routes/empresa.router';
import { importRouter } from './routes/import.router';
import { contactoRouter } from './routes/contacto.router';
import { portalRouter } from './routes/portal.router';
import { usuarioRouter } from './routes/usuario.router';
import { anuncioRouter } from './routes/anuncio.router';
import { recomendacionRouter } from './routes/recomendacion.router';
import { seoRouter } from './routes/seo.router';
import { errorHandler } from './middleware/error.middleware';

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

// Comprime las respuestas JSON (el catálogo completo pasa de cientos de KB a decenas)
app.use(compression());

// Las imágenes se sirven bajo /api/uploads para que en producción pasen por el
// mismo proxy que el resto de la API (nginx solo redirige /api al backend).
// Se mantiene /uploads por compatibilidad con URLs antiguas ya guardadas en BD.
// Van ANTES del rate limiter (una página con muchas fotos no debe gastar el cupo
// de la API) y con caché larga: el nombre de archivo es único, nunca cambia.
const uploadsStatic = express.static(path.join(__dirname, '../public/uploads'), {
  maxAge: '30d',
  immutable: true,
});
app.use('/api/uploads', uploadsStatic);
app.use('/uploads', uploadsStatic);

// SEO: páginas de producto con Open Graph, sitemap y robots (nginx las proxya
// aquí). Antes del limiter: los rastreadores no gastan el cupo de la API.
app.use(seoRouter);

app.use(globalLimiter);
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));

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
app.use('/api/empresas', empresaRouter);
app.use('/api/import', importRouter);
app.use('/api/contacto', contactoRouter);
app.use('/api/portal', portalRouter);
app.use('/api/usuarios', usuarioRouter);
app.use('/api/anuncios', anuncioRouter);
app.use('/api/recomendaciones', recomendacionRouter);

// Middleware central de errores: HttpError responde con su status semántico
// (404/409...), un Error de servicio mantiene el 400 histórico.
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Servidor corriendo en http://localhost:${PORT}`);
});
