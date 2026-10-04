# Precios sugeridos de los originales — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una pestaña que muestre el costo real de cada talla de cada original y le sugiera precio
según una meta de ganancia (general o propia del perfume), y que lo aplique en bloque.

**Architecture:** El servidor calcula el costo de cada talla con las mismas reglas de la venta
(`utils/decants.ts`, frasco de la talla o de la receta, empaque de `empaque_linea`) y guarda los
precios propios y la meta. La pantalla hace la cuenta del sugerido, que es pura y cambia con el
selector.

**Spec:** `docs/superpowers/specs/2026-10-04-precios-originales-design.md`

## Global Constraints

- Margen sobre el precio: `costo / (1 − p/100)`, p ∈ [1, 90]. En pesos: `costo + v`. Se redondea a $1.000.
- Todo es `requireAdmin`. Nada de `PUT`, nada de `<select>`.
- Migración: `20261007120000_meta_ganancia`.

### Task 1: Datos y costo en el servidor
- Migración y `schema.prisma`: `perfumes.meta_ganancia_tipo ENUM('porcentaje','pesos') NULL`, `meta_ganancia_valor DECIMAL(12,2) NULL`.
- `backend/src/precios/costoTalla.ts` (puro) + `.test.ts`.
- `backend/src/precios/preciosOriginales.repository.ts`: `listarOriginales()`, `ponerMeta(id, meta)`, `aplicarPrecios(lista)` + `.bd.test.ts`.
- `backend/src/routes/precios.router.ts` en `/api/precios-originales`.

### Task 2: Pantalla
- `frontend/src/pages/dashboard/tabs/preciosOriginales/sugerencia.ts` (puro) + `.test.ts`.
- `PreciosOriginalesTab.tsx`, `preciosOriginales/OriginalCard.tsx`, `preciosOriginales/MetaGanancia.tsx`.
- Pestaña `precios_originales` en Catálogo (solo dueño).

### Task 3: Recorrido, documentos y despliegue
- `backend/e2e/preciosOriginales.e2e.test.ts` con capturas a 1366 y 390 px.
- `docs/reglas-negocio.md`, `docs/arquitectura.md`, `docs/deploy-migraciones.md`, `docs/pendientes.md`.
- Pruebas completas, commit, push y comprobación en vivo.
