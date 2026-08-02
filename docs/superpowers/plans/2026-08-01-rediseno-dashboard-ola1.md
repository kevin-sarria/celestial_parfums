# Rediseño del dashboard — Ola 1: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a `SmartTable` numeración correlativa, paginación en el navegador y vista de tarjeta táctil, y estrenarlas en las cuatro pestañas de Clasificaciones y en Usuarios, dejando además que sus errores de guardado se vean en pantalla.

**Architecture:** Todo el trabajo es frontend y **aditivo**. `SmartTable` la usan ~10 pestañas: cada capacidad nueva entra como prop opcional, de modo que una pestaña que no pase nada renderiza exactamente igual que hoy. La vista de tarjeta vive en su propio archivo (`FilaTarjeta.tsx`) y se alimenta de los mismos `ColumnDef` que la tabla, así que las dos vistas no se pueden desincronizar.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, Tailwind v4, shadcn (Radix), `sonner` para avisos, `lucide-react` para iconos. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-08-01-rediseno-dashboard-ola1-design.md`

## Global Constraints

- **No hay suite de pruebas en el frontend** (`package.json` solo tiene `dev`, `build`, `lint`, `preview`). El ciclo de verificación de cada tarea es `npm run build` (que corre `tsc -b`) + `npm run lint`, y al final una pasada visual con Playwright. Montar Vitest no está aprobado y queda fuera de alcance.
- **El backend no se toca.** Ni migraciones, ni dependencias, ni deploy especial.
- **Nada de `PUT`**: el CORS del backend solo permite `GET`, `POST`, `PATCH`, `DELETE`.
- **Encoding**: todos los `.ts`/`.tsx` son UTF-8 **sin BOM**. Jamás usar `Get-Content`/`Set-Content` de PowerShell sobre código fuente. En expresiones regulares, escribir los diacríticos como `̀-ͯ`, nunca pegando los caracteres combinantes literales.
- **Avisos**: `sonner` (`import { toast } from 'sonner'`). Los repetibles se deduplican con `toast.error(msg, { id: 'lookup' })`. `window.alert()` está deprecado en el dashboard; `window.confirm()` sigue válido para borrados.
- **Regla que motiva media ola**: una acción que falla SIEMPRE avisa, mostrando el mensaje que manda el backend (ya viene redactado en español).
- **Textos de la interfaz en español.** Los nombres de variables y funciones nuevas, también en español, siguiendo lo que ya hay (`processed`, `pantallaAngosta`, `guardando`).
- **`git add` siempre con rutas exactas.** El repositorio tiene 10 archivos modificados de una sesión anterior (backend, Prisma, `DetalleCompra.tsx`, `InventarioTab.tsx`, `PagosTab.tsx`, `FormulasVolumenTab.tsx`, entre otros) que **no son parte de este trabajo**. Nunca usar `git add -A` ni `git add .`.

---

### Task 0: Rama de trabajo

**Files:** ninguno.

- [ ] **Step 1: Crear la rama**

La rama por defecto es `main`. Los cambios sin commitear de la sesión anterior se conservan al cambiar de rama; no hay que guardarlos ni descartarlos.

```bash
git checkout -b rediseno-dashboard-ola1
```

- [ ] **Step 2: Confirmar el punto de partida**

```bash
git status --short
```

Esperado: los mismos 10 archivos modificados de antes, más los dos documentos de `docs/superpowers/` sin seguimiento. Ningún archivo de `frontend/src/components/table/` debe aparecer modificado.

---

### Task 1: Hook de media query reutilizable

`SmartTable` ya tiene un hook privado `usePantallaAngosta` clavado en 520px para el paginador compacto. La vista de tarjeta necesita otro punto de corte (640px), así que se generaliza en vez de duplicarlo.

**Files:**
- Create: `frontend/src/components/table/useMediaQuery.ts`
- Modify: `frontend/src/components/table/SmartTable.tsx:57-68` (borrar el hook local), `:81` (su uso)

**Interfaces:**
- Consumes: nada.
- Produces: `useMediaQuery(query: string): boolean`

- [ ] **Step 1: Crear el hook**

`frontend/src/components/table/useMediaQuery.ts`:

```ts
import { useEffect, useState } from 'react';

/**
 * true mientras la media query se cumpla.
 * Lo usan el paginador compacto (520px) y la vista de tarjeta (639px).
 */
