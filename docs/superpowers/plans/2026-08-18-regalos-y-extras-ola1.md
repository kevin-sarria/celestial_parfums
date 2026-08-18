# Regalos y extras en la venta (Ola 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** cualquier línea de una venta (perfume o accesorio) puede tener parte de su cantidad
regalada, y los accesorios (perfumero, bolsa, tarjeta) se agregan a la venta desde su propio
buscador — reemplazando el mecanismo `regalo_automatico` de la sesión anterior, que nunca llegó
a producción.

**Architecture:** dos columnas nuevas (`perfumes.es_accesorio`, `venta_perfume.regalo`) sobre el
modelo que ya existe — sin tabla nueva. El motor de consumo de inventario no cambia (sigue
descontando `cantidad`); solo cambia cómo se COBRA una línea (`cantidad − regalo`), que es
cálculo puro en el frontend. El backend valida `regalo <= cantidad` para que nadie lo rompa
saltándose la pantalla.

**Tech Stack:** Prisma 6 + MySQL (backend), React + TypeScript (frontend), Vitest (unit/bd/e2e),
Playwright vía `playwright-core` para los recorridos.

**Spec:** `docs/superpowers/specs/2026-08-18-regalos-y-extras-design.md` — leerlo antes de
empezar. Este plan solo cubre la **Ola 1** (el campo Regalo + el buscador de accesorios); el kit
del combo (Ola 2) es un plan aparte, posterior.

## Global Constraints

- Ningún archivo `.ts`/`.tsx` supera ~500 líneas.
- El cliente de Prisma se importa de `@prisma/client`, nunca de una ruta dentro de `src/`.
- Nada de `PUT` (el CORS del proyecto no lo permite).
- Toda mutación mira la respuesta del servidor y avisa con `toast` — nunca `if (!res.ok) return;`
  mudo.
- Un componente nunca se declara dentro de otro.
- `regalo <= cantidad` se valida en el **servidor**, no solo en la pantalla.
- Migraciones locales: `prisma migrate deploy` y `prisma migrate diff` **revientan** el MySQL de
  XAMPP (ver `docs/gotchas.md`). Se aplica el `.sql` a mano con `mysql.exe` y se registra con
  `npx prisma migrate resolve --applied <nombre>` contra `perfumes_db` Y `perfumes_test`
  (`DATABASE_URL` distinto para cada una).
- Cada tarea termina con `npx tsc --noEmit` limpio (backend y/o frontend, según lo que tocó) antes
  de pasar a la siguiente.

---

## File Structure

**Backend — se modifican:**
- `backend/prisma/schema.prisma` — columnas nuevas, se quita `regalo_automatico`.
- `backend/prisma/migrations/20260818120000_regalos_y_extras/migration.sql` — nueva.
- `backend/src/types/perfume.type.ts`, `backend/src/schemas/perfume.schema.ts`,
  `backend/src/repositories/perfume.repository.ts`, `backend/src/repositories/perfume.mapeo.ts`
  — `es_accesorio` entra, `regalo_automatico` sale.
- `backend/src/types/venta.type.ts`, `backend/src/schemas/venta.schema.ts`,
  `backend/src/repositories/venta.repository.ts` — `regalo` por línea.
- `backend/src/repositories/perfume.regaloAutomatico.bd.test.ts` — se borra (prueba una
  funcionalidad que desaparece).
- `backend/e2e/regaloAutomatico.e2e.test.ts` — se borra (mismo motivo).

**Backend — se crean:**
- `backend/src/repositories/venta.regalo.bd.test.ts` — pruebas del candado y la fusión.
- `backend/e2e/regaloDeLinea.e2e.test.ts` — recorrido de punta a punta.

**Frontend — se modifican:**
- `frontend/src/domain/entities/perfume.schema.ts` — `es_accesorio` entra, `regalo_automatico`
  sale.
- `frontend/src/pages/dashboard/types.ts` — `PerfumeForm`/`emptyPerfumeForm`.
- `frontend/src/pages/dashboard/tabs/PerfumesTab.tsx` — casilla nueva, casilla vieja fuera.
- `frontend/src/pages/dashboard/pedido/lineasPedido.ts` — `regalo: number`, cálculo de cobro.
- `frontend/src/pages/dashboard/pedido/ArmadorPedido.tsx` — segundo buscador, campo Regalo.
- `frontend/src/pages/dashboard/tabs/VentaForm.tsx` — se quita el mecanismo viejo; se manda
  `regalo` al guardar y se reconstruye al editar.
- `frontend/src/pages/dashboard/pedido/lineasPedido.test.ts` — pruebas del cálculo (nuevo
  archivo si no existe; revisar primero).

---

### Task 1: Migración de base de datos

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260818120000_regalos_y_extras/migration.sql` — si esta
  tarea se ejecuta otro día, cambiar el prefijo `20260818120000` por la fecha real
  (`YYYYMMDDHHMMSS`), siguiendo las migraciones ya existentes en esa carpeta; el resto del
  nombre (`_regalos_y_extras`) se queda igual.

**Interfaces:**
- Produces: columna `perfumes.es_accesorio` (`Boolean`, default `false`), columna
  `venta_perfume.regalo` (`Int unsigned`, default `0`). Ya no existe `perfumes.regalo_automatico`.

- [ ] **Step 1: Editar `schema.prisma` — quitar `regalo_automatico`, agregar `es_accesorio`**

Buscar en el modelo `Perfume` el bloque:

```prisma
  /// El producto que Registrar venta sugiere regalar en 100 ml sueltos y en
  /// cualquier combo (uno solo por venta, sin importar cuántas botellas
  /// lleve). Decidido con el dueño el 2026-08-17: solo UN perfume puede
  /// llevarla a la vez, así que `editPerfume`/`createPerfume` se la quitan al
  /// anterior cuando se marca una ficha nueva.
  regalo_automatico  Boolean               @default(false)
```

Reemplazarlo por:

```prisma
  /// Marca que esta ficha NO es una fragancia — es un accesorio (perfumero,
  /// bolsa, tarjeta). Reemplaza a `regalo_automatico` (2026-08-17, nunca llegó
  /// a producción): en vez de UN producto marcado como "el regalo", cualquier
  /// línea de la venta puede regalar parte de su cantidad (ver
  /// `venta_perfume.regalo`), y este campo solo separa accesorios de
  /// fragancias en los buscadores y en los reportes.
  /// Solo tiene sentido con `tipo_producto = comprado`: se valida al guardar.
  es_accesorio       Boolean               @default(false)
