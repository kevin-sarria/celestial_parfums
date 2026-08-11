import fs from 'fs';
import path from 'path';

/**
 * Dónde se anota cuándo se hizo la última copia de la base y si el segundo
 * candado (TOTP) está configurado.
 *
 * Vive aparte del router porque lo leen DOS sitios: la pantalla de respaldo y
 * el centro de notificaciones, que avisa cuando pasan demasiados días. Con la
 * ruta del archivo escrita en dos lugares, el día que se mueva la carpeta uno
 * de los dos se queda mirando un archivo que ya no existe — y fallaría en
 * silencio, diciendo "nunca has hecho copia" para siempre.
 */
export const backupsDir = path.join(__dirname, '../../backups');
export const marcaFile = path.join(backupsDir, 'ultima.json');
export const totpFile = path.join(backupsDir, 'totp.json');

export const leerJsonSeguro = <T>(file: string): T | null => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
};

export const escribirJsonSeguro = (file: string, data: unknown) => {
  fs.mkdirSync(backupsDir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
};

/** Fecha ISO de la última copia, o null si nunca se ha hecho una. */
export const ultimaCopia = () => leerJsonSeguro<{ fecha: string }>(marcaFile)?.fecha ?? null;

/** El segundo candado del respaldo. Sin él, la pantalla pide configurarlo primero. */
export const totpConfigurado = () =>
  leerJsonSeguro<{ secret: string }>(totpFile)?.secret != null;

/**
 * Días desde la última copia. `null` = nunca se ha hecho ninguna, que es un
 * caso distinto de "hace mucho" y se avisa con más fuerza.
 */
export const diasSinCopia = (): number | null => {
  const fecha = ultimaCopia();
  if (!fecha) return null;
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86_400_000);
};

/** A partir de estos días sin copia se avisa. Igual que el punto rojo de la pantalla. */
export const DIAS_AVISO_RESPALDO = 7;