export function useMediaQuery(query: string): boolean {
  const [coincide, setCoincide] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setCoincide(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return coincide;
}
```

- [ ] **Step 2: Borrar el hook local de SmartTable**

Eliminar por completo el bloque de `SmartTable.tsx:57-68`:

```ts
/** true en pantallas angostas (celular): el paginador usa la versión compacta. */
function usePantallaAngosta() { /* …todo el cuerpo… */ }
```

- [ ] **Step 3: Importar y usar el hook nuevo**

En los imports de `SmartTable.tsx`, junto a los otros imports relativos:

```ts
import { useMediaQuery } from './useMediaQuery';
```

Y reemplazar la línea 81:

```ts
const pantallaAngosta = usePantallaAngosta();
```

por:

```ts
const pantallaAngosta = useMediaQuery('(max-width: 520px)');
```

`useState` y `useEffect` siguen usándose en `SmartTable` (para `openFilter`, `serverTerm`, etc.), así que no hay que tocar el import de React.

- [ ] **Step 4: Verificar que compila**

```bash
cd frontend && npm run build
```

Esperado: termina con `built in Xs`, sin errores de TypeScript.

```bash
cd frontend && npm run lint
```

Esperado: sin errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/table/useMediaQuery.ts frontend/src/components/table/SmartTable.tsx
git commit -m "refactor(tabla): extraer useMediaQuery del hook local del paginador"
```

---

### Task 2: Columna `#` correlativa y paginación en el navegador

**Files:**
- Modify: `frontend/src/components/table/SmartTable.tsx`

**Interfaces:**
- Consumes: `useMediaQuery` (Task 1); `useTableControls(rows, columns)` que ya devuelve `{ processed, sort, toggleSort, filters, setFilter, clearAll, search, setSearch, activeFiltersCount }`.
- Produces: props `numerada?: boolean` y `paginadoLocal?: boolean` en `SmartTableProps<T>`; dentro del componente, las variables `visibles` (filas de la página actual) y `offsetNumero` (cuánto sumarle al índice para obtener el `#`), que la Task 3 reutiliza para las tarjetas.

- [ ] **Step 1: Declarar la constante y las props**

Junto a `PAGE_SIZE_OPTIONS` (línea 15):

```ts
/**
 * Por defecto de la paginación en el navegador. Es distinto del
 * DEFAULT_PAGE_SIZE = 10 de helpers.ts a propósito: ese aplica a las pestañas
 * que piden página por página al servidor, donde cada página cuesta una
 * petición. Aquí las filas ya están todas en memoria.
 */
const PAGE_SIZE_LOCAL = 25;
```

En `SmartTableProps<T>`, después de `onServerSearch`:

```ts
  /** Muestra una columna "#" con la posición en la lista (1, 2, 3…). */
  numerada?: boolean;
  /**
   * Pagina en el navegador cuando la pantalla carga todas las filas de una.
   * Se ignora si ya se pasó `pagination` (paginación de servidor).
   */
  paginadoLocal?: boolean;
```

Y recibirlas en la desestructuración del componente, después de `onServerSearch`:

```ts
  numerada,
  paginadoLocal,
```

- [ ] **Step 2: Calcular página, filas visibles y offset**

Insertar después de `const hasActiveControls = …` (línea 140), reemplazando la línea `const totalPages = …`:

```ts
  // ── Paginación ──
  // Dos modos excluyentes: la de servidor (prop `pagination`) manda sobre la local.
  const [pageLocal, setPageLocal] = useState(1);
  const [sizeLocal, setSizeLocal] = useState(PAGE_SIZE_LOCAL);
  const localActivo = !!paginadoLocal && !pagination;

  // Al cambiar búsqueda, filtros u orden la lista es otra: volver al principio.
  // Sin esto, filtrar de 200 a 3 registros deja al usuario mirando una página 7 vacía.
  useEffect(() => {
    if (localActivo) setPageLocal(1);
  }, [search, filters, sort, localActivo]);

  const totalPaginasLocal = Math.max(1, Math.ceil(processed.length / sizeLocal));
  // Red de seguridad: si borran filas y la página guardada ya no existe,
  // el clamp evita quedarse mirando una lista vacía.
  const paginaLocal = Math.min(pageLocal, totalPaginasLocal);

  const visibles = localActivo
    ? processed.slice((paginaLocal - 1) * sizeLocal, paginaLocal * sizeLocal)
    : processed;

  /** Cuánto sumarle al índice de la fila para que el "#" siga de corrido entre páginas. */
  const offsetNumero = pagination
    ? (pagination.page - 1) * pagination.pageSize
    : localActivo
      ? (paginaLocal - 1) * sizeLocal
      : 0;

  // ── Datos del paginador, sirva de servidor o de navegador ──
  const paginadorVisible = !!pagination || localActivo;
  const paginaActual = pagination ? pagination.page : paginaLocal;
  const tamanoActual = pagination ? pagination.pageSize : sizeLocal;
  const totalPages = pagination
    ? Math.ceil(pagination.totalRows / pagination.pageSize)
    : totalPaginasLocal;

  const irAPagina = (p: number) => {
    if (pagination) pagination.onPageChange(p);
    else setPageLocal(p);
  };
  const cambiarTamano = (s: number) => {
    if (pagination) pagination.onPageSizeChange(s);
    else { setSizeLocal(s); setPageLocal(1); }
  };
```

- [ ] **Step 3: Pintar la columna `#` en el encabezado**

Dentro de `<TableRow className="hover:bg-transparent">` (línea 196), **antes** del `{columns.map(...)}`:

```tsx
              {numerada && (
                <TableHead className="h-10 w-12 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  #
                </TableHead>
              )}
```

- [ ] **Step 4: Pintar la celda `#` y recorrer las filas visibles**

En el `<TableBody>`, la fila de "sin resultados" tiene que contar la columna nueva. Reemplazar su `colSpan`:

```tsx
                  colSpan={columns.length + (numerada ? 1 : 0) + (renderActions ? 1 : 0)}
```

Cambiar el recorrido de `processed.map((row, i) => (` a:

```tsx
              visibles.map((row, i) => (
```

y justo dentro del `<TableRow>`, antes del `{columns.map(...)}`:

```tsx
                  {numerada && (
                    <TableCell className="py-2.5 text-[12px] tabular-nums text-muted-foreground">
                      {offsetNumero + i + 1}
                    </TableCell>
                  )}
```

Cambiar también la condición de la fila vacía, de `processed.length === 0` a `visibles.length === 0`.

- [ ] **Step 5: Conectar el pie de página a los dos modos**

Reemplazar la condición de apertura del bloque del pie:

```tsx
      {pagination && totalPages >= 1 && (
```

por:

```tsx
      {paginadorVisible && (
```

Dentro de ese bloque, cambiar las cuatro referencias a `pagination.*`:

- `value={pagination.pageSize}` → `value={tamanoActual}`
- `onChange={e => pagination.onPageSizeChange(Number(e.target.value))}` → `onChange={e => cambiarTamano(Number(e.target.value))}`
- `disabled={pagination.page === 1}` → `disabled={paginaActual === 1}`
- `onClick={() => pagination.onPageChange(pagination.page - 1)}` → `onClick={() => irAPagina(paginaActual - 1)}`
- `getPages(pagination.page, totalPages, pantallaAngosta)` → `getPages(paginaActual, totalPages, pantallaAngosta)`
- `variant={p === pagination.page ? 'default' : 'outline'}` → `variant={p === paginaActual ? 'default' : 'outline'}`
- `onClick={() => pagination.onPageChange(p as number)}` → `onClick={() => irAPagina(p as number)}`
- `disabled={pagination.page === totalPages}` → `disabled={paginaActual === totalPages}`
- `onClick={() => pagination.onPageChange(pagination.page + 1)}` → `onClick={() => irAPagina(paginaActual + 1)}`

- [ ] **Step 6: Arreglar el contador de registros**

El contador de arriba a la derecha (línea 182-188) dice `${rows.length} registros` cuando no hay paginación de servidor. Con paginación local eso sigue siendo correcto (son todas las filas cargadas), pero hay que contemplar el caso filtrado. Reemplazar el bloque por:

```tsx
          <span className="text-xs text-muted-foreground">
            {processed.length !== rows.length
              ? `${processed.length} de ${rows.length}`
              : pagination
                ? `${pagination.totalRows} registros`
                : `${rows.length} registros`}
          </span>
```

(es el mismo texto de hoy; se deja explícito para confirmar que **no** debe cambiar a `visibles.length`, que mostraría "25 registros" siempre).

- [ ] **Step 7: Verificar que compila y que no rompió nada**

```bash
cd frontend && npm run build && npm run lint
```

Esperado: sin errores. Con el servidor de desarrollo en `localhost:5173`, abrir `/dashboard/ventas` (que usa paginación de servidor y **no** pasa las props nuevas) y comprobar que se ve y pagina igual que antes.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/table/SmartTable.tsx
git commit -m "feat(tabla): columna # correlativa y paginacion en el navegador"
```

---

### Task 3: Vista de tarjeta para celular

**Files:**
- Modify: `frontend/src/components/table/tableTypes.ts`
- Create: `frontend/src/components/table/FilaTarjeta.tsx`
- Modify: `frontend/src/components/table/SmartTable.tsx`

**Interfaces:**
- Consumes: `useMediaQuery` (Task 1); `visibles`, `offsetNumero`, `numerada` (Task 2).
- Produces: `RolMovil` y el campo `movil?: RolMovil` en `ColumnDef<T>`; el componente `FilaTarjeta`; las props `tarjetaMovil?: boolean` y `accionesMovil?: (row: T) => ReactNode` en `SmartTableProps<T>`. Las tareas 5 y 6 usan `movil`, `tarjetaMovil` y `accionesMovil`.

- [ ] **Step 1: Agregar el papel móvil al tipo de columna**

En `frontend/src/components/table/tableTypes.ts`, después de `export type SortDir`:

```ts
/** Qué papel juega la columna cuando la fila se pinta como tarjeta en celular. */
export type RolMovil = 'titulo' | 'meta' | 'estado' | 'destacado' | 'detalle';
```

Y dentro de `ColumnDef<T>`, después de `noTruncate?: boolean;`:

```ts
  /** Papel en la tarjeta de celular. Sin marcar = 'detalle' (solo al expandir). */
  movil?: RolMovil;
```

- [ ] **Step 2: Crear el componente de tarjeta**

`frontend/src/components/table/FilaTarjeta.tsx`:

```tsx
import { type ReactNode, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ColumnDef, RolMovil } from './tableTypes';

/** Valor pintado de una celda, con el mismo criterio que usa la tabla. */
function celda<T>(col: ColumnDef<T>, row: T): ReactNode {
  if (col.render) return col.render(row);
  return String(col.getValue(row) ?? '') || '—';
}

/**
 * Reparte las columnas según el papel que juegan en la tarjeta.
 * Si ninguna se declara `titulo`, manda la primera columna: así una tabla que
 * enciende la vista móvil sin marcar nada sigue siendo legible.
 */
export function repartirColumnas<T>(columns: ColumnDef<T>[]) {
  const rol = (c: ColumnDef<T>): RolMovil => c.movil ?? 'detalle';
  const declarado = columns.find(c => rol(c) === 'titulo');
  const titulo = declarado ?? columns[0];
  return {
    titulo,
    meta: columns.filter(c => rol(c) === 'meta'),
    estado: columns.filter(c => rol(c) === 'estado'),
    destacado: columns.filter(c => rol(c) === 'destacado'),
    // Si el título salió por defecto, no repetirlo abajo en el detalle
    detalle: columns.filter(c => rol(c) === 'detalle' && c !== titulo),
  };
}

interface FilaTarjetaProps<T> {
  row: T;
  /** Posición en la lista, o null si la tabla no está numerada. */
  numero: number | null;
  columns: ColumnDef<T>[];
  acciones?: ReactNode;
}

/**
 * Una fila de la tabla pintada como tarjeta táctil.
 * Resumida por defecto (caben 5-6 en pantalla) y se expande al tocarla.
 */
export function FilaTarjeta<T>({ row, numero, columns, acciones }: FilaTarjetaProps<T>) {
  const [abierta, setAbierta] = useState(false);
  const { titulo, meta, estado, destacado, detalle } = repartirColumnas(columns);
  const hayMas = detalle.length > 0 || !!acciones;

  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        className="flex w-full flex-col gap-1 p-3.5 text-left"
        onClick={() => hayMas && setAbierta(v => !v)}
        aria-expanded={hayMas ? abierta : undefined}
      >
        {(numero !== null || meta.length > 0 || estado.length > 0) && (
          <span className="flex w-full items-start justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {numero !== null && `#${numero}`}
              {meta.map(c => (
                <span key={c.key} className="ml-1.5 font-normal normal-case tracking-normal">
                  · {celda(c, row)}
                </span>
              ))}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {estado.map(c => <span key={c.key}>{celda(c, row)}</span>)}
            </span>
          </span>
        )}

        <span className="text-[15px] font-medium text-foreground">{celda(titulo, row)}</span>

        {(destacado.length > 0 || hayMas) && (
          <span className="flex w-full items-end justify-between gap-3">
            <span className="font-display text-lg font-medium text-foreground">
              {destacado.map(c => <span key={c.key}>{celda(c, row)}</span>)}
            </span>
            {hayMas && (
              <ChevronDown
                className={cn(
                  'size-5 shrink-0 text-muted-foreground transition-transform',
                  abierta && 'rotate-180',
                )}
              />
            )}
          </span>
        )}
      </button>

      {abierta && hayMas && (
        <div className="border-t border-border px-3.5 py-3">
          {detalle.length > 0 && (
            <dl className="space-y-1.5">
              {detalle.map(c => (
                <div key={c.key} className="flex gap-3 text-[13px]">
                  <dt className="w-28 shrink-0 text-muted-foreground">{c.header}</dt>
                  <dd className="min-w-0 flex-1 text-foreground">{celda(c, row)}</dd>
                </div>
              ))}
            </dl>
          )}
          {acciones && (
            <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-border pt-3 [&_button]:min-h-11">
              {acciones}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
```

Nota sobre el `<button>` como cabecera: las funciones `render` de algunas columnas devuelven `<div>`, que anidado en un botón no es HTML estrictamente válido. Es el mismo patrón que usa el Accordion de Radix (su trigger es un `<button>` con contenido libre) y los navegadores lo manejan sin problema. Se prefiere eso a perder el toque en toda el área de la tarjeta, que es lo que hace usable la vista de celular.

- [ ] **Step 3: Declarar las props nuevas en SmartTable**

En `SmartTableProps<T>`, después de `paginadoLocal`:

```ts
  /** Debajo de 640px cambia la tabla por tarjetas, en vez de scroll horizontal. */
  tarjetaMovil?: boolean;
  /**
   * Acciones de la tarjeta. Si falta, usa `renderActions`.
   * Existe porque `renderActions` devuelve botones de solo icono, pensados para
   * una fila estrecha; en la tarjeta hay ancho de sobra y el icono solo es
   * ambiguo con el pulgar.
   */
  accionesMovil?: (row: T) => ReactNode;
```

Recibirlas en la desestructuración y agregar los imports:

```ts
import { useMediaQuery } from './useMediaQuery';
import { FilaTarjeta } from './FilaTarjeta';
```

Junto a `pantallaAngosta`:

```ts
  // 639px = justo debajo del breakpoint `sm` de Tailwind
  const esMovil = useMediaQuery('(max-width: 639px)');
  const vistaTarjeta = esMovil && !!tarjetaMovil;
```

- [ ] **Step 4: Elegir entre tabla y tarjetas**

Envolver el bloque actual de la tabla (`<div className="overflow-x-auto rounded-xl border border-border"> … </div>`, líneas 193-308) en un ternario:

```tsx
      {vistaTarjeta ? (
        visibles.length === 0 ? (
          <p className="rounded-xl border border-border py-10 text-center text-muted-foreground">
            {emptyText}
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {visibles.map((row, i) => (
              <FilaTarjeta
                key={rowKey ? rowKey(row) : i}
                row={row}
                numero={numerada ? offsetNumero + i + 1 : null}
                columns={columns}
                acciones={(accionesMovil ?? renderActions)?.(row)}
              />
            ))}
          </ul>
        )
      ) : (
        /* …el <div className="overflow-x-auto …"> de hoy, sin cambios… */
      )}
```

Se renderiza **una sola** de las dos vistas, nunca las dos con `hidden`: duplicar el DOM duplicaría también los popovers de filtro y los `id` del pie de página.

- [ ] **Step 5: Verificar**

```bash
cd frontend && npm run build && npm run lint
```

Esperado: sin errores. En el navegador, `/dashboard/ventas` a 390px de ancho debe verse **igual que hoy** (tabla con scroll horizontal), porque no pasa `tarjetaMovil`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/table/tableTypes.ts frontend/src/components/table/FilaTarjeta.tsx frontend/src/components/table/SmartTable.tsx
git commit -m "feat(tabla): vista de tarjeta opcional para celular"
```

---

### Task 4: Primitiva para agrupar campos de formulario

**Files:**
- Modify: `frontend/src/pages/dashboard/ui.tsx`

**Interfaces:**
- Produces: `BloqueCampos({ titulo, descripcion?, children })`. La usa la Task 6 y, más adelante, el rediseño de Ventas.

- [ ] **Step 1: Agregar el componente**

En `frontend/src/pages/dashboard/ui.tsx`, después de `FieldRow` (línea 82):

```tsx
/**
 * Grupo de campos con título. Parte un formulario largo en secciones para que
 * se vea qué pertenece a qué, en vez de una tira de campos todos iguales.
 */
export function BloqueCampos({ titulo, descripcion, children }: {
  titulo: string;
  descripcion?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {titulo}
        </p>
        {descripcion && <p className="mt-0.5 text-[12px] text-muted-foreground">{descripcion}</p>}
      </div>
      {children}
    </div>
  );
}
```

Se usa `<div>` y no `<fieldset>` a propósito: `Modal` ya envuelve el contenido en un `<form>`, y un `fieldset` con `legend` oculto no aporta nada aquí, mientras que su estilo por defecto pelea con las clases de Tailwind.

- [ ] **Step 2: Verificar**

```bash
cd frontend && npm run build && npm run lint
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/dashboard/ui.tsx
git commit -m "feat(dashboard): BloqueCampos para agrupar campos de formulario"
```

---

### Task 5: Clasificaciones — modal, paginación, `#` y avisos de error

Cubre las cuatro pestañas (aromas, ocasiones, categorías, presentaciones) porque las cuatro salen del mismo componente. El cambio de firma de los handlers acopla `LookupTab` con `DashboardPage`, así que van en la misma tarea: por separado, ninguna de las dos compila.

**Files:**
- Modify: `frontend/src/pages/dashboard/tabs/LookupTab.tsx` (reescritura)
- Modify: `frontend/src/pages/dashboard/DashboardPage.tsx:209-223` (los tres handlers) y `:361-380` (los cuatro usos)

**Interfaces:**
- Consumes: `SmartTable` con `numerada`, `paginadoLocal`, `tarjetaMovil`, `accionesMovil` (tareas 2 y 3); `movil: 'titulo'` en `ColumnDef` (Task 3); `Modal` de `components/Modal.tsx`; `Lookup` de `../types` (`{ id: number; nombre: string; descuento?: number }`).
- Produces: `export type ResultadoLookup = { ok: boolean; error?: string }` desde `LookupTab.tsx`, que es lo que devuelven los handlers de `DashboardPage`.

- [ ] **Step 1: Reescribir LookupTab**

Contenido completo de `frontend/src/pages/dashboard/tabs/LookupTab.tsx`:

```tsx
import { useRef, useState } from 'react';
import { Pencil, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Modal from '../../../components/Modal';
import ImportModal from '../../../components/ImportModal';
import ExportButton from '../../../components/ExportButton';
import { SmartTable } from '../../../components/table/SmartTable';
import type { ColumnDef } from '../../../components/table/tableTypes';
import { Section, SectionTitle, Toolbar, ToolbarActions, Field } from '../ui';
import type { GuardedFetch, Lookup } from '../types';

/** Lo que devuelven las mutaciones para poder avisar si fallaron. */
export type ResultadoLookup = { ok: boolean; error?: string };

interface LookupTabProps {
  title: string;
  /** Texto del botón y del modal de alta. Ej: "Nueva categoría". */
  nuevo: string;
  /** Título del modal de edición. Ej: "Editar categoría". */
  editar: string;
  /** Ayuda bajo el campo. Ej: "Ej: Árabes, Diseñador, Nicho". */
  ejemplo?: string;
  items: Lookup[];
  onAdd: (name: string) => Promise<ResultadoLookup>;
  onDelete: (id: number) => Promise<ResultadoLookup>;
  /** Renombra un elemento existente sin perder sus relaciones. */
  onEdit?: (id: number, name: string) => Promise<ResultadoLookup>;
  /** Entidad del backend para importar/exportar (aromas, ocasiones, categorias, presentaciones). */
  importEntity?: string;
  guardedFetch?: GuardedFetch;
  onImported?: () => void;
}

/** Compara ignorando mayúsculas, tildes y espacios de sobra. */
const normaliza = (s: string) =>
  s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function LookupTab({
  title, nuevo, editar, ejemplo, items,
  onAdd, onDelete, onEdit, importEntity, guardedFetch, onImported,
}: LookupTabProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; editId: number | null }>({ open: false, editId: null });
  const [valor, setValor] = useState('');
  const [guardando, setGuardando] = useState(false);
  const campoRef = useRef<HTMLInputElement>(null);

  const abrirCrear = () => { setValor(''); setModal({ open: true, editId: null }); };
  const abrirEditar = (item: Lookup) => { setValor(item.nombre); setModal({ open: true, editId: item.id }); };
  const cerrar = () => setModal({ open: false, editId: null });

  /**
   * @param seguir true = "Guardar y agregar otro": deja el modal abierto,
   *               limpia el campo y devuelve el cursor para seguir tecleando.
   */
  const guardar = async (seguir: boolean) => {
    const nombre = valor.trim();
    if (!nombre) { toast.error('Escribe un nombre', { id: 'lookup' }); return; }

    // Se avisa antes de gastar una petición; el servidor igual lo valida.
    const repetido = items.some(i => normaliza(i.nombre) === normaliza(nombre) && i.id !== modal.editId);
    if (repetido) { toast.error(`"${nombre}" ya está en la lista`, { id: 'lookup' }); return; }

    setGuardando(true);
    try {
      const r = modal.editId != null && onEdit
        ? await onEdit(modal.editId, nombre)
        : await onAdd(nombre);
      if (!r.ok) { toast.error(r.error ?? 'No se pudo guardar', { id: 'lookup' }); return; }
      toast.success(modal.editId != null ? 'Cambio guardado' : `"${nombre}" agregado`);
      if (seguir) { setValor(''); campoRef.current?.focus(); }
      else cerrar();
    } finally { setGuardando(false); }
  };

  const borrar = async (item: Lookup) => {
    const r = await onDelete(item.id);
    if (!r.ok) toast.error(r.error ?? 'No se pudo eliminar', { id: 'lookup' });
  };

  const columnas: ColumnDef<Lookup>[] = [
    {
      key: 'nombre', header: 'Nombre', type: 'string',
      getValue: i => i.nombre,
      className: 'font-medium text-foreground',
      movil: 'titulo',
    },
  ];

  const acciones = (item: Lookup, conTexto: boolean) => (
    <>
      {onEdit && (
        <Button
          variant={conTexto ? 'outline' : 'ghost'}
          size={conTexto ? 'sm' : 'icon'}
          className={conTexto ? undefined : 'size-8 text-muted-foreground hover:text-foreground'}
          onClick={() => abrirEditar(item)}
          title="Editar"
        >
          <Pencil className="size-4" />{conTexto && ' Editar'}
        </Button>
      )}
      <Button
        variant={conTexto ? 'outline' : 'ghost'}
        size={conTexto ? 'sm' : 'icon'}
        className={conTexto ? 'text-destructive' : 'size-8 text-muted-foreground hover:text-destructive'}
        onClick={() => borrar(item)}
        title="Eliminar"
      >
        <Trash2 className="size-4" />{conTexto && ' Borrar'}
      </Button>
    </>
  );

  return (
    <>
      <Section className="mx-auto w-full max-w-3xl">
        <Toolbar>
          <SectionTitle count={items.length}>{title}</SectionTitle>
          <ToolbarActions>
            {importEntity && guardedFetch && (
              <>
                <ExportButton entity={importEntity} guardedFetch={guardedFetch} />
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <Upload className="size-4" /> Importar
                </Button>
              </>
            )}
            <Button size="sm" onClick={abrirCrear}>+ {nuevo}</Button>
          </ToolbarActions>
        </Toolbar>

        <SmartTable
          columns={columnas}
          rows={items}
          rowKey={i => i.id}
          numerada
          paginadoLocal
          tarjetaMovil
          emptyText="Todavía no hay nada en esta lista"
          renderActions={i => acciones(i, false)}
          accionesMovil={i => acciones(i, true)}
        />
      </Section>

      <Modal
        open={modal.open}
        onClose={cerrar}
        title={modal.editId != null ? editar : nuevo}
        onSubmit={e => { e.preventDefault(); guardar(false); }}
        loading={guardando}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={cerrar}>Cancelar</Button>
            {modal.editId == null && (
              <Button type="button" variant="outline" disabled={guardando} onClick={() => guardar(true)}>
                Guardar y agregar otro
              </Button>
            )}
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        }
      >
        <Field label="Nombre *">
          <Input
            ref={campoRef}
            autoFocus
            required
            maxLength={100}
            value={valor}
            onChange={e => setValor(e.target.value)}
          />
          {ejemplo && <p className="mt-1 text-[12px] text-muted-foreground">{ejemplo}</p>}
        </Field>
      </Modal>

      {importEntity && guardedFetch && (
        <ImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          entity={importEntity}
          guardedFetch={guardedFetch}
          onImported={onImported ?? (() => {})}
        />
      )}
    </>
  );
}
```

Nota sobre el texto del duplicado: el diseño decía *"Ya existe una categoría llamada X"*, pero eso obliga a saber el género gramatical de cada lista ("un aroma" / "una categoría"). Se usa `"X" ya está en la lista`, que dice lo mismo y no se puede escribir mal.

- [ ] **Step 2: Comprobar que `Input` acepta ref**

`campoRef` solo funciona si `components/ui/input.tsx` reenvía la ref. En React 19 los componentes de función reciben `ref` como prop normal, y los componentes de shadcn actuales la propagan al `<input>`.

Run: `cat frontend/src/components/ui/input.tsx`
Esperado: el componente hace spread de sus props sobre el `<input>` (`{...props}`). Si el `ref` no llegara, sustituir `campoRef.current?.focus()` por una consulta directa dentro del modal — pero verificarlo primero, no asumirlo.

- [ ] **Step 3: Hacer que los handlers de DashboardPage informen si fallaron**

En `frontend/src/pages/dashboard/DashboardPage.tsx`, reemplazar los tres handlers de las líneas 209-223. **Conservar exactamente la construcción de URL que ya está en el archivo** (los `${API}` y los `${endpoint}` tal cual aparecen ahí); lo único que cambia es que ahora se mira `res.ok`:

```ts
  const handleLookupAdd = (endpoint: string) => async (name: string): Promise<ResultadoLookup> => {
    const res = await guardedFetch(`${API}${endpoint}`, {
      method: 'POST', body: JSON.stringify({ nombre: name }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: json?.error ?? 'No se pudo guardar' };
    refreshAll();
    return { ok: true };
  };

  const handleLookupDelete = (endpoint: string) => async (id: number): Promise<ResultadoLookup> => {
    // Cancelar no es un error: se responde ok para que no salte ningún aviso.
    if (!window.confirm('¿Eliminar este elemento?')) return { ok: true };
    const res = await guardedFetch(`${API}${endpoint}${id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: json?.error ?? 'No se pudo eliminar' };
    refreshAll();
    return { ok: true };
  };

  const handleLookupEdit = (endpoint: string) => async (id: number, name: string): Promise<ResultadoLookup> => {
    const res = await guardedFetch(`${API}${endpoint}${id}`, {
      method: 'PATCH', body: JSON.stringify({ nombre: name }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: json?.error ?? 'No se pudo guardar' };
    refreshAll();
    return { ok: true };
  };
```

Y agregar el tipo al import de `LookupTab` (línea 29):

```ts
import { LookupTab, type ResultadoLookup } from './tabs/LookupTab';
```

- [ ] **Step 4: Actualizar los cuatro usos**

En `DashboardPage.tsx:361-380`, cambiar `placeholder` por los textos nuevos. Los cuatro bloques quedan así:

```tsx
            {tab === 'aromas' && (
              <LookupTab title="Tipos de Aroma" nuevo="Nuevo aroma" editar="Editar aroma"
                ejemplo="Ej: Amaderado, Cítrico, Oriental" items={aromas}
                onAdd={handleLookupAdd('tipos-aroma')} onDelete={handleLookupDelete('tipos-aroma')} onEdit={handleLookupEdit('tipos-aroma')}
                importEntity="aromas" guardedFetch={guardedFetch} onImported={refreshAll} />
            )}
            {tab === 'ocasiones' && (
              <LookupTab title="Ocasiones" nuevo="Nueva ocasión" editar="Editar ocasión"
                ejemplo="Ej: Diario, Noche, Oficina" items={ocasiones}
                onAdd={handleLookupAdd('ocasiones')} onDelete={handleLookupDelete('ocasiones')} onEdit={handleLookupEdit('ocasiones')}
                importEntity="ocasiones" guardedFetch={guardedFetch} onImported={refreshAll} />
            )}
            {tab === 'categorias' && (
              <LookupTab title="Categorias" nuevo="Nueva categoría" editar="Editar categoría"
                ejemplo="Ej: Árabes, Diseñador, Nicho" items={categorias}
                onAdd={handleLookupAdd('categorias')} onDelete={handleLookupDelete('categorias')} onEdit={handleLookupEdit('categorias')}
                importEntity="categorias" guardedFetch={guardedFetch} onImported={refreshAll} />
            )}
            {tab === 'presentaciones' && (
              <LookupTab title="Presentaciones" nuevo="Nueva presentación" editar="Editar presentación"
                ejemplo="Ej: 30ML, 50 ml, 100 ml" items={presentaciones}
                onAdd={handleLookupAdd('presentaciones')} onDelete={handleLookupDelete('presentaciones')} onEdit={handleLookupEdit('presentaciones')}
                importEntity="presentaciones" guardedFetch={guardedFetch} onImported={refreshAll} />
            )}
```

- [ ] **Step 5: Verificar**

```bash
cd frontend && npm run build && npm run lint
```

Esperado: sin errores. TypeScript debe protestar si quedó algún `placeholder` sin quitar o algún handler devolviendo `void`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/dashboard/tabs/LookupTab.tsx frontend/src/pages/dashboard/DashboardPage.tsx
git commit -m "feat(clasificaciones): modal de alta, paginacion, # correlativo y avisos de error"
```

---

### Task 6: Usuarios — paginación, `#`, tarjeta y formulario en bloques

**Files:**
- Modify: `frontend/src/pages/dashboard/tabs/UsuariosTab.tsx`

**Interfaces:**
- Consumes: `numerada`, `paginadoLocal`, `tarjetaMovil`, `accionesMovil` de `SmartTable` (tareas 2 y 3); `movil` en `ColumnDef` (Task 3); `BloqueCampos` de `../ui` (Task 4).
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Marcar el papel móvil de cada columna**

En el arreglo `columns` (líneas 107-168), agregar `movil` a cuatro columnas. El resto queda sin marcar, o sea en `detalle`:

- `usuario`: agregar `movil: 'titulo',`
- `tipo`: agregar `movil: 'estado',`
- `activo`: agregar `movil: 'estado',`
- `created_at`: agregar `movil: 'meta',`

- [ ] **Step 2: Encender las capacidades nuevas de la tabla**

Reemplazar el bloque `<SmartTable …>` (líneas 182-203) por:

```tsx
        <SmartTable
          columns={columns}
          rows={usuarios}
          rowKey={u => u.id}
          numerada
          paginadoLocal
          tarjetaMovil
          emptyText="Aún no hay personas registradas"
          renderActions={u => accionesFila(u, false)}
          accionesMovil={u => accionesFila(u, true)}
        />
```

Y definir el helper justo antes del `return` del componente:

```tsx
  const accionesFila = (u: Usuario, conTexto: boolean) => (
    <>
      <Button
        variant={conTexto ? 'outline' : 'ghost'}
        size={conTexto ? 'sm' : 'icon'}
        className={conTexto ? undefined : 'size-8 text-muted-foreground hover:text-foreground'}
        onClick={() => openEdit(u)}
        title="Editar"
      >
        <Pencil className="size-4" />{conTexto && ' Editar'}
      </Button>
      <Button
        variant={conTexto ? 'outline' : 'ghost'}
        size={conTexto ? 'sm' : 'icon'}
        className={conTexto
          ? 'text-destructive disabled:opacity-30'
          : 'size-8 text-muted-foreground hover:text-destructive disabled:opacity-30'}
        disabled={u.id === adminUser?.id}
        onClick={() => handleDelete(u)}
        title={u.id === adminUser?.id ? 'No puedes eliminar tu propia cuenta' : 'Eliminar'}
      >
        <Trash2 className="size-4" />{conTexto && ' Borrar'}
      </Button>
    </>
  );
```

- [ ] **Step 3: Cambiar el `alert()` por un aviso**

Agregar el import:

```ts
import { toast } from 'sonner';
```

Y en `handleDelete` (línea 103), reemplazar:

```ts
    if (!res.ok) { const j = await res.json(); alert(j.error ?? 'Error al eliminar'); return; }
```

por:

```ts
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      toast.error(j?.error ?? 'No se pudo eliminar', { id: 'usuarios' });
      return;
    }
```

- [ ] **Step 4: Partir el formulario en bloques**

Importar `BloqueCampos`:

```ts
import { Section, SectionTitle, Toolbar, ToolbarActions, Field, FieldRow, FormError, BloqueCampos } from '../ui';
```

Envolver los campos del modal. Los cinco de contacto (nombre, apellido, correo, teléfono, dirección — líneas 214-239) van dentro de:

```tsx
        <BloqueCampos titulo="Datos de contacto">
          {/* …los FieldRow y el Field de Direccion, sin cambios… */}
        </BloqueCampos>
```

Y el bloque condicional de estado y contraseña (líneas 242-263) pasa de un fragmento `<>…</>` a:

```tsx
        {modal.editId != null && !editando?.sin_cuenta && (
          <BloqueCampos titulo="Cuenta web" descripcion="Solo aplica a quien se registró en la página.">
            {/* …el Field de Estado y el de Nueva contraseña, sin cambios… */}
          </BloqueCampos>
        )}
```

El párrafo explicativo de la ficha (líneas 265-271) y el `<FormError>` se quedan fuera de los bloques, al final.

- [ ] **Step 5: Verificar**

```bash
cd frontend && npm run build && npm run lint
```

Esperado: sin errores.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/dashboard/tabs/UsuariosTab.tsx
git commit -m "feat(usuarios): paginacion, # correlativo, tarjeta movil y formulario en bloques"
```

---

### Task 7: Verificación visual y de no regresión

Es la tarea que decide si la ola quedó lista. Ninguna de las comprobaciones se puede reportar como cumplida sin haberla ejecutado y visto el resultado.

**Files:** ninguno (salvo que aparezcan defectos, que se arreglan aquí).

**Interfaces:**
- Consumes: todo lo anterior.

- [ ] **Step 1: Levantar el entorno**

El servidor de desarrollo (`localhost:5173`) y el backend (`localhost:4000`) deben estar arriba. Si el 3306 no responde, arrancar MySQL de XAMPP.

```bash
cd frontend && npm run build
```

Esperado: `built in Xs`, cero errores.

- [ ] **Step 2: Comprobaciones funcionales, una por una**

Entrar al dashboard como admin y ejecutar cada caso, anotando el resultado real:

1. **Duplicado**: en Categorías, `+ Nueva categoría` → escribir una que ya exista (con otras mayúsculas o sin tilde) → Guardar.
   Esperado: aviso `"X" ya está en la lista`. En la pestaña Red del navegador **no** debe aparecer ninguna petición.
2. **Error del servidor**: borrar una categoría que un perfume esté usando.
   Esperado: aviso rojo con el mensaje del backend. (Hoy no aparece nada: ese es el fallo que se está arreglando.)
3. **Guardar y agregar otro**: pulsarlo tres veces seguidas con nombres distintos.
   Esperado: tres elementos creados, el modal nunca se cierra, el campo queda vacío y con el cursor dentro.
4. **Numeración entre páginas**: en Tipos de Aroma con más de 25 registros, ir a la página 2.
   Esperado: la primera fila es el **#26**.
5. **Reordenar**: ordenar por Nombre.
   Esperado: el `#` se renumera con el orden visible. Editar el elemento que quedó de #1 debe abrir **ese**, comprobado por su nombre.
6. **Volver a la página 1 al filtrar**: estando en la página 3, escribir en el buscador algo que deje 2 resultados.
   Esperado: se ven los 2 resultados, no una página vacía.
7. **Celular**: a 390px de ancho, en Categorías y en Usuarios.
   Esperado: tarjetas en vez de tabla; se expanden al tocarlas; los botones Editar/Borrar se pulsan cómodo; **no hay scroll horizontal en la página**.

- [ ] **Step 3: No regresión de las pestañas que no se tocaron**

Abrir `/dashboard/ventas`, `/dashboard/creditos` y `/dashboard/perfumes`, en 1440px y en 390px.

Esperado: se ven y funcionan **igual que antes** — tabla con scroll horizontal en celular, sin columna `#`, con su paginación de servidor intacta. Son las que no pasan ninguna prop nueva.

- [ ] **Step 4: Capturas**

Con Playwright + msedge headless, capturar en 1440px y 390px: Categorías, Tipos de Aroma y Usuarios. Cerrar el popup de anuncios ("Entendido") si aparece.

- [ ] **Step 5: Actualizar CLAUDE.md**

Agregar a `CLAUDE.md` lo que quedó decidido y no se deduce del código:

- `SmartTable` ahora tiene `numerada`, `paginadoLocal`, `tarjetaMovil` y `accionesMovil`, **todas opcionales**: una pestaña que no las pasa se ve igual que siempre. La tarjeta es opt-in a propósito para no cambiarle el aspecto a Ventas y Créditos antes de su rediseño.
- El `#` es la **posición visible**, no el id: cambia al reordenar. El id sigue siendo la llave de `rowKey` y de las rutas `PATCH`/`DELETE`.
- El papel de cada columna en la tarjeta se declara con `movil: 'titulo' | 'meta' | 'estado' | 'destacado' | 'detalle'`; sin marcar, es `detalle`.
- Paginación local por defecto **25** (contra 10 de la de servidor) porque las filas ya están en memoria.
- En el punto de "Estado al cerrar", marcar el pendiente Nº1 (rediseño de Ventas) como **Ola 2** y apuntar a los dos documentos de `docs/superpowers/`.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: registrar las capacidades nuevas de SmartTable"
```

---

## Cobertura del diseño

| Sección del diseño | Tarea |
|---|---|
| §4.1 `useMediaQuery` | Task 1 |
| §4.1 `numerada`, `paginadoLocal`, reinicio de página, 25 por defecto | Task 2 |
| §4.1 `movil`, `tarjetaMovil`, `accionesMovil`, 44px táctiles | Task 3 |
| §4.2 `BloqueCampos` | Task 4 |
| §4.3 LookupTab (modal, "guardar y agregar otro", duplicados, avisos) | Task 5 |
| §4.5 handlers de `DashboardPage` | Task 5 |
| §4.4 UsuariosTab | Task 6 |
| §6 verificación (los 7 casos + no regresión + capturas) | Task 7 |
| §7 riesgo "props opcionales" | Task 2 step 7, Task 3 step 5, Task 7 step 3 |
| §7 riesgo "cortar sobre `processed`" | Task 2 step 2 |