```

- [ ] **Step 2: Editar `schema.prisma` — agregar `regalo` a `VentaPerfume`**

Buscar el modelo `VentaPerfume`:

```prisma
model VentaPerfume {
  id         Int     @id @default(autoincrement())
  venta_id   Int
  perfume_id Int
  /// Talla en mililitros. Null = las ventas históricas (que no la guardaban) y
  \ los productos que no son perfume: una gorra no tiene ml. Sin ml NO se
  /// descuenta inventario, porque no se sabe qué receta aplicar.
  ml         Int?
  // Unidades de ESTA fragancia y talla dentro de la venta.
  cantidad   Int     @default(1) @db.UnsignedSmallInt
  venta      Venta   @relation(fields: [venta_id], references: [id], onDelete: Cascade)
  perfume    Perfume @relation(fields: [perfume_id], references: [id], onDelete: Cascade)

  @@unique([venta_id, perfume_id, ml])
  @@index([venta_id])
  @@index([perfume_id])
  @@map("venta_perfume")
}
```

Agregar la columna después de `cantidad`:

```prisma
  // Unidades de ESTA fragancia y talla dentro de la venta.
  cantidad   Int     @default(1) @db.UnsignedSmallInt
  /// Cuántas de esas unidades van SIN COBRAR (regalo). Nunca mayor que
  /// `cantidad` — se valida en el esquema de Zod, no solo en la pantalla.
  /// El inventario descuenta `cantidad` completa: lo regalado también salió
  /// de la bodega. Reemplaza al `regalo: boolean` que existió una sesión en
  /// `LineaPedido` del frontend (nunca llegó a la base).
  regalo     Int     @default(0) @db.UnsignedSmallInt
```

- [ ] **Step 3: Escribir el SQL de la migración**

```sql
-- Reemplaza `regalo_automatico` (2026-08-17, nunca desplegado) por un modelo
-- general: cualquier línea de venta puede regalar parte de su cantidad, y
-- cualquier perfume puede marcarse como accesorio (no fragancia).
ALTER TABLE `perfumes`
  DROP COLUMN `regalo_automatico`,
  ADD COLUMN `es_accesorio` BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE `venta_perfume`
  ADD COLUMN `regalo` SMALLINT UNSIGNED NOT NULL DEFAULT 0;
```

- [ ] **Step 4: Aplicar la migración a mano en `perfumes_db` y `perfumes_test`**

```bash
"C:/xampp/mysql/bin/mysql.exe" -u root --default-character-set=utf8mb4 perfumes_db \
  -e "source backend/prisma/migrations/20260818120000_regalos_y_extras/migration.sql"
"C:/xampp/mysql/bin/mysql.exe" -u root --default-character-set=utf8mb4 perfumes_test \
  -e "source backend/prisma/migrations/20260818120000_regalos_y_extras/migration.sql"
```

Registrar en las dos bases (no usar `migrate deploy`, revienta el MySQL local — ver
`docs/gotchas.md`):

```bash
cd backend
npx prisma migrate resolve --applied 20260818120000_regalos_y_extras
DATABASE_URL="mysql://root:@localhost:3306/perfumes_test" npx prisma migrate resolve --applied 20260818120000_regalos_y_extras
npx prisma generate
```

- [ ] **Step 5: Verificar**

```bash
"C:/xampp/mysql/bin/mysql.exe" -u root perfumes_db -e "SHOW COLUMNS FROM perfumes LIKE 'es_accesorio';"
"C:/xampp/mysql/bin/mysql.exe" -u root perfumes_db -e "SHOW COLUMNS FROM venta_perfume LIKE 'regalo';"
"C:/xampp/mysql/bin/mysql.exe" -u root perfumes_db -e "SHOW COLUMNS FROM perfumes LIKE 'regalo_automatico';"
```

Las dos primeras deben devolver una fila; la tercera, ninguna. Repetir contra `perfumes_test`.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260818120000_regalos_y_extras/
git commit -m "feat(db): agrega perfumes.es_accesorio y venta_perfume.regalo, quita regalo_automatico"
```

---

### Task 2: Backend — ficha de perfume (`es_accesorio`)

**Files:**
- Modify: `backend/src/types/perfume.type.ts`
- Modify: `backend/src/schemas/perfume.schema.ts`
- Modify: `backend/src/repositories/perfume.repository.ts`
- Modify: `backend/src/repositories/perfume.mapeo.ts`
- Delete: `backend/src/repositories/perfume.regaloAutomatico.bd.test.ts`

**Interfaces:**
- Consumes: `es_accesorio` de la migración (Task 1).
- Produces: `CreatePerfumeDTO.es_accesorio?: boolean`; `mapPerfume(...).es_accesorio: boolean`.

- [ ] **Step 1: `perfume.type.ts` — quitar `regalo_automatico`, agregar `es_accesorio`**

En `CreatePerfumeDTO`, reemplazar:

```ts
  /** El producto que se sugiere de regalo en 100 ml sueltos y en cualquier combo. */
  regalo_automatico?: boolean;
```

por:

```ts
  /** Marca que esta ficha es un accesorio (perfumero, bolsa, tarjeta), no una fragancia. */
  es_accesorio?: boolean;
```

- [ ] **Step 2: `perfume.schema.ts` — quitar el campo viejo, agregar el nuevo con su regla**

Reemplazar:

```ts
  /// El producto que Ventas sugiere regalar en 100 ml sueltos y en cualquier combo. Solo uno a la vez.
  regalo_automatico: z.boolean().optional(),
```

por:

```ts
  /// Marca que esta ficha es un accesorio (perfumero, bolsa, tarjeta), no una fragancia.
  /// Solo tiene sentido en un producto `comprado` (sin receta ni talla).
  es_accesorio: z.boolean().optional(),
```

Y agregar la regla al `.superRefine` del esquema (si `createPerfumeSchema` no tiene uno, envolver
el `z.object({...})` en `.superRefine((v, ctx) => {...})`):

```ts
.superRefine((v, ctx) => {
  if (v.es_accesorio && (v.tipo_producto ?? 'fabricado') !== 'comprado') {
    ctx.addIssue({
      code: 'custom', path: ['es_accesorio'],
      message: 'Un accesorio debe ser "Lo compro hecho y lo revendo" (comprado), no tiene receta ni talla',
    });
  }
})
```

- [ ] **Step 3: `perfume.repository.ts` — quitar la lógica de "solo uno a la vez", agregar el campo**

En `createPerfume`, quitar el bloque:

```ts
  // Solo una ficha a la vez puede ser el regalo automático: si esta lo marca,
  // se lo quita a la anterior para no dejar dos productos disputando el botón.
  if (data.regalo_automatico) {
    await prisma.perfume.updateMany({ where: { regalo_automatico: true }, data: { regalo_automatico: false } });
  }
```

y cambiar la línea `regalo_automatico: data.regalo_automatico ?? false,` por
`es_accesorio: data.es_accesorio ?? false,`.

En `editPerfume`, quitar el bloque de la transacción:

```ts
    // Mismo criterio que crear: si ESTA ficha se marca como el regalo, se lo
    // quita a cualquier otra que lo tuviera (nunca dos a la vez).
    ...(data.regalo_automatico
      ? [prisma.perfume.updateMany({
          where: { regalo_automatico: true, id: { not: numId } },
          data: { regalo_automatico: false },
        })]
      : []),
```

y cambiar `...(data.regalo_automatico !== undefined ? { regalo_automatico: data.regalo_automatico } : {}),`
por `...(data.es_accesorio !== undefined ? { es_accesorio: data.es_accesorio } : {}),`.

- [ ] **Step 4: `perfume.mapeo.ts` — exponer el campo**

Cambiar:

```ts
    /** El que Registrar venta sugiere regalar en 100 ml sueltos y en cualquier combo. */
    regalo_automatico: p.regalo_automatico,
```

por:

