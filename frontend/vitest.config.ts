import path from 'path'
import { defineConfig } from 'vitest/config'

/**
 * Pruebas del frontend.
 *
 * Va aparte de `vite.config.ts` a propósito: las pruebas de esta ola son
 * funciones PURAS (precios, combos, costeo), así que no hacen falta ni React ni
 * Tailwind ni un DOM simulado. Cargar esos plugins solo para correr aritmética
 * haría lento algo que tarda milisegundos.
 *
 * Lo único que sí se copia es el alias `@`, porque el código lo usa.
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    // Solo `.test.ts`. El patrón por defecto de Vitest incluye `.spec.ts`, y en
    // este proyecto `import.spec.ts` NO es una prueba: es la definición de
    // columnas del importador. Correrla como suite falla sin motivo real.
    include: ['src/**/*.test.ts'],
  },
})
