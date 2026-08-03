# Rediseño del dashboard — Ola 2: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Ventas y Créditos compartan un solo armador de pedido con total en vivo, blindar el cupón ya canjeado, darles las métricas que faltan, y partir los dos archivos de 607 y 565 líneas.

**Architecture:** El formato que se manda al servidor **no cambia**: solo cambia cómo se arma el pedido en pantalla. La talla deja de ser ambigua porque el servidor pasa a mandar el número de ml junto al precio, así que elegirla fija a la vez la etiqueta (con la que se busca el precio) y el número (con el que el inventario descuenta). Lo que difiere entre las dos pantallas entra como prop opcional, igual que en `SmartTable`.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, Tailwind v4, shadcn, `sonner`. Backend Express + Prisma 6. Sin dependencias ni migraciones nuevas.

**Spec:** `docs/superpowers/specs/2026-08-02-rediseno-dashboard-ola2-design.md`

## Global Constraints

- **Sin suite de pruebas en el frontend.** El ciclo por tarea es `npm run build` + `npm run lint` comprobando que **el número de avisos no sube** (referencia al empezar: **46 errores, 6 warnings**, todos preexistentes en otros archivos). Al final, pasada real por el navegador.
- **Nada de `PUT`**: el CORS solo permite `GET`, `POST`, `PATCH`, `DELETE`.
- **Encoding**: UTF-8 sin BOM. Jamás `Get-Content`/`Set-Content` de PowerShell sobre código. En regex, los diacríticos como `̀-ͯ`.
- **Avisos con `sonner`**, deduplicados con `{ id: '...' }`. `window.alert()` está deprecado; `window.confirm()` sigue válido para borrados.
- **Una acción que falla SIEMPRE avisa**, con el mensaje que manda el servidor.
- **Los cortes de mes se construyen con `new Date(Date.UTC(a, m, 1))`**, nunca con `setHours(0,0,0,0)`: las columnas `@db.Date` se leen como medianoche UTC y en Colombia el día 1 quedaría fuera del mes.
- **`git add` con rutas exactas.** Hay archivos modificados de sesiones anteriores que no son de este trabajo (`CLAUDE.md`, `schema.prisma`, `config/prisma.ts`, los repositorios de combo/inventario/pago, `DetalleCompra.tsx`, `FormulasVolumenTab.tsx`, `InventarioTab.tsx`, `PagosTab.tsx`). Nunca `git add -A`.
- **Esto toca dinero.** Ninguna tarea se da por buena sin comprobar el resultado contra la base.

---

### Task 0: Rama

- [ ] **Step 1: Crear la rama desde donde quedó la Ola 1**

```bash
git checkout -b rediseno-dashboard-ola2
```

- [ ] **Step 2: Anotar la referencia del linter**

```bash
cd frontend && npm run lint 2>&1 | tail -3
```

Esperado: `52 problems (46 errors, 6 warnings)`. Ese es el número que **no debe subir**.

---

### Task 1: El servidor manda el número de ml junto al precio

Es lo que elimina la ambigüedad de la talla. Sin esto, el armador compartido tendría que adivinar.

**Files:**
- Modify: `backend/src/repositories/perfume.repository.ts` (`resolverPrecios`, ~línea 31)
- Modify: `frontend/src/domain/entities/perfume.schema.ts` (`precioPresentacionSchema`)

**Interfaces:**
- Produces: `precios[].ml: number | null` en la respuesta de `/api/parfums`. Lo consumen las tareas 4, 6, 7 y 8.

- [ ] **Step 1: Añadir `ml` al precio resuelto**

En `resolverPrecios`, dentro del `p.presentaciones.map((r) => ({ ... }))`, junto a `presentacion`:

```ts
    presentacion: r.presentacion.nombre,
    /** Número real de la talla. Null en las que no son talla ("Combo Personalizado"). */
    ml: r.presentacion.ml ?? null,
```

`p.presentaciones` ya incluye la relación `presentacion`, así que **no hay que tocar la consulta**: el dato ya viaja.

- [ ] **Step 2: Comprobar que el dato existe antes de seguir**

