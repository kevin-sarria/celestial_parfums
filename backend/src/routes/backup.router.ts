import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import { requireAdmin } from '../middleware/auth.middleware';
import { generarSecretoBase32, otpauthUrl, verificarTotp } from '../utils/totp';
import {
  leerJsonSeguro, escribirJsonSeguro, marcaFile, totpFile, ultimaCopia, totpConfigurado,
} from '../utils/estadoRespaldo';
import logger from '../config/logger';

/**
 * Copia de seguridad de la base de datos: exporta el SQL COMPLETO (estructura
 * y datos, mysqldump) directo al navegador del administrador — el respaldo
 * vive fuera del servidor, que es el punto: si el servidor muere, la copia no.
 *
 * Sin comprimir a propósito: el dueño la carga a mano en su MySQL local, y
 * MariaDB mete como primera línea `/*M!999999\- enable the sandbox mode * /`
 * que el mysql.exe viejo de XAMPP no entiende. Esa línea se descarta aquí
 * mismo (ver `esLineaSandbox`) para que el .sql que baja cargue directo, sin
 * gunzip ni tail a mano.
 *
 * Doble candado: además de la sesión de admin exige un código TOTP de app
 * authenticator (información ultra sensible). Una vez configurado, el TOTP NO
 * puede resetearse desde la web: quitar el archivo backups/totp.json exige
 * acceso SSH al servidor. Aunque roben la contraseña del admin, sin el
 * teléfono no hay copia.
 */
export const backupRouter = Router();

const esLineaSandbox = (linea: string) => /^\/\*M!\d+\\-\s*enable the sandbox mode\s*\*\/\s*$/.test(linea.trim());

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

  const nombre = `backup-celestial-${new Date().toISOString().slice(0, 10)}.sql`;
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
   * malas, base equivocada) no escribía nada, pero la respuesta ya se había
   * cerrado sola y el navegador recibía un archivo **válido y VACÍO** que se
   * ve como un respaldo y no contiene ni una tabla. Pasó de verdad en
   * producción el 2026-08-01. Un respaldo que miente es peor que no tener
   * respaldo.
   *
   * De paso, mientras se espera esa primera línea se aprovecha para
   * descartarla si es el comentario `sandbox mode` de MariaDB (ver
   * `esLineaSandbox` arriba del archivo).
   */
  let bytes = 0;
  let primeraLineaVista = false;
  let pendiente = Buffer.alloc(0);

  const enviar = (trozo: Buffer) => {
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/sql');
      res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    }
    res.write(trozo);
  };

  dump.stdout.on('data', (trozo: Buffer) => {
    bytes += trozo.length;
    if (primeraLineaVista) {
      enviar(trozo);
      return;
    }
    pendiente = Buffer.concat([pendiente, trozo]);
    const salto = pendiente.indexOf(0x0a);
    if (salto === -1) return; // aún no llega el primer salto de línea completo
    primeraLineaVista = true;
    const primeraLinea = pendiente.subarray(0, salto).toString('utf8');
    const resto = pendiente.subarray(salto + 1);
    if (!esLineaSandbox(primeraLinea)) enviar(Buffer.from(`${primeraLinea}\n`, 'utf8'));
    if (resto.length) enviar(resto);
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

    // El dump entero cupo antes de ver un salto de línea (no pasa en la práctica,
    // pero sin esto se perdería ese resto sin enviar)
    if (!primeraLineaVista && pendiente.length && !esLineaSandbox(pendiente.toString('utf8'))) {
      enviar(pendiente);
    }

    if (code === 0) {
      escribirJson(marcaFile, { fecha: new Date().toISOString() });
      logger.info(`Copia de seguridad generada (${bytes} bytes) y descargada por el admin`);
      res.end();
    } else {
      logger.error(`mysqldump terminó con código ${code}: ${stderr.slice(0, 500)}`);
      // Con bytes ya enviados no se puede cambiar el status: se corta la
      // descarga y el navegador la marca fallida (no queda un archivo "bueno")
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