```ts
    /** Es un accesorio (perfumero, bolsa, tarjeta), no una fragancia. */
    es_accesorio: p.es_accesorio,
```

- [ ] **Step 5: Borrar la prueba de la funcionalidad retirada**

```bash
rm backend/src/repositories/perfume.regaloAutomatico.bd.test.ts
```

- [ ] **Step 6: Verificar que compila**

```bash
cd backend && npx tsc --noEmit
```

Debe quedar limpio. Si algo más referencia `regalo_automatico`, aparecerá aquí.

- [ ] **Step 7: Commit**

```bash
git add backend/src/types/perfume.type.ts backend/src/schemas/perfume.schema.ts \
  backend/src/repositories/perfume.repository.ts backend/src/repositories/perfume.mapeo.ts
git rm backend/src/repositories/perfume.regaloAutomatico.bd.test.ts
git commit -m "feat(backend): perfumes.es_accesorio reemplaza a regalo_automatico"
```

---

### Task 3: Backend — línea de venta con `regalo`

**Files:**
- Modify: `backend/src/schemas/venta.schema.ts`
- Modify: `backend/src/types/venta.type.ts`
- Modify: `backend/src/repositories/venta.repository.ts`
- Create: `backend/src/repositories/venta.regalo.bd.test.ts`

**Interfaces:**
- Consumes: columna `venta_perfume.regalo` (Task 1).
- Produces: `lineasDeVenta(...)` devuelve objetos `{ perfume_id, ml, cantidad, regalo }`;
  `mapVenta(...).perfumes[].regalo: number`.

- [ ] **Step 1: `venta.schema.ts` — aceptar `regalo` por línea, con su candado**

En el `z.array(z.object({...}))` de `lineas`, agregar el campo:

```ts
  lineas: z.array(z.object({
    perfume_id: z.number().int().positive(),
    ml: z.number().int().positive().nullish(),
    cantidad: z.number().int().min(1).max(999).default(1),
    /** Cuántas de esa cantidad van sin cobrar. Nunca mayor que la cantidad. */
    regalo: z.number().int().min(0).max(999).default(0),
  }).refine((l) => l.regalo <= l.cantidad, {
    message: 'El regalo no puede ser mayor que la cantidad',
    path: ['regalo'],
  })).optional(),
```

- [ ] **Step 2: `venta.schema.ts` — sumar `regalo` al agrupar líneas repetidas**

En `lineasDeVenta`, el mapa que agrupa por producto+talla hoy es:

```ts
    const mapa = new Map<string, { perfume_id: number; ml: number | null; cantidad: number }>();
    for (const l of v.lineas) {
      const ml = l.ml ?? null;
      const clave = `${l.perfume_id}|${ml ?? ''}`;
      const previa = mapa.get(clave);
      if (previa) previa.cantidad += l.cantidad;
      else mapa.set(clave, { perfume_id: l.perfume_id, ml, cantidad: l.cantidad });
    }
    return [...mapa.values()];
```

Cambiarlo a:

```ts
    const mapa = new Map<string, { perfume_id: number; ml: number | null; cantidad: number; regalo: number }>();
    for (const l of v.lineas) {
      const ml = l.ml ?? null;
      const clave = `${l.perfume_id}|${ml ?? ''}`;
      const previa = mapa.get(clave);
      if (previa) { previa.cantidad += l.cantidad; previa.regalo += l.regalo; }
      else mapa.set(clave, { perfume_id: l.perfume_id, ml, cantidad: l.cantidad, regalo: l.regalo });
    }
    return [...mapa.values()];
```

Y en la rama vieja (`perfume_ids`, sin líneas), agregar `regalo: 0` al objeto que arma:
`return [...conteo].map(([perfume_id, cantidad]) => ({ perfume_id, ml: null, cantidad, regalo: 0 }));`.

**Por qué no hace falta validar el candado otra vez después de agrupar**: si cada línea de
entrada ya cumple `regalo <= cantidad` (Step 1 lo garantiza), la suma también lo cumple —
sumar dos pares que cumplen la desigualdad no puede romperla.

- [ ] **Step 3: `venta.type.ts` — reflejar el campo en el tipo suelto**

`CreateVentaDTO` no declara `lineas` hoy (es un tipo desactualizado que solo compila porque
`lineas` es opcional en `CreateVentaInput`). No hace falta tocarlo para esta tarea — el tipo real
en tiempo de ejecución es `CreateVentaInput` de `venta.schema.ts`, ya cubierto en el Step 1. Se
deja así a propósito para no ensanchar esta tarea con una limpieza de tipos que no toca este
cambio.

- [ ] **Step 4: `venta.repository.ts` — exponer `regalo` en `mapVenta`**

Cambiar:

```ts
  perfumes:           (v.perfumes ?? []).map((vp: any) => ({ id: vp.perfume.id, nombre: vp.perfume.nombre, ml: vp.ml ?? null, cantidad: vp.cantidad ?? 1 })),
```

por:

```ts
  perfumes:           (v.perfumes ?? []).map((vp: any) => ({
    id: vp.perfume.id, nombre: vp.perfume.nombre, ml: vp.ml ?? null,
    cantidad: vp.cantidad ?? 1, regalo: vp.regalo ?? 0,
  })),
```

- [ ] **Step 5: Escribir la prueba que falla — el candado**

Crear `backend/src/repositories/venta.regalo.bd.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createVentaSchema, lineasDeVenta } from '../schemas/venta.schema';
import { limpiarBase, sembrarFabricacion30ml } from '../test/baseDePrueba';
import { createVenta } from './venta.repository';

/**
 * `venta_perfume.regalo`: cuántas unidades de una línea van sin cobrar.
 * Nunca mayor que `cantidad` — se valida en el esquema, no solo en la
 * pantalla (decidido en el diseño del 2026-08-18).
 */

describe('regalo por línea', () => {
  beforeEach(limpiarBase);

  it('el esquema rechaza un regalo mayor que la cantidad', () => {
    const resultado = createVentaSchema.safeParse({
      dia: '2026-08-18', persona: 'Prueba', cantidad_perfumes: 2,
      lineas: [{ perfume_id: 1, ml: 30, cantidad: 2, regalo: 3 }],
      valor_venta: 10000,
    });
    expect(resultado.success).toBe(false);
  });

  it('el esquema acepta regalo igual a la cantidad (100% gratis)', () => {
    const resultado = createVentaSchema.safeParse({
      dia: '2026-08-18', persona: 'Prueba', cantidad_perfumes: 2,
      lineas: [{ perfume_id: 1, ml: 30, cantidad: 2, regalo: 2 }],
      valor_venta: 10000,
    });
    expect(resultado.success).toBe(true);
  });

  it('agrupar dos líneas del mismo producto suma cantidad y regalo por separado', () => {
    const parsed = createVentaSchema.parse({
      dia: '2026-08-18', persona: 'Prueba', cantidad_perfumes: 3,
      lineas: [
        { perfume_id: 1, ml: 30, cantidad: 1, regalo: 0 },
        { perfume_id: 1, ml: 30, cantidad: 2, regalo: 1 },
      ],
      valor_venta: 10000,
    });
    const lineas = lineasDeVenta(parsed);
    expect(lineas).toEqual([{ perfume_id: 1, ml: 30, cantidad: 3, regalo: 1 }]);
  });

  it('una venta guardada con regalo lo conserva y el inventario descuenta la cantidad completa', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    const venta = await createVenta({
      dia: '2026-08-18', persona: 'Prueba', cantidad_perfumes: 2, presentacion: '30ML',
      perfume_ids: [], user_id: null,
      // @ts-expect-error -- CreateVentaDTO está desactualizado (ver Task 3, Step 3); en
      // tiempo de ejecución el controlador pasa el body ya validado por Zod, que sí trae `lineas`.
      lineas: [{ perfume_id: s.perfume.id, ml: 30, cantidad: 2, regalo: 1 }],
      valor_venta: 60000,
    } as any);
    expect(venta.perfumes[0].cantidad).toBe(2);
    expect(venta.perfumes[0].regalo).toBe(1);
  });
});
```

