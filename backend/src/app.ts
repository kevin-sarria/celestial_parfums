import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import path from 'path';
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
const PORT = 4000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

app.get('/', (_req, res) => {
  res.send('Api Funcionando');
});

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

app.listen(PORT, () => {
  console.log('Servidor corriendo correctamente.');
  console.log(`http://localhost:${PORT}`);
});
