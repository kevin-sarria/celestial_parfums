import { defineConfig } from 'vitest/config'

/**
 * Pruebas del backend, en dos grupos.
 *
 * Solo `.test.ts`: el patrón por defecto de Vitest también recoge `.spec.ts`, y
 * `src/schemas/import.spec.ts` NO es una prueba — es la definición de columnas
 * del importador. Correrla como suite fallaría sin que nada esté mal.
 *
 * **unidad** — aritmética pura, milisegundos, no necesita nada encendido.
 * **base**   — motores que escriben (costo promedio, consumo por venta, cupones).
 *              Corren contra `perfumes_test`, que se arma sola desde las
 *              migraciones. Van en su propio grupo para que quien solo quiera
 *              la comprobación rápida no dependa de que MySQL esté prendido:
 *              `npm run test:unidad`.
 */

/** La base de pruebas. NUNCA la del negocio: `prepararBase` exige que termine en `_test`. */
const BASE_DE_PRUEBAS =
  process.env.DATABASE_URL_TEST ?? 'mysql://root:@localhost:3306/perfumes_test'

// Se fija aquí, en el proceso principal, porque `globalSetup` corre ANTES que
// los trabajadores y por tanto no recibe el `env` de abajo. Este archivo se
// evalúa primero que nada, así que es el único punto donde las dos mitades
// pueden coincidir sin escribir la dirección dos veces.
process.env.DATABASE_URL = BASE_DE_PRUEBAS

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unidad',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**', 'src/**/*.bd.test.ts'],
        },
      },
      {
        test: {
          name: 'base',
          environment: 'node',
          include: ['src/**/*.bd.test.ts'],
          globalSetup: ['src/test/prepararBase.ts'],
          env: { DATABASE_URL: BASE_DE_PRUEBAS },
          // Comparten UNA base: si dos archivos truncaran tablas a la vez se
          // borrarían los datos el uno al otro y los fallos serían fantasmas
          // distintos en cada corrida.
          fileParallelism: false,
        },
      },
    ],
  },
})
