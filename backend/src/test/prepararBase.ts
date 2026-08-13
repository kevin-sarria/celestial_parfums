import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

/**
 * Deja lista la base de pruebas ANTES de que corra nada.
 *
 * La base es `perfumes_test`: **vacía y armada desde las migraciones**, no una
 * copia de `perfumes_db`. Dos motivos, y el segundo no es obvio:
 *
 *  1. Los datos reales del negocio no se abren. Estas pruebas truncan tablas;
 *     hacerlo al lado de 261 ventas de verdad es un accidente esperando.
 *  2. **Armarla desde las migraciones las prueba a ellas.** Nadie verifica hoy
 *     que el juego completo levante el sistema desde cero, y se descubriría el
 *     día que haya que reconstruir el servidor — el peor día para descubrirlo.
 *     Este proyecto arrastra histórico de `db push` y ya tuvo una migración que
 *     reventaba por nombres de columna duplicados, fallo que `db push` nunca
 *     habría mostrado porque no ejecuta los `.sql`.
 *
 * Verificado el 2026-08-12: la base resultante es idéntica a la copia de
 * producción salvo un default cosmético (`curdate()` frente a `now()`).
 */

const RAIZ = path.resolve(__dirname, '../..');
const CARPETA_MIGRACIONES = path.join(RAIZ, 'prisma', 'migrations');

/** Partes de la conexión, para poder conectarse SIN base y poder crearla. */
const partirUrl = (url: string) => {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    base: u.pathname.replace(/^\//, ''),
  };
};

/**
 * El seguro que impide un desastre.
 *
 * Estas pruebas TRUNCAN tablas. Si `DATABASE_URL` apuntara por error a la base
 * real —una variable que quedó exportada, un `.env` mal copiado— borrarían el
 * negocio entero sin preguntar. Por eso el nombre de la base tiene que terminar
 * en `_test`: no es una convención, es la única barrera entre una prueba y los
 * datos del dueño.
 */
const exigirBaseDePruebas = (base: string) => {
  if (!base.endsWith('_test')) {
    throw new Error(
      `Las pruebas contra base solo corren sobre una base cuyo nombre termine en "_test", ` +
        `y DATABASE_URL apunta a "${base}". Se cancela: estas pruebas borran tablas y ` +
        `apuntar a la base real destruiría los datos del negocio.`,
    );
  }
};

/** Cuántas migraciones hay en disco (una carpeta por migración). */
const migracionesEnDisco = () =>
  readdirSync(CARPETA_MIGRACIONES, { withFileTypes: true }).filter((e) => e.isDirectory()).length;

/** Cuántas quedaron aplicadas. -1 si la base todavía no tiene ni la tabla. */
const migracionesAplicadas = async (conn: mysql.Connection) => {
  try {
    const [filas] = await conn.query<mysql.RowDataPacket[]>(
      'SELECT COUNT(*) AS n FROM `_prisma_migrations` WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',
    );
    return Number(filas[0]?.n ?? 0);
  } catch {
    return -1; // la base está vacía o recién creada
  }
};

export default async function prepararBase() {
  // `vitest.config.mts` la fija al evaluarse, que es antes de que esto corra.
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL: debería fijarla vitest.config.mts.');

  const { host, port, user, password, base } = partirUrl(url);
  exigirBaseDePruebas(base);

  let servidor: mysql.Connection;
  try {
    servidor = await mysql.createConnection({ host, port, user, password });
  } catch {
    throw new Error(
      `No responde MySQL en ${host}:${port}. Enciende MySQL en el panel de XAMPP y vuelve a ` +
        `correr las pruebas. (Las pruebas de aritmética no necesitan base: "npm run test:unidad".)`,
    );
  }

  await servidor.query(
    `CREATE DATABASE IF NOT EXISTS \`${base}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await servidor.end();

  // Aplicar las migraciones cuesta segundos, así que solo se hace cuando falta
  // alguna. Comparar contra las carpetas de disco hace que una migración nueva
  // entre sola, sin acordarse de nada.
  const conn = await mysql.createConnection({ host, port, user, password, database: base });
  const aplicadas = await migracionesAplicadas(conn);
  await conn.end();

  if (aplicadas !== migracionesEnDisco()) {
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: RAIZ,
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
  }
}
