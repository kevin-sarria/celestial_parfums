import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import prepararBase from '../src/test/prepararBase';
import { limpiarBase } from '../src/test/baseDePrueba';
import { ADMIN, sembrarTienda } from './tienda';

/**
 * Dónde queda la sesión de administrador para TODA la corrida.
 *
 * El servidor corta a los 10 intentos de login cada 15 minutos. Con una sesión
 * por archivo de recorridos el techo llegaba a los 10 archivos, y el 11º moría
 * con un 429 que no dice nada del sistema (pasó el 2026-08-14 al sumar el
 * recorrido del menú lateral). Ahora se entra UNA vez aquí y todos los
 * archivos leen la misma cookie: el límite deja de ser un techo al número de
 * recorridos.
 *
 * Va por archivo y no por variable de entorno porque cada archivo de pruebas
 * corre en su propio proceso.
 */
export const ARCHIVO_SESION = path.join(os.tmpdir(), 'celestial-e2e-sesion.txt');

/**
 * Levanta el sistema entero para los recorridos: base de pruebas sembrada,
 * backend y tienda.
 *
 * Todo apunta a `perfumes_test` y a puertos propios (4100 y 5273), así que
 * **puedes tener tus servidores de siempre corriendo mientras esto pasa**: no
 * se pisan y, sobre todo, ningún recorrido escribe en `perfumes_db`.
 *
 * El captcha no se toca en `.env`. El backend lo salta cuando
 * `RECAPTCHA_SECRET_KEY` viene vacía, y `dotenv` NO sobreescribe una variable
 * que ya existe en el entorno — así que basta con arrancarlo con esa variable
 * en blanco. Editar el `.env` del dueño y restaurarlo después es justo el tipo
 * de cosa que se queda a medias cuando una prueba revienta.
 */

export const PUERTO_BACKEND = 4100;
export const PUERTO_TIENDA = 5273;
export const URL_TIENDA = `http://localhost:${PUERTO_TIENDA}`;
export const URL_API = `http://localhost:${PUERTO_BACKEND}`;

const RAIZ_FRONTEND = path.resolve(__dirname, '../../frontend');

let servidor: Server | null = null;
let tienda: ChildProcess | null = null;

/** Espera a que una dirección conteste. Falla con un motivo legible, no colgado. */
const esperarA = async (url: string, queEs: string, intentos = 60) => {
  for (let i = 0; i < intentos; i++) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // todavía no levanta
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${queEs} no respondió en ${url} tras ${intentos / 2} segundos.`);
};

/** En Windows `kill()` deja vivos a los hijos: vite arranca su propio proceso. */
const matarArbol = (proceso: ChildProcess) => {
  if (!proceso.pid) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(proceso.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    process.kill(-proceso.pid, 'SIGTERM');
  }
};

export default async function arranque() {
  await prepararBase();
  await limpiarBase();
  await sembrarTienda();

  // El backend se levanta DENTRO de este proceso: comparte el cliente de Prisma
  // con la siembra, así que no hay dudas sobre a qué base está mirando.
  process.env.PORT = String(PUERTO_BACKEND);
  ({ server: servidor } = await import('../src/app'));
  await esperarA(`${URL_API}/api/parfums`, 'El backend');

  // La sesión de admin, una sola vez para toda la corrida (ver ARCHIVO_SESION).
  const entrada = await fetch(`${URL_API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN.email, password: ADMIN.clave }),
  });
  if (!entrada.ok) throw new Error(`No se pudo entrar como administrador: ${entrada.status}`);
  fs.writeFileSync(ARCHIVO_SESION, entrada.headers.getSetCookie().join('\n'));

  // La tienda, en modo `e2e` para que tome `frontend/.env.e2e`, que la apunta
  // al backend de pruebas en vez de al de siempre.
  tienda = spawn('npx', ['vite', '--mode', 'e2e', '--port', String(PUERTO_TIENDA), '--strictPort'], {
    cwd: RAIZ_FRONTEND,
    stdio: 'ignore',
    shell: process.platform === 'win32',
    detached: process.platform !== 'win32',
  });
  await esperarA(URL_TIENDA, 'La tienda');

  return async () => {
    fs.rmSync(ARCHIVO_SESION, { force: true });
    if (tienda) matarArbol(tienda);
    await new Promise<void>((resolve) => (servidor ? servidor.close(() => resolve()) : resolve()));
  };
}