```bash
cd backend && npx tsc --noEmit -p tsconfig.json
```

Esperado: sin errores. Si `r.presentacion.ml` no existe en el tipo, el cliente de Prisma está desactualizado: correr `npx prisma generate` (con el dev server detenido, o falla con EPERM).

- [ ] **Step 3: Reflejarlo en el esquema del frontend**

En `frontend/src/domain/entities/perfume.schema.ts`, dentro de `precioPresentacionSchema`:

```ts
  ml: z.number().nullable().default(null),
```

- [ ] **Step 4: Verificar con datos reales**

```bash
curl -s "http://localhost:4000/api/parfums/1" | head -c 600
```

Esperado: cada entrada de `precios` trae `ml` con el número de su talla (30, 50, 100…) y `null` en las que no son talla.

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories/perfume.repository.ts frontend/src/domain/entities/perfume.schema.ts
git commit -m "feat(catalogo): el precio de cada talla viaja con su numero de ml"
```

---

### Task 2: Blindar el cupón ya canjeado

**Files:**
- Modify: `backend/src/services/anuncio.service.ts` (`liberarCodigoDeVenta`, ~línea 371)
- Modify: `backend/src/repositories/venta.repository.ts` (`updateVenta`, ~líneas 158-166)

**Interfaces:**
- Produces: `liberarCodigoDeVenta(ventaId, exceptoCodigo?, soloNoCanjeados?)`. La Task 7 se apoya en que el servidor rechaza el cambio.

- [ ] **Step 1: Que liberar pueda respetar los canjeados**

```ts
/**
 * Libera los códigos enlazados a una venta.
 * @param soloNoCanjeados true = deja quietos los ya canjeados. Se usa al EDITAR:
 * un cupón consumido queda amarrado a su venta y solo se suelta si la venta se
 * elimina. Antes se liberaba cualquiera, así que bastaba con borrar el texto del
 * campo —incluso sin querer— para revivir un cupón ya gastado.
 */
export const liberarCodigoDeVenta = async (
  ventaId: number,
  exceptoCodigo?: string | null,
  soloNoCanjeados = false,
) => {
  await prisma.descuentoCodigo.updateMany({
    where: {
      venta_id: ventaId,
      ...(exceptoCodigo ? { NOT: { codigo: normalizarCodigo(exceptoCodigo) } } : {}),
      ...(soloNoCanjeados ? { NOT: { estado: 'canjeado' } } : {}),
    },
    data: { venta_id: null, estado: 'activo', canjeado_at: null },
  });
};
```

El borrado de venta (`venta.repository.ts:199`) llama sin el tercer parámetro, así que **sigue liberando todo**. Es justo lo que se quiere.

- [ ] **Step 2: Que editar rechace cambiar un cupón canjeado**

En `updateVenta`, **antes** de la transacción, con `codigo` ya normalizado:

```ts
  // Un cupón canjeado queda amarrado a su venta: cambiarlo o quitarlo aquí lo
  // revivía en silencio. Para soltarlo hay que eliminar la venta.
  const canjeado = await prisma.descuentoCodigo.findFirst({
    where: { venta_id: ventaId, estado: 'canjeado' },
    select: { codigo: true },
  });
  if (canjeado && normalizarCodigo(codigo ?? '') !== canjeado.codigo) {
    throw new Error(
      `Esta venta ya canjeó el cupón ${canjeado.codigo}. Para cambiarlo hay que eliminar la venta y volver a registrarla.`,
    );
  }
```

`normalizarCodigo` se importa de `anuncio.service` como las otras funciones de cupón. Si no está exportada, exportarla.

- [ ] **Step 3: Pasar `true` al editar**

En `updateVenta`, línea ~165:

```ts
  await liberarCodigoDeVenta(ventaId, codigo, true);
