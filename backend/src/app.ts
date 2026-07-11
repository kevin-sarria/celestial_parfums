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

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-import-key'],
}));

const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Demasiados intentos, intenta de nuevo en 15 minutos' } });

app.use(globalLimiter);
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (_req, res) => { res.json(swaggerSpec); });

app.get('/', (_req, res) => {
  res.send('Api Funcionando');
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
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

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err.message, { stack: err.stack });
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  logger.info(`Servidor corriendo en http://localhost:${PORT}`);
});
