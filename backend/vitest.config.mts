import { defineConfig } from 'vitest/config'

/**
 * Pruebas del backend.
 *
 * Solo `.test.ts`: el patrón por defecto de Vitest también recoge `.spec.ts`, y
 * `src/schemas/import.spec.ts` NO es una prueba — es la definición de columnas
 * del importador. Correrla como suite fallaría sin que nada esté mal.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