- [ ] **Step 6: Correr las pruebas y ver que fallan donde deben**

```bash
cd backend && npx vitest run --project base venta.regalo
```

Las dos primeras (esquema) deben pasar YA si el Step 1 quedó bien — son pruebas del esquema, no
necesitan el resto. Las últimas dos (agrupar, guardar) deben **fallar** hasta que los Steps 2 y 4
estén hechos: es la señal de que de verdad están probando el código nuevo.

- [ ] **Step 7: Confirmar que las cuatro pasan**

```bash
cd backend && npx vitest run --project base venta.regalo
```

Expected: 4 passed.

- [ ] **Step 8: Verificar que compila**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 9: Commit**

```bash
git add backend/src/schemas/venta.schema.ts backend/src/repositories/venta.repository.ts \
  backend/src/repositories/venta.regalo.bd.test.ts
git commit -m "feat(backend): venta_perfume.regalo, con su candado y su fusión al agrupar líneas"
```

---

### Task 4: Frontend — dominio y formulario de Perfume

**Files:**
- Modify: `frontend/src/domain/entities/perfume.schema.ts`
- Modify: `frontend/src/pages/dashboard/types.ts`
- Modify: `frontend/src/pages/dashboard/tabs/PerfumesTab.tsx`

**Interfaces:**
- Consumes: `es_accesorio` del backend (Task 2).
- Produces: `Perfume.es_accesorio: boolean` (dominio); `PerfumeForm.es_accesorio: boolean`.

- [ ] **Step 1: `perfume.schema.ts` (dominio) — reemplazar el campo**

Cambiar:

```ts
  /** El que Registrar venta sugiere regalar en 100 ml sueltos y en cualquier combo. */
  regalo_automatico: z.boolean().default(false),
```

por:

```ts
  /** Es un accesorio (perfumero, bolsa, tarjeta), no una fragancia. */
  es_accesorio: z.boolean().default(false),
```

- [ ] **Step 2: `types.ts` — reemplazar en `PerfumeForm` y su valor por defecto**

Cambiar:

```ts
  /** El que Registrar venta sugiere regalar en 100 ml sueltos y en cualquier combo. */
  regalo_automatico: boolean;
```

por:

```ts
  /** Es un accesorio (perfumero, bolsa, tarjeta), no una fragancia. */
  es_accesorio: boolean;
```

Y en `emptyPerfumeForm`, cambiar `regalo_automatico: false,` por `es_accesorio: false,`.

- [ ] **Step 3: `PerfumesTab.tsx` — cargar el valor al editar**

Cambiar:

```ts
      regalo_automatico: p.regalo_automatico ?? false,
```

por:

```ts
      es_accesorio: p.es_accesorio ?? false,
```

- [ ] **Step 4: `PerfumesTab.tsx` — mandarlo al guardar**

Cambiar:

```ts
      regalo_automatico: form.regalo_automatico,
```

por:

```ts
      es_accesorio: form.es_accesorio,
```

- [ ] **Step 5: `PerfumesTab.tsx` — reemplazar la casilla del formulario**

Buscar el bloque (justo antes de `{form.tipo_producto !== 'fabricado' && (`):

```tsx
        {/* El botón "+ Agregar regalo" de Registrar venta busca esta ficha por esta
            casilla, no por el nombre: así el dueño puede cambiar de un día para otro
            qué se regala (una tarjeta, otro perfumero) sin tocar código. */}
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-secondary/30 p-2.5 text-[13px] text-foreground">
          <input
            type="checkbox" className="mt-0.5 size-4 accent-primary"
            checked={form.regalo_automatico}
            onChange={e => setForm(f => ({ ...f, regalo_automatico: e.target.checked }))}
          />
          <span>
            Es el regalo automático de Ventas (100 ml sueltos y cualquier combo)
            <span className="block text-[12px] font-normal text-muted-foreground">
              Registrar venta va a sugerir agregarlo gratis, una sola vez por venta sin importar
              cuántas botellas lleve. Solo un producto puede tener esta marca a la vez: marcarla
              aquí se la quita a cualquier otro que la tuviera.
            </span>
          </span>
        </label>
```

Reemplazarlo por (nota: solo tiene sentido con `comprado`, así que se muestra en las mismas
condiciones que el bloque de "¿Qué insumo ES este producto?" — dentro de
`{form.tipo_producto !== 'fabricado' && (...)}`, no antes. Moverlo dentro de ese bloque,
como primer elemento):

```tsx
        {form.tipo_producto !== 'fabricado' && (
          <div className="space-y-3 rounded-lg border border-border bg-secondary/40 p-3">
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-card p-2.5 text-[13px] text-foreground">
              <input
                type="checkbox" className="mt-0.5 size-4 accent-primary"
                checked={form.es_accesorio}
                onChange={e => setForm(f => ({ ...f, es_accesorio: e.target.checked }))}
              />
              <span>
                Es un accesorio, no una fragancia (perfumero, bolsa, tarjeta…)
                <span className="block text-[12px] font-normal text-muted-foreground">
                  Aparece en su propio buscador dentro de Registrar venta, aparte de los 212
                  perfumes, para agregarlo como extra o como regalo en cualquier venta.
                </span>
              </span>
            </label>

            <Field label={form.tipo_producto === 'comprado' ? '¿Qué insumo ES este producto?' : '¿De qué botella sale?'}>
```

(el resto del bloque `<div className="space-y-3...">` sigue exactamente igual — solo se le
agregó la casilla nueva arriba del `<Field>` de insumo, y por eso el `<Field ...>` de abajo YA
NO abre su propio `<div>`: se quita la línea `<div className="space-y-3 rounded-lg...">` que
estaba justo antes del `<Field label=...>` original, porque ahora ese `<div>` lo abre este mismo
bloque más arriba).

- [ ] **Step 6: Verificar que compila**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/domain/entities/perfume.schema.ts frontend/src/pages/dashboard/types.ts \
  frontend/src/pages/dashboard/tabs/PerfumesTab.tsx
