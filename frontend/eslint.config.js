import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    /**
     * DOS REGLAS APAGADAS A PROPÓSITO (2026-08-23).
     *
     * Contexto: `npm run lint` daba 66 avisos y por eso **nadie lo miraba**. Un
     * linter que nunca pasa deja de avisar: el aviso número 67, el que sí
     * importa, se pierde entre los otros 66. Se revisaron uno por uno y el
     * resultado fue 26 arreglos de verdad (un componente declarado dentro de
     * otro, tres expresiones que no hacían nada, tres `any`, trece directivas
     * muertas) y estas dos reglas, que **no encajan con este código**. Se apagan
     * enteras y explicadas, en vez de sembrar 40 comentarios sueltos por los
     * archivos: eso último es lo que convierte una decisión en ruido.
     */
    rules: {
      /**
       * Prohíbe `setState` dentro de un efecto. Empuja a mover la carga de
       * datos a una librería (React Query y parecidas) o al enrutador.
       *
       * Aquí las 26 coincidencias son **la forma en que esta aplicación carga
       * datos**: `useEffect(() => { load(); }, [])` sobre la capa HTTP propia
       * (`http` + `urls`), que se construyó a conciencia en agosto de 2026 y es
       * una decisión reciente y documentada en `docs/arquitectura.md`. Obedecer
       * la regla significaría meter una librería de datos y reescribir las 26,
       * contradiciendo esa decisión, con riesgo real y **cero** diferencia para
       * quien usa la tienda.
       *
       * Lo que esta regla protegía —un efecto que se llama a sí mismo sin
       * parar— no pasa desapercibido: la pantalla se congela al instante. No es
       * la clase de fallo que necesita un linter para salir a la luz.
       */
      'react-hooks/set-state-in-effect': 'off',
      /**
       * Exige que un archivo exporte SOLO componentes, para que la recarga en
       * caliente del navegador conserve el estado mientras se programa.
       *
       * Es comodidad de desarrollo, no calidad del producto: lo peor que pasa
       * es que la página se recargue entera al guardar. Las 14 coincidencias
       * son archivos que exportan un componente **y su ayudante de al lado**
       * (`faltaParaVender` junto a su badge, `cantidad` junto a su tabla), y en
       * varios está escrito que viven juntos a propósito para que la tabla
       * pueda ordenar por lo mismo que se ve. Partirlos en dos archivos por una
       * comodidad del navegador esparce código que se lee mejor junto.
       */
      'react-refresh/only-export-components': 'off',
    },
  },
])
