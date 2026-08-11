import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import { createGzip } from 'zlib';
import fs from 'fs';
import path from 'path';
import { requireAdmin } from '../middleware/auth.middleware';
import { generarSecretoBase32, otpauthUrl, verificarTotp } from '../utils/totp';
import {
  leerJsonSeguro, escribirJsonSeguro, marcaFile, totpFile, ultimaCopia, totpConfigurado,
} from '../utils/estadoRespaldo';
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

/**
 * Las rutas de los archivos y sus lectores viven en `utils/estadoRespaldo`
 * porque el centro de notificaciones también necesita saber cuándo fue la
 * última copia. Duplicarlas aquí haría que el aviso mirara un archivo distinto
 * el día que la carpeta se mueva.
 */
const leerJson = leerJsonSeguro;
const escribirJson = escribirJsonSeguro;
const leerSecreto = () => leerJsonSeguro<{ secret: string }>(totpFile)?.secret ?? null;

backupRouter.get('/estado', requireAdmin, (_req: Request, res: Response) => {
  res.json({
    data: {
      ultima: ultimaCopia(),
      totp_configurado: totpConfigurado(),
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

  /**
   * NO se envía nada hasta que mysqldump escupa el PRIMER byte.
   *
   * Antes la respuesta arrancaba en el evento 'spawn', o sea antes de saber si
   * el comando iba a funcionar. Si fallaba (binario ausente, credenciales
   * malas, base equivocada) no escribía nada, pero el gzip ya se había cerrado
   * solo y el navegador recibía un .gz **válido y VACÍO**: 20 bytes que se ven
   * como un respaldo y no contienen ni una tabla. Pasó de verdad en producción
   * el 2026-08-01. Un respaldo que miente es peor que no tener respaldo.
   */
  let bytes = 0;
  const gzip = createGzip();

  dump.stdout.once('data', (primer: Buffer) => {
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    gzip.pipe(res);
    gzip.write(primer);
    bytes += primer.length;
    dump.stdout.on('data', (d: Buffer) => { bytes += d.length; });
    dump.stdout.pipe(gzip);
  });

  dump.on('close', (code) => {
    if (fallo) return;

    // Sin datos NO hay respaldo, aunque el comando diga que salió bien
    if (bytes === 0) {
      const detalle = stderr.trim().slice(0, 300);
      logger.error(`mysqldump no produjo datos (código ${code}): ${stderr.slice(0, 500)}`);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'El respaldo salió VACÍO: mysqldump no devolvió datos, así que no se descargó nada. '
            + 'Revisa que el binario y las credenciales de la base sean correctos.'
            + (detalle ? ` El servidor dijo: ${detalle}` : ''),
        });
      } else {
        res.destroy();
      }
      return;
    }

    if (code === 0) {
      escribirJson(marcaFile, { fecha: new Date().toISOString() });
      logger.info(`Copia de seguridad generada (${bytes} bytes) y descargada por el admin`);
      gzip.end();
    } else {
      logger.error(`mysqldump terminó con código ${code}: ${stderr.slice(0, 500)}`);
      // Con bytes ya enviados no se puede cambiar el status: se corta la
      // descarga y el navegador la marca fallida (no queda un .gz "bueno")
      res.destroy();
    }
  });

  /**
   * Cliente canceló la descarga: no dejar el proceso colgado.
   *
   * OJO — aquí estaba EL bug que dejaba los respaldos vacíos (2026-08-01):
   * esto escuchaba `req.on('close')`, y la PETICIÓN emite 'close' en cuanto
   * termina de leerse su cuerpo, o sea a los milisegundos. Se mataba mysqldump
   * antes de que escribiera un solo byte → salía por señal (código `null` en
   * los logs, ocho veces seguidas) y el gzip se cerraba vacío.
   *
   * Lo correcto es escuchar la RESPUESTA y solo matar si se cerró ANTES de
   * terminar de enviarla (`writableEnded` en false = el cliente se fue).
   */
  res.on('close', () => {
    if (!res.writableEnded && !dump.killed) dump.kill();
  });
});
