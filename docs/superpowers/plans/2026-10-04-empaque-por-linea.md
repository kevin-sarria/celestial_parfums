# Empaque por línea, talla y combo — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El empaque (bolsa, perfumero) sale de una configuración por línea × talla y por combo, entra a la
venta como líneas de regalo visibles y deja de descontarse por debajo (receta) y al armar lotes.

**Architecture:** Tabla `empaque_linea` (línea × presentación → producto accesorio × cantidad). Una función
pura `empaqueDelPedido` (copiada en servidor y panel, como `detectarCombos`) calcula lo que le toca a un
pedido: el kit de cada combo armado + el empaque de línea de las unidades que no caen en combo. El
formulario de venta lo ofrece marcado y lo agrega como regalo al guardar; `controlPrecio` no lo cuenta como
descuento. Los accesorios dejan de vivir en la receta del tamaño (`formula_accesorios`) y en la talla del
perfume (`perfume_presentacion.accesorios`).

**Tech Stack:** Express + Prisma 6 (MariaDB/MySQL), React + Vite + Tailwind v4, vitest, Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-10-04-empaque-por-linea-design.md`

## Global Constraints

- Prisma se importa de `@prisma/client`; nada de `PUT` (usar `PATCH`); ningún `<select>` HTML (`SelectSimple`/`BuscadorSelect`).
- Toda mutación muestra el mensaje del servidor con toast; vistas con try/catch/finally.
- Archivos ≤ ~500 líneas; una regla en un solo sitio (la copia front/back de `empaqueDelPedido` se documenta en ambos lados y se fija con pruebas en los dos).
- Cifras históricas congeladas: no se reescriben ventas, lotes ni movimientos pasados.
- Línea → clave de empaque: `contratipo`→`contratipo`, `1.1`→`uno_uno`, `original` + botella completa→`botella_completa`, `original` + talla menor→`decant`, `producto`→`producto`, `accesorio`→ sin empaque.
- Las líneas de accesorio no cuentan como perfumes (`cantidad_perfumes`, combos, sellos).
- Migración nueva: `20261006120000_empaque_por_linea` (se documenta en `docs/deploy-migraciones.md`).

---

### Task 1: Migración — tabla, accesorios como productos y siembra

**Files:**
- Create: `backend/prisma/migrations/20261006120000_empaque_por_linea/migration.sql`
- Modify: `backend/prisma/schema.prisma` (modelo `EmpaqueLinea`, enum `LineaEmpaque`, relación en `Perfume`/`Presentacion`; quitar `FormulaAccesorio`, `FormulaVolumen.accesorios`, `InsumoCosto.incluido_en`, `PerfumePresentacion.accesorios`)

**Produces:** tabla `empaque_linea(id, linea, presentacion_id NULL, perfume_id, cantidad)` única por `(linea, presentacion_id, perfume_id)`.

- [ ] SQL, en orden:
  1. `CREATE TABLE empaque_linea` con FK a `presentaciones` (CASCADE) y a `perfumes` (RESTRICT).
  2. Un producto accesorio por cada insumo distinto de `formula_accesorios` que no tenga ya uno
     (`INSERT INTO perfumes (nombre, precio, tipo_producto, es_accesorio, publicado, insumo_producto_id, updated_at)
     SELECT i.nombre, 0, 'comprado', 1, 0, i.id, NOW(3) … WHERE NOT EXISTS (accesorio con ese insumo)`).
  3. Siembra contratipo: por cada presentación con `formula_volumen_id`, cada accesorio de su receta → fila
     `('contratipo', presentacion_id, producto_del_insumo, 1)`.
  4. Combos con kit vacío → 1 del producto accesorio cuyo insumo se llame `%perfumero%` (si existe).
  5. `DROP TABLE formula_accesorios`; `ALTER TABLE perfume_presentacion DROP COLUMN accesorios`.
- [ ] `npx prisma migrate deploy` en local y `npx prisma generate`; `npx tsc --noEmit` mostrará todo lo que hay que cambiar en las tareas siguientes.
- [ ] Verificar en la base local: `SELECT * FROM empaque_linea` y los accesorios creados; correr la migración sobre una copia del respaldo `celestial_prod_20260930` y comprobar: 30/100 ml → bolsa+perfumero, 75 ml → bolsa, 4 combos con perfumero.

### Task 2: Servidor — la línea, la cuenta y la configuración

**Files:**
- Create: `backend/src/empaque/lineaEmpaque.ts` — `lineaEmpaqueDe(perfume, ml)`.
- Create: `backend/src/empaque/empaqueDelPedido.ts` — función pura.
- Create: `backend/src/empaque/empaque.repository.ts` — `leerEmpaque()`, `guardarEmpaque(filas)`, `empaqueParaPedido(lineas)`.
- Create: `backend/src/routes/empaque.router.ts` — `GET /api/empaque` (personal que registra ventas o créditos), `PATCH /api/empaque` (admin).
- Modify: `backend/src/permisos/precioPedido.ts` — `detectarCombosServidor` devuelve también, por línea, cuántas unidades cayó en combo y qué combos se armaron (`{ comboId, veces }`); `ahorroPorCombos` pasa a usarla.
- Test: `backend/src/empaque/empaqueDelPedido.test.ts`, `backend/src/empaque/empaque.bd.test.ts`

**Interfaces:**
```ts
export type LineaEmpaque = 'contratipo' | 'uno_uno' | 'decant' | 'botella_completa' | 'producto';
export interface ReglaEmpaque { linea: LineaEmpaque; presentacion_id: number | null; perfume_id: number; cantidad: number }
export interface UnidadPedido { linea: LineaEmpaque | null; presentacion_id: number | null; enCombo: number; cantidad: number }
export interface KitCombo { comboId: number; veces: number; kit: { perfume_id: number; cantidad: number }[] }
/** perfume_id del accesorio → cuántos le tocan al pedido. */
export const empaqueDelPedido = (unidades: UnidadPedido[], combos: KitCombo[], reglas: ReglaEmpaque[]): Map<number, number>;
```
Reglas: para cada línea, `(cantidad − enCombo)` × reglas de `(linea, presentacion_id)`; `botella_completa` busca `presentacion_id = null`; más cada kit × veces.

- [ ] Pruebas puras: contratipo 100 ml ×2 → bolsa 2, perfumero 2; 1.1 → nada; 3 en combo con kit perfumero ×1 → solo perfumero 1; línea sin línea de empaque (accesorio) → nada; botella completa usa la regla nula.
- [ ] Prueba de base: `empaqueParaPedido` con perfumes reales (contratipo de una categoría con combo de 2) da el kit del combo y no el empaque de esos dos.

### Task 3: El personal regala el empaque sin pedir permiso

**Files:**
- Modify: `backend/src/middleware/controlPrecio.ts`
- Modify: `backend/src/permisos/precioPedido.ts` (el precio normal no suma las unidades de empaque permitidas)
- Test: `backend/e2e/permisosPersonal.e2e.test.ts` (dos casos nuevos)

- [ ] Con `empaqueParaPedido(lineas)`: regalo de un accesorio hasta lo permitido no cuenta como "regala", y esas unidades no suman al precio normal.
- [ ] e2e: venta de contratipo con su bolsa y perfumero de regalo → 201 sin solicitud; con 3 bolsas de regalo cuando toca 1 → 202 solicitud.

### Task 4: Inventario — la receta y los lotes dejan los accesorios

**Files:**
- Modify: `backend/src/repositories/inventario.consumoVenta.ts` (`recetaDe` sin accesorios)
- Modify: `backend/src/repositories/accesoriosDeFicha.ts` → se reduce a la regla congelada de los sobrantes; `conAccesoriosDeFicha`/`consumosDeAccesorios` quitan accesorios de los consumos de un lote (ya no se cobran)
- Modify: `backend/src/repositories/inventario.maceracion.ts`, `backend/src/routes/inventario.router.ts` (sin `/accesorios-de-lote`)
- Modify: `backend/src/repositories/accesoriosSobrantes.ts`: un lote de 1.1 no debió llevar accesorios; los de los demás se respetan (historia)
- Modify: `backend/src/repositories/costeo.repository.ts`: `accesorios_default` de una receta = empaque `contratipo` de sus presentaciones (como insumos, para los cálculos de cotización); se quita `setAccesoriosFormula` y su ruta
- Modify: `backend/src/repositories/fusionarInsumos.repository.ts`, `backend/src/repositories/insumo.usos.ts`, `backend/src/repositories/perfume.mapeo.ts`, `backend/src/schemas/perfume.schema.ts`, `backend/src/schemas/cotizacion.schema.ts`
- Test: ajustar `accesoriosDeFicha.bd.test.ts` y las pruebas que suponían accesorios en receta.

- [ ] Prueba: vender un contratipo de 30 ml descuenta esencia, diluyente y envase, **no** bolsa ni perfumero; las líneas de regalo de bolsa y perfumero los descuentan una vez.
- [ ] Prueba: armar un lote de contratipo no descuenta accesorios.
- [ ] `npm test` en backend en verde.

### Task 5: Panel — "Este pedido lleva"

**Files:**
- Create: `frontend/src/pages/dashboard/pedido/empaqueDelPedido.ts` (copia documentada de la función pura) + `.test.ts`
- Create: `frontend/src/pages/dashboard/pedido/EmpaqueDelPedido.tsx` (reemplaza `KitDelCombo.tsx`)
- Create: `frontend/src/application/hooks/useEmpaque.ts` (GET `/api/empaque`, cacheado)
- Modify: `kitDelCombo.calculo.ts` → `agregarKit` se queda (fusiona líneas de regalo); `kitPendiente` se reemplaza por la cuenta nueva
- Modify: `lineasPedido.ts` — `unidadesDeLineas(lineas, porId)` no cuenta accesorios
- Modify: `VentaForm.tsx`, `CreditoForm.tsx`, `ArmadorPedido.tsx`

- [ ] Bloque con casillas marcadas (sin marcar al **editar** una venta ya registrada); al guardar, lo marcado se fusiona como regalo antes de armar el cuerpo.
- [ ] Pruebas puras del lado del panel con los mismos casos de la Tarea 2.

### Task 6: Pantallas de configuración y tienda

**Files:**
- Create: `frontend/src/pages/dashboard/tabs/EmpaqueTab.tsx` (+ `tabs/empaque/` si pasa de ~250 líneas); entrada `empaque` en `navegacion.ts`/`types.ts`/`pestanas.ts`, sección Catálogo, solo dueño.
- Modify: `FrascosPorTalla.tsx`, `useFichaPerfume.ts`, `TallasDelPerfume.tsx`, `types/catalogo.ts` (fuera `accesorios_talla`)
- Modify: `CostosProduccionTab.tsx` (los accesorios se leen; para cambiarlos, enlace a Empaque), `ProduccionModal.tsx` (sin accesorios)
- Modify: backend `perfume.repository.ts` (by-slug agrega `incluye: string[]` por talla), frontend `PerfumeDetailPage.tsx` y `AddToCartModal.tsx` ("Incluye …"), detalle de combo (lo que trae su kit)

- [ ] e2e nuevo `backend/e2e/empaque.e2e.test.ts`: la pantalla Empaque guarda; en Ventas sale "Este pedido lleva" marcado y desmarcar no lo agrega; la tienda muestra "Incluye".
- [ ] Capturas revisadas a 1366 px y a 390 px.

### Task 7: Documentación y despliegue

- [ ] `docs/reglas-negocio.md` (empaque), `docs/inventario-costeo.md` (receta sin accesorios, lotes), `docs/arquitectura.md` (pestaña y API), `docs/deploy-migraciones.md` (migración), `docs/pendientes.md`.
- [ ] `npm test` (backend y frontend), e2e de los archivos tocados, `npm run build` del frontend.
- [ ] Commit, push y comprobar el despliegue y la tienda en vivo.