```

- [ ] **Step 4: Verificar con la base**

```bash
cd backend && npx tsc --noEmit -p tsconfig.json
```

Prueba real (se hace en la Task 9 con el navegador, pero se puede adelantar por SQL): tomar una venta con código `canjeado`, intentar `PATCH` sin código → debe responder 400 con el mensaje, y en `descuento_codigos` la fila sigue `canjeado` y con su `venta_id`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/anuncio.service.ts backend/src/repositories/venta.repository.ts
git commit -m "fix(cupones): un codigo canjeado ya no revive al editar la venta"
```

---

### Task 3: Los números que faltan

**Files:**
- Modify: `backend/src/repositories/venta.repository.ts` (`getVentaTotales`, ~línea 240)
- Modify: `backend/src/repositories/credito.repository.ts` (función nueva)
- Modify: `backend/src/controller/credito.controller.ts`
- Modify: `backend/src/routes/credito.router.ts`

**Interfaces:**
- Produces: `ingresos_mes_anterior: number` en `/ventas/totales`; y `GET /creditos/totales` devolviendo `{ total_en_deuda, clientes_con_deuda, vencido, creditos_vencidos, abonado_mes }`. Los consumen las tareas 7 y 8.

- [ ] **Step 1: Ingreso del mes anterior**

**DESCARTADO.** Kevin movió el comparativo de meses a **Reportes**, en su propia tanda:
ahí ya hay gráficos y es la pantalla de analizar, no la de registrar. `getVentaTotales`
**no se toca** en esta ola.

- [ ] **Step 2: Totales de créditos**

En `credito.repository.ts`:

```ts
/**
 * Resumen de la cartera. Hace falta un endpoint porque "cuánto te deben" no se
 * puede calcular con la página que está en pantalla: daría un número que cambia
 * al pasar de página.
 */
export const getCreditoTotales = async () => { /* … */ };
```

El saldo de cada crédito es `deuda_inicial − suma(abonos)`; solo cuentan los que quedan en positivo. `vencido` son los que además tienen `fecha_limite` pasada. `abonado_mes` son los abonos del mes en curso (corte UTC).

- [ ] **Step 3: Exponerlo**

Controlador `getTotales` siguiendo el patrón de `venta.controller`, y en el router **antes** de cualquier ruta con `:id`:

```ts
creditoRouter.get('/totales', getTotales);
```

- [ ] **Step 4: Verificar contra la suma a mano**

```bash
curl -s http://localhost:4000/api/creditos/totales   # con sesión admin
```

Contrastar con SQL: la suma de saldos pendientes debe coincidir exactamente.

- [ ] **Step 5: Commit**

```bash
git add backend/src/repositories/venta.repository.ts backend/src/repositories/credito.repository.ts backend/src/controller/credito.controller.ts backend/src/routes/credito.router.ts
git commit -m "feat(creditos): endpoint de totales, y comparacion con el mes anterior en ventas"
```

---

### Task 4: Los cálculos compartidos

**Files:**
- Create: `frontend/src/pages/dashboard/pedido/lineasPedido.ts` (mueve y amplía `creditoLineas.ts`)
- Delete: `frontend/src/pages/dashboard/creditoLineas.ts`
- Modify: los archivos que lo importan (TypeScript los señala: `VentasTab.tsx`, `CreditosTab.tsx`)

**Interfaces:**
- Produces: `LineaPedido`, `precioLista`, `precioUnitario`, `itemsDeLineas`, `articulosDeLineas`, `presentacionResumen`, `descuentoDeCupon`, `subtotalDeLineas`, `unidadesDeLineas`. Las consumen las tareas 5, 6, 7 y 8.

- [ ] **Step 1: Mover el archivo conservando el historial**

```bash
mkdir -p frontend/src/pages/dashboard/pedido
git mv frontend/src/pages/dashboard/creditoLineas.ts frontend/src/pages/dashboard/pedido/lineasPedido.ts
```

- [ ] **Step 2: El tipo de línea**

```ts
export interface LineaPedido {
  /** Clave estable para React y para fusionar líneas iguales. */
  key: string;
  perfume_id: number;
  nombre: string;
  /** Etiqueta del catálogo ("30ML"). Con ella se busca el precio. */
  presentacion: string | null;
  /** Número de ml. Con él el inventario sabe qué receta descontar. */
  ml: number | null;
  cantidad: number;
  /** Quita el descuento de la página en ESTA línea (a crédito no siempre aplica). */
  sin_descuento: boolean;
}
```

