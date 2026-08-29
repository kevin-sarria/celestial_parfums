/**
 * FRENO DE MANO PARA `prisma migrate dev`.
 *
 * `migrate dev` es el comando de DESARROLLO: cuando la base no cuadra con el
 * historial de migraciones, propone «prisma migrate reset», que borra la base
 * entera. En el servidor eso es la tienda completa.
 *
 * Pasó el 2026-08-29: el dueño corrió `migrate dev` en producción y la pantalla
 * le ofreció el reset. No lo aceptó, pero el susto sobra: aquí se corta antes.
 *
 * El freno mira el NOMBRE de la base, no una variable de entorno, porque
 * NODE_ENV no siempre viene puesta en una sesión de SSH y el nombre sí es
 * inequívoco.
 */
require('dotenv').config();

const PROHIBIDAS = ['celestial_db'];

const url = process.env.DATABASE_URL ?? '';
const base = decodeURIComponent((url.split('?')[0].split('/').pop() ?? '').trim());

if (PROHIBIDAS.includes(base)) {
  console.error(
    `\n  ⛔ "${base}" es la base de PRODUCCIÓN y este comando puede borrarla.\n\n`
    + '  Para aplicar migraciones en el servidor:  npx prisma migrate deploy\n'
    + '  (solo agrega lo que falta; nunca borra nada, nunca pide reset)\n',
  );
  process.exit(1);
}
