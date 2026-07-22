import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import { createGzip } from 'zlib';
import fs from 'fs';
import path from 'path';
import { requireAdmin } from '../middleware/auth.middleware';
import { generarSecretoBase32, otpauthUrl, verificarTotp } from '../utils/totp';
import logger from '../config/logger';

/**
 * Copia de seguridad de la base de datos: exporta el SQL COMPLETO (estructura
 * y datos, mysqldump) comprimido, directo al navegador del administrador — el
 * respaldo vive fuera del servidor, que es el punto: si el servidor muere, la
 * copia no.
 *
 * Doble candado: además de la sesión de admin exige un código TOTP de app
 * authenticator (información ultra sensible). Una vez configurado, el TOTP NO
 * puede resetearse desde la web: quitar el archivo backups/totp.json exige
 * acceso SSH al servidor. Aunque roben la contraseña del admin, sin el
 * teléfono no hay copia.
 */
export const backupRouter = Router();

const dataDir = path.join(__dirname, '../../backups');
const marcaFile = path.join(dataDir, 'ultima.json');
const totpFile = path.join(dataDir, 'totp.json');

const leerJson = <T>(file: string): T | null => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
};

const escribirJson = (file: string, data: unknown) => {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
};

const leerSecreto = () => leerJson<{ secret: string }>(totpFile)?.secret ?? null;

backupRouter.get('/estado', requireAdmin, (_req: Request, res: Response) => {
  res.json({
    data: {
      ultima: leerJson<{ fecha: string }>(marcaFile)?.fecha ?? null,
      totp_configurado: leerSecreto() !== null,
    },
  });
});

/** Configura el authenticator UNA sola vez; el secreto se muestra una única vez. */
backupRouter.post('/totp/setup', requireAdmin, (_req: Request, res: Response) => {
  if (leerSecreto()) {
    res.status(409).json({
      error: 'El authenticator ya está configurado; para restablecerlo elimina backups/totp.json en el servidor',
    });
    return;
  }
  const secret = generarSecretoBase32();
  escribirJson(totpFile, { secret, creado: new Date().toISOString() });
  logger.info('TOTP de respaldos configurado');
  res.json({
    data: {
      secret,
      otpauth: otpauthUrl(secret, 'respaldos', 'Celestial Parfums'),
    },
  });
});

backupRouter.post('/', requireAdmin, (req: Request, res: Response) => {
  const secreto = leerSecreto();
  if (!secreto) {
    res.status(409).json({ error: 'Configura primero el authenticator para poder generar copias' });
    return;
  }
  const codigo = String(req.body?.codigo ?? '');
  if (!verificarTotp(secreto, codigo)) {
    logger.warn('Intento de respaldo con código TOTP inválido');
    res.status(401).json({ error: 'Código del authenticator inválido o vencido' });
    return;
  }

  let url: URL;
  try {
    url = new URL(process.env.DATABASE_URL ?? '');
  } catch {
    res.status(500).json({ error: 'DATABASE_URL no está configurada' });
    return;
  }

  const db = url.pathname.replace(/^\//, '');
  const binario = process.env.MYSQLDUMP_PATH || 'mysqldump';
  // La contraseña viaja por variable de entorno (no queda visible en `ps`)
  const dump = spawn(
    binario,
    [
      '-h', url.hostname,
      '-P', url.port || '3306',
      '-u', decodeURIComponent(url.username),
      '--single-transaction',
      '--routines',
      '--triggers',
      db,
    ],
    { env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) } },
  );

  const nombre = `backup-celestial-${new Date().toISOString().slice(0, 10)}.sql.gz`;
  let fallo = false;

  dump.on('error', (e) => {
    fallo = true;
    logger.error(`mysqldump no se pudo ejecutar: ${e.message}`);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'mysqldump no está disponible en el servidor (instala mysql-client o define MYSQLDUMP_PATH)',
      });
    }
  });

  let stderr = '';
  dump.stderr.on('data', (d) => { stderr += String(d); });

  dump.on('spawn', () => {
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    dump.stdout.pipe(createGzip()).pipe(res);
  });

  dump.on('close', (code) => {
    if (fallo) return;
    if (code === 0) {
      escribirJson(marcaFile, { fecha: new Date().toISOString() });
      logger.info('Copia de seguridad generada y descargada por el admin');
    } else {
      logger.error(`mysqldump terminó con código ${code}: ${stderr.slice(0, 500)}`);
      // Con bytes ya enviados no se puede cambiar el status: se corta la
      // descarga y el navegador la marca fallida (no queda un .gz "bueno")
      res.destroy();
    }
  });

  // Cliente canceló la descarga: no dejar el proceso colgado
  req.on('close', () => {
    if (!dump.killed) dump.kill();
  });
});
