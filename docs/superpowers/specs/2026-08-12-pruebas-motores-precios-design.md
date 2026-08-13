# Primera ola de pruebas: los motores de precios y descuentos

Fecha: 2026-08-12. Decidido con el dueño.

## Por qué

El proyecto tenía **cero pruebas automatizadas**. Cambiar cualquier cosa de precios obligaba
a probar a mano en el navegador y confiar. El propio `CLAUDE.md` señala dónde está el riesgo:
*"Precios y descuentos (lo más delicado de la app)"*.

`import.spec.ts` NO es una prueba: es la definición de columnas del importador. El nombre
engaña.

## Decisiones

### Vitest, no Jest

El frontend es **Vite 8**. Vitest reutiliza `vite.config.ts` tal cual — alias `@/`,
TypeScript, resolución de módulos — sin configuración paralela. Jest sobre Vite + ESM exige
una capa de transpilación que se rompe en cada actualización. Usarlo también en el backend
deja **una sola herramienta** en vez de dos.

Es `devDependency`: no engorda el servidor ni cambia el despliegue.

### Playwright, no Cypress (para la ola de E2E, que NO es esta)

Ya se usa: `~/.claude/skills/dashboard-interno-ux/scripts/revisar-pantalla.mjs` corre con
**`playwright-core` sobre el Edge instalado**, deliberadamente para no descargar navegadores.
Cypress bajaría ~500 MB, duplicaría herramienta y tiraría el apaño del captcha ya resuelto.

### Los archivos van junto al código

`lineasPedido.test.ts` al lado de `lineasPedido.ts`. Un árbol `__tests__` paralelo obliga a
mantener dos estructuras sincronizadas a mano, y es lo primero que se desincroniza.

### Los nombres de las pruebas, en español

Como todo el proyecto. El dueño tiene que poder leer la salida cuando algo falle y entender
qué se rompió sin traducir.

### Se escriben desde la REGLA, no desde el código

Cada prueba sale de la regla de negocio tal como está en `CLAUDE.md`. Cuando el código haga
otra cosa, **la prueba no se fuerza para que pase**: se deja como `it.skip` con un comentario
`DISCREPANCIA:` que dice qué esperaba la regla, qué hace el código y con qué números. Al
final se le pasa la lista al dueño para que decida si el error está en el código o si la
regla ya cambió y el documento se quedó viejo.

Así el conjunto queda verde salvo lo que de verdad hay que hablar.

## Qué se prueba

| Motor | Reglas que se convierten en prueba |
|---|---|
| `lib/format.ts` → `finalPrice` | El átomo de todo descuento. Redondeo, 0% no toca el precio. |
| `pedido/lineasPedido.ts` | Cascada de precio por talla; precio con y sin descuento de página; subtotal; unidades derivadas (ya no se teclean); `descuentoDeCupon` **con su tope en pesos**. |
| `hooks/useComboDetector.ts` → `detectarCombos` | Combo **solo si sale más barato**; premium **excluidos**; los que ya traen descuento propio no entran; se prueba primero el combo **más grande**; cubre las unidades **más caras**; la sugerencia avisa si dejó premium afuera. |
| `application/costeoCotizacion.ts` | El diluyente es **siempre el resto** del volumen, nunca un dato guardado; el costo usa la esencia **del perfume** antes que la de la receta; escalas solapadas → gana el de **mínimo más alto**; `cantidad_max` null = "100 o más". |
| `utils/perfumeMatcher.ts` (backend) | **Conservador**: ante dos candidatos no elige ninguno. Alias (`one`→`1`); typos de una letra solo en palabras de 5+; separadores enlazan cada parte; los ids repetidos **no se deduplican**. |
| `utils/catalogoFiltros.ts` | Qué entra al PDF y, sobre todo, que se **cuente y explique lo que queda fuera**. |
| `repositories/perfume.repository.ts` → `sinEsenciaParaUno` | Se mide contra la talla más pequeña; los no fabricados nunca se marcan; sin receta el corte cae a `stock > 0`. |

## Qué NO cubre esta ola

Nada de base de datos, nada de pantallas, nada de recorridos completos. Sin `jsdom` ni
`testing-library`: todo lo de esta ola son funciones puras.

Las olas siguientes (otra conversación): integración del backend contra una base de prueba
(cupones, consumo por venta, costo promedio, IVA por proveedor) y E2E con Playwright sobre
los caminos que mueven plata.

## Cómo se corre

```bash
cd backend  && npm test
cd frontend && npm test
```