Los productos sin talla (una gorra) llevan `presentacion` y `ml` en `null`.

- [ ] **Step 3: Adaptar las funciones que ya existen**

`precioUnitario`, `itemsDeLineas`, `articulosDeLineas` y `presentacionResumen` pasan a recibir `LineaPedido`. Donde hoy asumen que `presentacion` es un texto, contemplar el `null`: un producto sin talla usa `p.precio` de respaldo y en el texto de artículos no lleva paréntesis.

- [ ] **Step 4: Las dos funciones nuevas**

```ts
/** Suma de las líneas antes de combo y cupón. */
export const subtotalDeLineas = (lineas: LineaPedido[], porId: Map<number, Perfume>) =>
  lineas.reduce((s, l) => s + precioUnitario(l, porId) * l.cantidad, 0);

/** Unidades totales del pedido. Sustituye al campo "Cantidad" que se teclea a mano. */
export const unidadesDeLineas = (lineas: LineaPedido[]) =>
  lineas.reduce((s, l) => s + l.cantidad, 0);
```

- [ ] **Step 5: Verificar**

```bash
cd frontend && npm run build && npm run lint 2>&1 | tail -3
```

Esperado: compila, y el linter sigue en 46 errores. TypeScript señalará cada import viejo de `creditoLineas`: arreglarlos todos.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/dashboard/pedido/lineasPedido.ts frontend/src/pages/dashboard/tabs/VentasTab.tsx frontend/src/pages/dashboard/tabs/CreditosTab.tsx
git commit -m "refactor(pedido): calculos de lineas compartidos por ventas y creditos"
```

---

### Task 4b: La maquetación de la página

Es el arreglo que Kevin pidió: sacar el título, los botones y las cajas de dentro de la
tarjeta de la tabla. Va antes de tocar las pantallas para que las tareas 7 y 8 ya lo usen.

**Files:**
- Modify: `frontend/src/pages/dashboard/ui.tsx`

**Interfaces:**
- Produces: `EncabezadoPagina`, `FranjaMetricas`, y `StatCard` con `nota` opcional. Los
  usan las tareas 7 y 8.

- [ ] **Step 1: Las piezas nuevas**

```tsx
/**
 * Título y acciones de la pantalla, FUERA de la tarjeta de contenido.
 * Meter el título, los botones, las métricas y la tabla en la misma tarjeta deja
 * siete cosas distintas en el mismo plano visual y se lee como un formulario largo.
 */
export function EncabezadoPagina({ titulo, count, children }: {
  titulo: string;
  count?: number | string;
  children?: ReactNode;
}) { /* título a la izquierda, acciones a la derecha, sin caja */ }

/**
 * Rejilla de métricas sobre el fondo de la página.
 * Rejilla y no flex-wrap: así las cajas quedan del mismo ancho en vez de dejar
 * sobras al final de la fila.
 */