git commit -m "feat(frontend): casilla es_accesorio reemplaza a regalo_automatico en Perfumes"
```

---

### Task 5: Frontend — el cálculo de cobro (`lineasPedido.ts`)

**Files:**
- Modify: `frontend/src/pages/dashboard/pedido/lineasPedido.ts`
- Create: `frontend/src/pages/dashboard/pedido/lineasPedido.test.ts` (si no existe — revisar
  primero con `ls frontend/src/pages/dashboard/pedido/*.test.ts`; si ya existe, AGREGAR los
  `describe` de abajo al archivo existente, no duplicar el que ya haya)

**Interfaces:**
- Produces: `LineaPedido.regalo: number` (reemplaza `regalo?: boolean`);
  `unidadesCobradas(l: LineaPedido): number`; `precioUnitario`/`subtotalDeLineas` ajustados.
- Consumed by: `ArmadorPedido.tsx`, `VentaForm.tsx` (Tasks 6 y 7).

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
import { describe, expect, it } from 'vitest';
import type { Perfume } from '../../../domain/entities/perfume.schema';
import {
  articulosDeLineas, precioUnitario, subtotalDeLineas, unidadesCobradas, type LineaPedido,
} from './lineasPedido';

const perfume = (over: Partial<Perfume> = {}): Perfume => ({
  id: 1, nombre: 'Eros', precio: 60000, descuento: 0,
  precios: [{ presentacion: '30ML', ml: 30, precio: 60000, propio: false, presentacion_id: 1, envase_insumo_id: null, accesorios: [] }],
  categoria: null, categoria_id: null, genero: null, esencia_premium: false,
  ...over,
} as Perfume);

const linea = (over: Partial<LineaPedido> = {}): LineaPedido => ({
  key: 'k', perfume_id: 1, nombre: 'Eros', presentacion: '30ML', ml: 30,
  cantidad: 1, regalo: 0, sin_descuento: false,
  ...over,
});

describe('regalo por línea (unidadesCobradas / precioUnitario / subtotal)', () => {
  it('sin regalo, se cobran todas las unidades', () => {
    const porId = new Map([[1, perfume()]]);
    expect(unidadesCobradas(linea({ cantidad: 3, regalo: 0 }))).toBe(3);
    expect(subtotalDeLineas([linea({ cantidad: 3, regalo: 0 })], porId)).toBe(180000);
  });

  it('con regalo parcial, se cobra solo lo que no es regalo', () => {
    const porId = new Map([[1, perfume()]]);
    const l = linea({ cantidad: 2, regalo: 1 });
    expect(unidadesCobradas(l)).toBe(1);
    expect(subtotalDeLineas([l], porId)).toBe(60000);
  });

  it('con regalo total, la línea no suma nada al subtotal', () => {
    const porId = new Map([[1, perfume()]]);
    const l = linea({ cantidad: 2, regalo: 2 });
    expect(subtotalDeLineas([l], porId)).toBe(0);
  });

  it('el texto de artículos marca cuántas van de regalo', () => {
    const porId = new Map([[1, perfume()]]);
    const texto = articulosDeLineas([linea({ cantidad: 2, regalo: 1 })], porId);
    expect(texto).toBe('2× Eros (30ML) [1 regalo]');
  });

  it('sin regalo, el texto de artículos no menciona nada', () => {
    const porId = new Map([[1, perfume()]]);
    const texto = articulosDeLineas([linea({ cantidad: 2, regalo: 0 })], porId);
    expect(texto).toBe('2× Eros (30ML)');
  });
});
```

- [ ] **Step 2: Correr las pruebas y confirmar que fallan**

```bash
cd frontend && npx vitest run lineasPedido
```

Expected: FAIL — `unidadesCobradas` no existe todavía, y `LineaPedido` no tiene `regalo: number`.

- [ ] **Step 3: Implementar — `LineaPedido`, `unidadesCobradas`, `precioUnitario`, `subtotalDeLineas`**

Cambiar la interfaz:

```ts
  cantidad: number;
  /** Quita el descuento de la página en ESTA línea (a crédito no siempre aplica). */
  sin_descuento: boolean;
  /** El "+ Agregar regalo" de Ventas la agrega así: no cuenta en el subtotal
   *  ni en el sugerido, aunque el producto sí tenga precio de venta normal
   *  (para cuando se vende suelto, cobrado). */
  regalo?: boolean;
}
```

por:

```ts
  cantidad: number;
  /** Quita el descuento de la página en ESTA línea (a crédito no siempre aplica). */
  sin_descuento: boolean;
  /**
   * Cuántas de `cantidad` van SIN COBRAR. Nunca mayor que `cantidad` (se
   * valida en el formulario Y en el servidor). Reemplaza al `regalo: boolean`
   * de una sola línea fija en 1 que existió una sesión — con este número,
   * cualquier línea (perfume o accesorio) puede tener parte gratis y parte
   * cobrada, sin necesitar una segunda línea escondida.
   */
  regalo: number;
}
```

Agregar, después de `precioLista`:

```ts
/** Cuántas unidades de la línea SÍ se cobran (la cantidad, menos lo regalado). */
export const unidadesCobradas = (l: LineaPedido) => Math.max(0, l.cantidad - l.regalo);
```

Cambiar `subtotalDeLineas`:

```ts
export const subtotalDeLineas = (lineas: LineaPedido[], porId: Map<number, Perfume>) =>
  lineas.reduce((s, l) => s + precioUnitario(l, porId) * unidadesCobradas(l), 0);
```

Y quitar de `precioUnitario` la línea `if (l.regalo) return 0;` (ya no aplica: el precio unitario
sigue siendo el de una unidad normal; lo que cambia es CUÁNTAS se multiplican, en
`unidadesCobradas`).

- [ ] **Step 4: Implementar — `itemsDeLineas` sigue contando la cantidad FÍSICA**

`itemsDeLineas` alimenta la detección de combos (`detectarCombos`), que necesita saber cuántas
BOTELLAS se están llevando de verdad — el regalo no las hace desaparecer del conteo del combo.
No cambia: sigue usando `l.cantidad` (no `unidadesCobradas(l)`) para el campo `cantidad`. Dejar
esta función tal cual está; **no tocarla** en este paso (es a propósito, no un olvido — anotarlo
con un comentario breve si no lo tiene ya).

- [ ] **Step 5: Implementar — `articulosDeLineas`**

Cambiar:

```ts
      return `${veces}${nombre}${l.presentacion ? ` (${l.presentacion})` : ''}${l.regalo ? ' [regalo]' : ''}`;
```

por:

```ts
      const regaloTxt = l.regalo > 0 ? ` [${l.regalo} regalo]` : '';
      return `${veces}${nombre}${l.presentacion ? ` (${l.presentacion})` : ''}${regaloTxt}`;
```

- [ ] **Step 6: Correr las pruebas y confirmar que pasan**

```bash
cd frontend && npx vitest run lineasPedido
```

Expected: 5 passed (más las que ya hubiera en el archivo, si se agregó a uno existente).

- [ ] **Step 7: Correr TODA la batería de frontend (no regresión)**

```bash
cd frontend && npm test
```

Expected: todas pasan — nada más en el proyecto debía depender de `regalo: boolean`.

- [ ] **Step 8: Verificar que compila**

```bash
cd frontend && npx tsc --noEmit
```

Esto va a marcar en rojo `ArmadorPedido.tsx` y `VentaForm.tsx` (siguen usando `l.regalo` como
boolean) — es esperado, se arreglan en las Tasks 6 y 7. Confirmar que los ÚNICOS errores son en
esos dos archivos antes de seguir.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/dashboard/pedido/lineasPedido.ts frontend/src/pages/dashboard/pedido/lineasPedido.test.ts
git commit -m "feat(frontend): regalo pasa de bandera de línea a número por línea"
```

