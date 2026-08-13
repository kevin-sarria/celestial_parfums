import { defineConfig } from 'vitest/config'

/**
 * Recorridos completos: abren la tienda de verdad en un navegador y hacen
 * clics como un cliente o como el dueño.
 *
 * Van en su PROPIO comando (`npm run test:e2e`) y no dentro de `npm test`
 * porque levantan dos servidores. Si compartieran comando con la aritmética,
 * un arranque fallido taparía el resultado de todo lo demás y el conjunto
 * dejaría de ser creíble.
 */

/** Base de pruebas y puerto propios: no chocan con los servidores de siempre. */
const BASE_DE_PRUEBAS =
  process.env.DATABASE_URL_TEST ?? 'mysql://root:@localhost:3306/perfumes_test'

// `arranque.ts` corre antes que los trabajadores y no recibe el `env` de abajo.
process.env.DATABASE_URL = BASE_DE_PRUEBAS
// El backend salta el captcha cuando esto viene vacío, y `dotenv` no sobreescribe
// lo que ya existe en el entorno: así no hay que tocar el `.env` del dueño.
process.env.RECAPTCHA_SECRET_KEY = ''

export default defineConfig({
  test: {
    name: 'recorridos',
    environment: 'node',
    include: ['e2e/**/*.e2e.test.ts'],
    globalSetup: ['e2e/arranque.ts'],
    env: { DATABASE_URL: BASE_DE_PRUEBAS, RECAPTCHA_SECRET_KEY: '' },
    // Comparten una tienda y una base: en paralelo se desordenarían entre sí.
    fileParallelism: false,
    // Un clic en un navegador de verdad no tarda lo que una función pura.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
})