export function FranjaMetricas({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
```

- [ ] **Step 2: Arreglar `StatCard`**

Gana `nota?: string` (la línea de apoyo) y **cambia `bg-background` por `bg-card`**: hoy es
una caja marfil dentro de una tarjeta blanca, o sea un hueco hundido. Fuera, sobre el
fondo marfil de la página, tiene que ser la blanca que resalta.

`StatRow` se conserva para las pestañas que aún no se rediseñan.

- [ ] **Step 3: Verificar y commitear**

```bash
cd frontend && npm run build && npm run lint 2>&1 | tail -3
git add frontend/src/pages/dashboard/ui.tsx
git commit -m "feat(dashboard): encabezado y metricas fuera de la tarjeta de contenido"
```

---

### Task 5: El resumen del pedido

**Files:**
- Create: `frontend/src/pages/dashboard/pedido/ResumenPedido.tsx`

**Interfaces:**
- Consumes: `formatPrice` de `../helpers`.
- Produces: `<ResumenPedido subtotal ahorroCombo cupon total etiquetaTotal onUsar? />`. Lo usan las tareas 7 y 8.

- [ ] **Step 1: Escribir el componente**

Pinta una línea por concepto y el total resaltado. **Las líneas que valen cero no se pintan**: un resumen con "Combo −$0" es ruido. `onUsar`, si viene, pinta el botón "usar el sugerido" (Ventas); Créditos no lo pasa porque su deuda ya se sincroniza sola.

- [ ] **Step 2: Verificar y commitear**

```bash
cd frontend && npm run build && npm run lint 2>&1 | tail -3
git add frontend/src/pages/dashboard/pedido/ResumenPedido.tsx
git commit -m "feat(pedido): resumen con subtotal, combo, cupon y total"
```

---

### Task 6: El armador de pedido

**Files:**
- Create: `frontend/src/pages/dashboard/pedido/ArmadorPedido.tsx`

**Interfaces:**
- Consumes: `LineaPedido` y `precioUnitario` (Task 4); `precios[].ml` (Task 1); `BuscadorSelect`, `NativeSelect`, `Input`.
- Produces: `<ArmadorPedido lineas onChange catalogo combos? aplicarCombo? onAplicarCombo? permitirSinDescuento? onCrearProducto? />`. Lo usan las tareas 7 y 8.

- [ ] **Step 1: El selector de talla sale de `precios[]`**

Elegir una talla fija **a la vez** `presentacion` y `ml`, tomando ambos de la misma entrada de `perfume.precios[]`. Es lo que hace imposible que se desincronicen.

- [ ] **Step 2: Conservar el comportamiento bueno que ya existe**

- Agregar un producto que ya está **con la misma talla** suma unidades.
- Cambiar la talla de una línea hasta dejarla idéntica a otra **fusiona las dos**.

Sin esto la misma referencia aparece dos veces y el conteo miente. Ya funciona así en `VentasTab` (`agregarLinea` / `actualizarLinea`): se traslada, no se reinventa.

- [ ] **Step 3: Lo que es opcional**

El interruptor de combo y el check "sin −X%" solo se pintan si la pantalla los pide. `onCrearProducto` añade "+ Crear producto nuevo" al buscador (hoy solo Ventas).

- [ ] **Step 4: Verificar y commitear**

```bash
cd frontend && npm run build && npm run lint 2>&1 | tail -3
git add frontend/src/pages/dashboard/pedido/ArmadorPedido.tsx
git commit -m "feat(pedido): armador de lineas compartido"
```

---

### Task 7: Ventas

**Files:**
- Create: `frontend/src/pages/dashboard/tabs/VentaForm.tsx`
- Modify: `frontend/src/pages/dashboard/tabs/VentasTab.tsx`

- [ ] **Step 1: Sacar el modal a su propio archivo**

`VentasTab` se queda con la lista, las métricas y el estado; `VentaForm` recibe lo que necesita por props. Objetivo: ninguno por encima de ~350 líneas.

- [ ] **Step 2: Los tres bloques y el armador**

Con `BloqueCampos`: *¿Cuándo y a quién?*, *¿Qué se llevó?*, *¿Cuánto y cómo?*. El armador y el resumen sustituyen la lista de líneas actual.

- [ ] **Step 3: Quitar el campo "Cantidad"**

Se elimina el `<Field label="Cantidad *">` (`VentasTab.tsx:512`) y su aviso de discrepancia. `cantidad_perfumes` se sigue mandando al servidor, calculado con `unidadesDeLineas`.

- [ ] **Step 4: El sugerido**

El total con descuento de página y precio de combo aplicados. Botón "usar el sugerido" que rellena `valor_venta`. **No se aplica solo.**

- [ ] **Step 5: El cupón**

- Conservar **tal cual** el guardarraíl anti doble descuento (`cuponYaEnLaVenta`, `cuponAplicado`, `topeRecorto`). No "mejorarlo".
- Si la venta que se edita tiene un código **canjeado**, el campo va `disabled` con la nota de que para cambiarlo hay que eliminar la venta.

- [ ] **Step 6: Métricas, tarjeta y errores**

Métrica principal con la comparación del mes anterior; las demás en la línea de apoyo. `numerada`, `tarjetaMovil` y `accionesMovil` en la tabla, con los papeles `movil` en `ventasColumns`. `handleDelete` mira `res.ok` y avisa; el `alert()` de enlazar perfumes pasa a toast; `load()` con `try/catch/finally` y botón de reintentar.

- [ ] **Step 7: Verificar y commitear**

```bash
cd frontend && npm run build && npm run lint 2>&1 | tail -3
git add frontend/src/pages/dashboard/tabs/VentasTab.tsx frontend/src/pages/dashboard/tabs/VentaForm.tsx frontend/src/pages/dashboard/columns.tsx
git commit -m "feat(ventas): armador compartido, total sugerido y metricas con comparacion"
```

---

### Task 8: Créditos

**Files:**
- Create: `frontend/src/pages/dashboard/tabs/CreditoForm.tsx`
- Modify: `frontend/src/pages/dashboard/tabs/CreditosTab.tsx`

- [ ] **Step 1: Mismo troceado y mismas piezas**

`CreditoForm` con el armador (`permitirSinDescuento`, combo con interruptor) y el resumen. Conservar: fecha límite que se recorre con la fecha, deuda editable a mano con "usar el calculado", y el aviso de que el cupón se consume al instante.

- [ ] **Step 2: Las métricas que no tenía**

"Te deben hoy" como número principal, y debajo vencido y abonado del mes, desde `/creditos/totales`.

- [ ] **Step 3: Tarjeta y errores**

`numerada`, `tarjetaMovil` y papeles `movil` en `creditosColumns`. `handleDelete` avisa si falla; los `alert()` de abono y de cupo pasan a toast; `load()` con `try/catch/finally`.

- [ ] **Step 4: Verificar y commitear**

```bash
cd frontend && npm run build && npm run lint 2>&1 | tail -3
git add frontend/src/pages/dashboard/tabs/CreditosTab.tsx frontend/src/pages/dashboard/tabs/CreditoForm.tsx frontend/src/pages/dashboard/columns.tsx
git commit -m "feat(creditos): armador compartido y metricas de cartera"
```

---

### Task 9: Verificación

Ninguna comprobación se reporta como cumplida sin haberla ejecutado y visto el resultado.

- [ ] **Step 1: Admin temporal**

Crear el admin temporal en `perfumes_db` (bcryptjs 10 vueltas, `rol_id = 1`, `activo = 1`, **`updated_at` a mano**: MySQL le pone fecha cero y Prisma revienta con `P2020`). Borrarlo al terminar junto con las capturas y `.playwright-mcp`.

- [ ] **Step 2: Las 11 pruebas de la sección 6 del diseño**

Con números concretos y contrastadas contra la base. Las que no se pueden hacer sin destruir datos se montan **de ida y vuelta**, dejando la base igual que al empezar.

- [ ] **Step 3: No regresión**

Perfumes, Combos y Clasificaciones, en 1440px y 390px.

- [ ] **Step 4: Limpiar y documentar**

Borrar el admin temporal. Comprobar que el linter sigue en 46 errores. Registrar en `CLAUDE.md` lo decidido: el armador compartido, el `ml` en los precios, y **la regla nueva del cupón canjeado** (que es la que cambia el comportamiento del negocio).

---

## Cobertura del diseño

| Sección del diseño | Tarea |
|---|---|
| §5.1a `ml` en precios | Task 1 |
| §5.1c blindaje del cupón | Task 2 (+ pantalla en Task 7 step 5) |
| §5.1b totales de créditos, §5.1d mes anterior | Task 3 |
| §5.2 `lineasPedido`, `ResumenPedido`, `ArmadorPedido` | Tasks 4, 5, 6 |
| §5.3 Ventas | Task 7 |
| §5.4 Créditos | Task 8 |
| §5.5 fallos silenciosos | Task 7 step 6, Task 8 step 3 |
| §5.6 tamaño de los archivos | Tasks 7 y 8 |
| §6 verificación | Task 9 |