---

### Task 6: Frontend — `ArmadorPedido.tsx` (dos buscadores + campo Regalo, solo donde aplica)

**Por qué esto es OPT-IN, no automático para todo lo que use `ArmadorPedido`**: el componente lo
comparten Ventas y Créditos (`permitirSinDescuento` ya es un precedente de esto — "Solo
Créditos"). El backend de Créditos **no guarda `regalo` ni acepta accesorios por línea** hoy
(`credito.repository.ts` construye sus líneas con `agruparEnlaces(perfumeIds)`, que solo sabe de
`perfume_id` + cantidad — ni siquiera `ml`). Si el campo Regalo y el buscador de accesorios
aparecieran también en Créditos, el dueño podría escribirlos y que se **descartaran en
silencio** al guardar — justo el defecto que el departamento de QA marca como el peor de todos.
Por eso los dos se activan con una prop nueva, apagada por defecto, que solo Ventas enciende.
Extender Créditos para que también los soporte de verdad queda fuera de esta Ola 1.

**Files:**
- Modify: `frontend/src/pages/dashboard/pedido/ArmadorPedido.tsx`

**Interfaces:**
- Consumes: `LineaPedido.regalo: number`, `unidadesCobradas` (Task 5); `Perfume.es_accesorio`
  (Task 4).
- Produces: el mismo componente, con un buscador nuevo y un campo nuevo por línea, **detrás de
  una prop `permitirExtras?: boolean`** (default `false`/sin definir = igual que hoy). Su prop
  pública `catalogo: Perfume[]` no cambia de forma.

- [ ] **Step 0: Agregar la prop nueva a la interfaz**

En `ArmadorPedidoProps`, agregar junto a `permitirSinDescuento`:

```ts
  /** Solo Ventas: agrega el buscador de accesorios y el campo "Regalo" por línea.
   *  Créditos no la enciende porque su backend no guarda ninguno de los dos todavía. */
  permitirExtras?: boolean;
```

Y agregarla a la desestructuración de props de la función `ArmadorPedido({ ... })`.

- [ ] **Step 1: Separar el catálogo en dos listas (solo tienen efecto con `permitirExtras`)**

Después de la línea `const unidades = unidadesDeLineas(lineas);`, agregar:

```ts
  const fragancias = permitirExtras ? catalogo.filter(p => !p.es_accesorio) : catalogo;
  const accesorios = permitirExtras ? catalogo.filter(p => p.es_accesorio) : [];
```

**Por qué `fragancias = catalogo` completo cuando `permitirExtras` es falso**: en Créditos, todo
el catálogo (incluidos los accesorios que existan) sigue apareciendo en el ÚNICO buscador, igual
que hoy — nada cambia ahí. Filtrar solo tiene sentido cuando hay un SEGUNDO buscador que se
lleve los accesorios; sin él, esconderlos del primero los volvería invisibles para Créditos.

- [ ] **Step 2: Quitar el guarda de fusión `!l.regalo` — vuelve a ser fusión simple**

En `agregar`, cambiar:

```ts
    // Nunca se fusiona con una línea de regalo: sumarle unidades a esa línea
    // las volvería gratis también.
    const i = lineas.findIndex(l => l.perfume_id === id && l.presentacion === presentacion && !l.regalo);
```

por:

```ts
    const i = lineas.findIndex(l => l.perfume_id === id && l.presentacion === presentacion);
```

Y en la línea que crea la línea nueva, agregar `regalo: 0,` junto a `sin_descuento: false,`.

En `actualizar`, cambiar la condición de `gemela`:

```ts
    const gemela = siguientes.findIndex(
      (l, i) => i !== idx && l.perfume_id === actual.perfume_id
        && l.presentacion === actual.presentacion && l.regalo === actual.regalo,
    );
```

por:

```ts
    const gemela = siguientes.findIndex(
      (l, i) => i !== idx && l.perfume_id === actual.perfume_id && l.presentacion === actual.presentacion,
    );
```

(dos líneas del mismo producto+talla se fusionan SIEMPRE ahora, sin importar su `regalo` — si
llegaran a fusionarse con distinto `regalo`, la fusión debe sumar también el regalo: en el bloque
que hace `siguientes[gemela] = { ...siguientes[gemela], cantidad: siguientes[gemela].cantidad + actual.cantidad };`
agregar también `regalo: siguientes[gemela].regalo + actual.regalo`).

- [ ] **Step 3: Agregar el segundo buscador**

Después del `<BuscadorSelect ...opciones={[...catalogo...]}` ya existente (el de perfumes),
cambiar su `opciones` para que use `fragancias` en vez de `catalogo`:

```tsx
      <BuscadorSelect
        opciones={[
          ...(onCrearProducto ? [{ id: 'nuevo', nombre: '+ Crear producto nuevo (no está en el catálogo)' }] : []),
          ...fragancias.map(p => ({ id: p.id, nombre: p.nombre })),
        ]}
        placeholder={placeholder}
        vacio="Sin productos en el catálogo"
        onSelect={id => {
          if (String(id) === 'nuevo') onCrearProducto?.();
          else agregar(Number(id));
        }}
      />

      {permitirExtras && accesorios.length > 0 && (
        <BuscadorSelect
          opciones={accesorios.map(p => ({ id: p.id, nombre: p.nombre }))}
          placeholder="Buscar y agregar accesorio (perfumero, bolsa, tarjeta…)"
          vacio="Sin accesorios en el catálogo"
          onSelect={id => agregar(Number(id))}
        />
      )}
```

**Por qué también se esconde si `accesorios.length === 0`**: si el dueño todavía no ha creado
ninguna ficha marcada `es_accesorio`, mostrar un buscador vacío es un campo muerto en la
pantalla — mismo criterio que el resto del proyecto (una pieza sin datos no se pinta).

- [ ] **Step 4: Reemplazar el campo de cantidad bloqueada por Cantidad + Regalo**

Cambiar:

```tsx
                {/* El regalo es siempre 1 por venta: subirle cantidad regalaría más de lo pactado. */}
                <Input
                  type="number" min="1" value={l.cantidad}
                  disabled={l.regalo}
                  className="h-8 w-16 text-[12.5px] disabled:opacity-60"
                  aria-label="Cantidad"
                  onChange={e => actualizar(l.key, { cantidad: Math.max(1, Number(e.target.value) || 1) })}
                />
```

por:

```tsx
                <Input
                  type="number" min="1" value={l.cantidad}
                  className="h-8 w-16 text-[12.5px]"
                  aria-label="Cantidad"
                  onChange={e => {
                    const cantidad = Math.max(1, Number(e.target.value) || 1);
                    // El regalo nunca puede quedar por encima de la cantidad nueva.
                    actualizar(l.key, { cantidad, regalo: Math.min(l.regalo, cantidad) });
                  }}
                />
                {permitirExtras && (
                  <Input
                    type="number" min="0" max={l.cantidad} value={l.regalo}
                    className="h-8 w-16 text-[12.5px]"
                    aria-label="Regalo"
                    title="Cuántas de estas van sin cobrar"
                    onChange={e => {
                      const regalo = Math.min(l.cantidad, Math.max(0, Number(e.target.value) || 0));
                      actualizar(l.key, { regalo });
                    }}
                  />
                )}
```

**En Créditos, `l.regalo` sigue existiendo en el objeto (siempre 0) pero no hay forma de
cambiarlo** — exactamente lo que se quiere: el campo nunca queda en un valor que el backend de
Créditos no vaya a guardar.

- [ ] **Step 5: Quitar la insignia "Regalo" vieja (booleana) y mostrar el precio ya con el descuento del regalo**

Cambiar:

```tsx
                <span className="min-w-32 flex-1 text-[13px] font-medium text-foreground">
                  {p?.nombre ?? l.nombre ?? `#${l.perfume_id}`}
                  {l.regalo && (
                    <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-primary">
                      Regalo
                    </span>
                  )}
                </span>
```

por:

```tsx
                <span className="min-w-32 flex-1 text-[13px] font-medium text-foreground">
                  {p?.nombre ?? l.nombre ?? `#${l.perfume_id}`}
                  {l.regalo > 0 && (
                    <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-primary">
                      {l.regalo === l.cantidad ? 'Regalo' : `${l.regalo} regalo`}
                    </span>
                  )}
                </span>
```

Y cambiar el precio mostrado:

```tsx
                <span className="w-24 text-right text-[12.5px] font-semibold tabular-nums text-foreground">
                  {formatPrice(precioUnitario(l, porId) * l.cantidad)}
                </span>
```

por:

```tsx
                <span className="w-24 text-right text-[12.5px] font-semibold tabular-nums text-foreground">
                  {formatPrice(precioUnitario(l, porId) * unidadesCobradas(l))}
                </span>
```

(agregar `unidadesCobradas` al `import { precioUnitario, unidadesDeLineas, type LineaPedido } from './lineasPedido';`
de arriba del archivo).

- [ ] **Step 6: Verificar que compila**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/dashboard/pedido/ArmadorPedido.tsx
git commit -m "feat(frontend): buscador de accesorios + campo Regalo por línea en ArmadorPedido"
```

---

### Task 7: Frontend — `VentaForm.tsx` (quitar lo viejo, mandar `regalo`)

**Files:**
- Modify: `frontend/src/pages/dashboard/tabs/VentaForm.tsx`

**Interfaces:**
- Consumes: `LineaPedido.regalo: number` (Task 5), `ArmadorPedido` ya actualizado (Task 6).
- Produces: el body que manda al servidor incluye `regalo` por línea.

- [ ] **Step 1: Quitar el mecanismo `regalo_automatico` completo**

Borrar el bloque entero (comentario incluido):

```ts
  /**
   * El regalo automático (decidido con el dueño el 2026-08-17): UN producto,
   * marcado en su ficha, se sugiere gratis una sola vez por venta — nunca uno
   * por botella — cuando el pedido trae un 100 ml suelto o ya llegó a precio
   * de combo (cualquier talla). El botón desaparece solo si ya se agregó.
   */
  const productoRegalo = useMemo(() => catalogo.find(p => p.regalo_automatico), [catalogo]);
  const calificaRegalo = form.lineas.some(l => l.ml === 100) || ahorroCombo > 0;
  const regaloYaAgregado = form.lineas.some(l => l.regalo);
  const agregarRegalo = () => {
    if (!productoRegalo) return;
    const primera = productoRegalo.precios[0];
    setForm(f => ({
      ...f,
      lineas: [...f.lineas, {
        key: `${productoRegalo.id}-regalo-${Date.now()}`,
        perfume_id: productoRegalo.id,
        nombre: productoRegalo.nombre,
        presentacion: primera?.presentacion ?? null,
        ml: primera?.ml ?? null,
        cantidad: 1,
        sin_descuento: false,
        regalo: true,
      }],
    }));
  };
```

Y el aviso en el JSX:

```tsx
        {productoRegalo && calificaRegalo && !regaloYaAgregado && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/25 bg-brand-soft/40 p-2.5 text-[12.5px] text-primary">
            <span>
              Este pedido califica para regalar <strong>{productoRegalo.nombre}</strong> — se
              agrega una sola vez, sin costo.
            </span>
            <Button type="button" size="sm" variant="outline" onClick={agregarRegalo}>
              + Agregar regalo
            </Button>
          </div>
        )}
```

- [ ] **Step 2: Reconstruir las líneas al abrir "Editar venta" con `regalo` real**

Cambiar, dentro del `useEffect` que reconstruye el formulario:

```ts
      return {
        key: `${p.id}-${p.ml ?? 'sin'}-${i}`,
        perfume_id: p.id,
        nombre: p.nombre,
        presentacion: talla?.presentacion ?? null,
        ml: p.ml ?? null,
        cantidad: p.cantidad ?? 1,
        sin_descuento: false,
      };
```

por:

```ts
      return {
        key: `${p.id}-${p.ml ?? 'sin'}-${i}`,
        perfume_id: p.id,
        nombre: p.nombre,
        presentacion: talla?.presentacion ?? null,
        ml: p.ml ?? null,
        cantidad: p.cantidad ?? 1,
        regalo: p.regalo ?? 0,
        sin_descuento: false,
      };
```

(esto exige que `Venta.perfumes[]` en `frontend/src/pages/dashboard/types.ts` tenga `regalo:
number` — revisar ese tipo; si no lo tiene, agregarlo ahí también en este mismo paso, junto a
`cantidad: number`).

- [ ] **Step 3: Mandar `regalo` al guardar**

Cambiar:

```ts
      lineas: form.lineas.map(l => ({ perfume_id: l.perfume_id, ml: l.ml, cantidad: l.cantidad })),
```

por:

```ts
      lineas: form.lineas.map(l => ({ perfume_id: l.perfume_id, ml: l.ml, cantidad: l.cantidad, regalo: l.regalo })),
```

- [ ] **Step 3b: Encender `permitirExtras` en el `<ArmadorPedido>` de Ventas**

En el JSX donde se usa `<ArmadorPedido ...>` dentro de `VentaForm.tsx`, agregar la prop:

```tsx
        <ArmadorPedido
          lineas={form.lineas}
          onChange={lineas => setForm(f => ({ ...f, lineas }))}
          catalogo={catalogo}
          porId={porId}
          permitirExtras
          onCrearProducto={() => setNuevoProd({ nombre: '', precio: '' })}
        />
```

(`CreditoForm.tsx` **no se toca** — su `<ArmadorPedido>` sigue sin la prop, así que sigue
comportándose exactamente igual que hoy.)

- [ ] **Step 4: `crearProducto` (alta rápida) y `agregar` de líneas nuevas ya traen `regalo: 0`**

En `crearProducto`, la línea que agrega el producto recién creado ya debe llevar `regalo: 0`
(agregarlo junto a `sin_descuento: false,` si no quedó ya cubierto al tocar `LineaPedido` en la
Task 5 — TypeScript lo va a marcar en rojo si falta, porque `regalo` dejó de ser opcional).

- [ ] **Step 5: Verificar que compila**

```bash
cd frontend && npx tsc --noEmit
```

Debe quedar limpio — con esto se cierran los errores que quedaron pendientes desde la Task 5.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/dashboard/tabs/VentaForm.tsx frontend/src/pages/dashboard/types.ts
git commit -m "feat(frontend): VentaForm manda y reconstruye el regalo por línea; quita el mecanismo viejo"
```

---

### Task 8: Verificación completa (no regresión + recorrido nuevo)

**Files:**
- Delete: `backend/e2e/regaloAutomatico.e2e.test.ts`
- Create: `backend/e2e/regaloDeLinea.e2e.test.ts`

**Interfaces:**
- Consumes: todo lo anterior, de punta a punta (backend + frontend reales, en el navegador).

- [ ] **Step 1: Borrar el recorrido de la funcionalidad retirada**

```bash
rm backend/e2e/regaloAutomatico.e2e.test.ts
```

- [ ] **Step 2: Escribir el recorrido nuevo**

Crear `backend/e2e/regaloDeLinea.e2e.test.ts`:

```ts
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { crearInsumo } from '../src/test/baseDePrueba';
import { abrirDashboard, cabeceraAdmin, campo, cerrarNavegador, irA } from './navegador';
import { URL_API } from './arranque';

/**
 * RECORRIDO — una línea puede tener parte gratis y parte cobrada a la vez.
 *
 * Reemplaza a `regaloAutomatico.e2e.test.ts` (2026-08-17, retirado): en vez de
 * un botón que agrega una línea especial fija en 1, ahora CUALQUIER línea
 * tiene un campo "Regalo". Nace del caso real de Edwin García (2026-08-17):
 * un perfumero recargable, uno gratis (del combo) y otro cobrado ($5.000), en
 * la MISMA línea del mismo producto.
 */

afterAll(cerrarNavegador);

describe('el campo Regalo de una línea', () => {
  it('cobra solo las unidades que no son regalo, y el buscador de accesorios los separa de las fragancias', async () => {
    const insumo = await crearInsumo('Perfumero de prueba', { tipo: 'accesorio', precio: 5000, stock: 20 });
    const alta = await fetch(`${URL_API}/api/parfums/create`, {
      method: 'POST',
      headers: await cabeceraAdmin(),
      body: JSON.stringify({
        nombre: 'Perfumero Recargable', precio: 5000, tipo_producto: 'comprado',
        insumo_producto_id: insumo.id, es_accesorio: true,
        tipos_aroma: [], ocasiones: [], presentaciones: [],
      }),
    });
    expect(alta.ok).toBe(true);
    const { data: { id: perfumeroId } } = await alta.json();

    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/ventas');
    await pagina.waitForSelector('text=Registrar venta');

    await pagina.getByRole('button', { name: /registrar venta/i }).click();
    await campo(pagina, 'Persona *').fill('Recorrido regalo de línea');

    // El buscador de accesorios es el SEGUNDO — el primero es el de fragancias.
    await pagina.getByPlaceholder(/buscar y agregar accesorio/i).click();
    await pagina.getByPlaceholder('Escribe para filtrar…').fill('Perfumero Recargable');
    await pagina.getByRole('option', { name: 'Perfumero Recargable', exact: true }).click();

    // Sube la cantidad a 2 (1 del combo + 1 vendido aparte) y marca 1 como regalo.
    await pagina.getByLabel('Cantidad').fill('2');
    await pagina.getByLabel('Regalo').fill('1');

    // Se cobra 1 sola unidad: $5.000, no $10.000.
    await pagina.waitForSelector('text=$ 5.000');

    await campo(pagina, 'Valor de la venta (COP) *').fill('5000');
    await pagina.getByRole('button', { name: /^Registrar$/ }).click();
    await pagina.waitForSelector('text=Recorrido regalo de línea', { timeout: 30_000 });
    await contexto.close();

    const venta = await prisma.venta.findFirstOrThrow({
      where: { persona: 'Recorrido regalo de línea' },
      include: { perfumes: true },
    });
    expect(venta.perfumes).toHaveLength(1);
    expect(venta.perfumes[0].perfume_id).toBe(perfumeroId);
    expect(venta.perfumes[0].cantidad).toBe(2);
    expect(venta.perfumes[0].regalo).toBe(1);

    // El inventario descontó las DOS unidades — la regalada también salió de la bodega.
    const insumoDespues = await prisma.insumoCosto.findUniqueOrThrow({ where: { id: insumo.id } });
    expect(Number(insumoDespues.stock)).toBe(18);
  });
});
```

- [ ] **Step 3: Correr el recorrido nuevo solo**

```bash
cd backend && npx vitest run --config vitest.e2e.config.mts regaloDeLinea
```

Expected: 1 passed. Si `getByLabel('Cantidad')`/`getByLabel('Regalo')` no encuentran el campo
porque hay más de una línea o el `aria-label` no matchea, revisar el Step 4 de la Task 6
(confirmar que el segundo `<Input>` lleva `aria-label="Regalo"` tal cual).

- [ ] **Step 4: Correr TODA la batería del backend**

```bash
cd backend && npm test
cd backend && npm run test:e2e
```

Expected: todo en verde. Prestar atención especial a `combo.e2e.test.ts` y `venta.e2e.test.ts`
(no deben haberse roto por los cambios en `lineasDeVenta`/`mapVenta`).

- [ ] **Step 5: Correr toda la batería del frontend**

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
```

- [ ] **Step 6: No regresión manual — Créditos NO debe mostrar lo nuevo**

Abrir `/dashboard/creditos` en el navegador (con el dashboard local corriendo) y registrar un
crédito de prueba con un producto. Confirmar DOS cosas, no una:

1. La pantalla se ve y se comporta exactamente igual que antes de este cambio — la casilla "sin
   descuento" sigue ahí y sigue funcionando.
2. **No aparece ni el campo "Regalo" ni un segundo buscador de accesorios.** Si aparecen, es
   que `permitirExtras` quedó encendido por error en `CreditoForm.tsx` (revisar que ese archivo
   no se haya tocado) — guardar ese crédito escribiría un regalo que el backend de Créditos
   descarta en silencio, que es exactamente el defecto que esta prop existe para evitar.

Borrar el crédito de prueba al terminar.

- [ ] **Step 7: Commit**

```bash
git add backend/e2e/regaloDeLinea.e2e.test.ts
git rm backend/e2e/regaloAutomatico.e2e.test.ts
git commit -m "test(e2e): recorrido del regalo por línea, reemplaza al de regalo_automatico"
```

---

## Qué queda fuera de este plan (a propósito)

- **El kit del combo (Ola 2)**: configurar en Combos qué accesorios trae por defecto y
  sugerirlos al detectar el combo. Es un plan aparte, posterior a validar esta Ola 1 con el
  dueño unos días.
- **Migrar `perfumes_test`/`perfumes_db` del servidor de producción**: este plan solo corre
  contra las bases locales. El despliegue a producción (con su propio respaldo y migración) se
  coordina aparte cuando el dueño lo pida.
- **Una cifra de "cuánto se regaló este mes" en los reportes**: el costo del regalo ya entra al
  costo de mercancía de la venta (automático, sin trabajo extra). Una cifra aparte queda para una
  vuelta futura, si hace falta — no es necesaria para que los números ya salgan correctos.
