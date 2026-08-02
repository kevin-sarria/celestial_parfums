# Rediseño del dashboard — Ola 1: cimientos + Clasificaciones y Usuarios

**Fecha**: 2026-08-01
**Decidido con**: Kevin (dueño)
**Estado**: diseño aprobado, pendiente de plan de implementación

---

## 1. Por qué

Kevin señaló nueve pantallas del dashboard como mal diseñadas: Ventas, Créditos,
Inventario, Proveedores, Insumos y precios, Costos de producción, Tamaños y fórmulas,
Usuarios y las cuatro de Clasificaciones (aromas, ocasiones, categorías, presentaciones).

Al revisarlas juntas, casi todas sufren de **los mismos cuatro defectos**, no de problemas
distintos:

| Defecto | Dónde | Evidencia |
|---|---|---|
| La columna `#` muestra el id de la base (salta 1, 5, 12, 47) | Clasificaciones | `LookupTab.tsx:84` |
| Sin paginación: carga todo y estira la página | Usuarios, Clasificaciones, Insumos, Fórmulas, Inventario | `UsuariosTab.tsx:37-41` |
| El formulario es un modal larguísimo sin jerarquía | Ventas, Créditos, Inventario | `VentasTab.tsx:367-602` (9 bloques seguidos) |
| El formulario no parece formulario: un input suelto | Clasificaciones | `LookupTab.tsx:62-70` |

Además, en Clasificaciones los tres handlers de mutación **se tragan el error**
(`DashboardPage.tsx:209-223`): hacen `await guardedFetch(...)` sin mirar `res.ok`. Si el
backend rechaza (nombre duplicado, categoría en uso), no aparece nada en pantalla y el
elemento simplemente no se agrega. Eso viola la regla del proyecto: *una acción que falla
SIEMPRE avisa*.

Por eso el trabajo se ordena en tres olas, y esta primera construye **las piezas
compartidas** y las estrena en las dos pantallas más simples. Si se empezara por Ventas,
esas mismas piezas habría que construirlas igual pero enterradas dentro de
`VentasTab.tsx`, para después copiarlas a mano ocho veces.

## 2. Alcance

### Entra en esta ola

1. `SmartTable`: columna `#` correlativa, paginación local y vista de tarjeta en celular.
2. `ui.tsx`: primitiva para agrupar campos de formulario con título.
3. **Clasificaciones** (`LookupTab`, que alimenta las 4 pestañas): modal de alta/edición,
   paginación, `#` correlativo, avisos de error y de duplicado.
4. **Usuarios** (`UsuariosTab`): paginación, `#`, tarjeta móvil, formulario en bloques,
   `alert()` → toast.
5. Los tres handlers de lookup de `DashboardPage` pasan a informar si fallaron.

### NO entra (queda para las olas 2 y 3)

- **Ola 2**: Ventas y Créditos (el formulario de líneas, el total en vivo, partir el
  archivo de 607 líneas).
- **Ola 3**: Inventario, Proveedores, Insumos y precios, Costos de producción, Tamaños y
  fórmulas.
- Filtros por columna en la vista de tarjeta (ver §7, riesgos).

### No se toca el backend

Ni migración, ni dependencia nueva, ni paso especial de deploy. Todo es frontend.

## 3. Decisiones tomadas con el dueño

| Decisión | Elegido | Razón |
|---|---|---|
| Orden de trabajo | Cimientos primero, luego Ventas | Validar las piezas en pantallas simples antes de copiarlas a 7 más |
| Uso desde el celular | Sí, registra desde el celular | Justifica construir la vista de tarjeta |
| Alta en Clasificaciones | **Modal**, como el resto del dashboard | Consistencia. Se compensa el costo de clics con "Guardar y agregar otro" |
| Tarjeta en móvil | **Resumida**, se expande al tocar | Caben 5-6 registros en pantalla en vez de 2 |

**El `#` es decorativo.** Es la posición en la lista visible, no un identificador. Si se
reordena la tabla, el #1 pasa a ser otro registro. El `id` de la base sigue siendo la
llave real de todo: `rowKey`, y las rutas `PATCH /entidad/:id` y `DELETE /entidad/:id`.
El `#` nunca viaja al servidor. Kevin confirmó explícitamente que este es el
comportamiento que espera.

Recordatorio vigente del proyecto: **nada de `PUT`** — el CORS del backend solo permite
`GET`, `POST`, `PATCH` y `DELETE`.

## 4. Diseño técnico

### 4.1 `components/table/SmartTable.tsx`

Todos los cambios son **aditivos** (props opcionales) porque hoy la usan ~10 pestañas que
esta ola no toca. Sin pasar ninguna prop nueva, el comportamiento actual no cambia.

**Props nuevas**

```ts
interface SmartTableProps<T> {
  // …las de hoy…
  /** Muestra una columna "#" con la posición en la lista (1, 2, 3…). */
  numerada?: boolean;
  /**
   * Pagina en el navegador cuando la pantalla carga todas las filas de una.
   * Se ignora si ya se pasó `pagination` (paginación de servidor).
   */
  paginadoLocal?: boolean;
  /** Debajo de 640px, cambia la tabla por tarjetas en vez de scroll horizontal. */
  tarjetaMovil?: boolean;
  /** Acciones de la tarjeta en celular. Si falta, usa `renderActions`. */
  accionesMovil?: (row: T) => ReactNode;
}
```

La tarjeta es **opt-in** a propósito. Si se activara para todas las tablas, Ventas,
Créditos y Perfumes cambiarían de aspecto en esta misma ola, y esas pestañas tienen su
propio rediseño pendiente (§8). En la Ola 1 solo la encienden Clasificaciones y Usuarios;
Ventas la enciende en la Ola 2, cuando se le definan bien los papeles de sus columnas.

**Numeración**

```
numero = offset + índiceEnLaPáginaVisible + 1
offset = pagination        ? (pagination.page - 1) * pagination.pageSize
       : paginadoLocal     ? (pageLocal - 1) * sizeLocal
       : 0
```

Es continua entre páginas: con 25 filas por página, la página 2 empieza en 26.

**Paginación local**

Estado propio `pageLocal` / `sizeLocal` (por defecto **25**). Corta `processed` con
`slice`. Reutiliza el mismo pie de página y el mismo selector de "Filas" que ya existe
para la paginación de servidor.

El 25 es a propósito distinto del `DEFAULT_PAGE_SIZE = 10` de `helpers.ts`: ese aplica a
las pestañas que piden página por página al servidor (Ventas, Combos), donde cada página
cuesta una petición. Aquí las filas ya están todas en memoria, así que cortar de a 10
solo obliga a paginar más sin ahorrar nada.

> **Detalle que no se puede olvidar**: al cambiar búsqueda, filtros u orden hay que volver
> a `pageLocal = 1`. Sin eso, filtrar de 200 a 3 registros deja al usuario mirando una
> página 7 vacía.

**Vista de tarjeta en celular**

`ColumnDef<T>` gana un campo opcional que dice qué papel juega la columna en la tarjeta:

```ts
movil?: 'titulo' | 'meta' | 'estado' | 'destacado' | 'detalle';
```

| Papel | Dónde sale en la tarjeta |
|---|---|
| `meta` | Línea gris de arriba, junto al `#` (ej. la fecha) |
| `titulo` | El nombre grande |
| `estado` | Insignia a la derecha arriba (ej. Pagada / Pendiente) |
| `destacado` | La cifra grande abajo (ej. el valor) |
| `detalle` | Solo al expandir — **es el valor por defecto** de toda columna sin marcar |

Se elige entre tabla y tarjetas con un hook de media query en **640px** (el `sm` de
Tailwind). Se generaliza el `usePantallaAngosta` que ya existe para el paginador compacto
a un `useMediaQuery(query)` reutilizable, conservando su uso actual en 520px. Se renderiza
**una sola** de las dos vistas (no las dos con `hidden`) para no duplicar el DOM.

Estado de expansión: un `Set` de claves de fila. Usa `rowKey` si existe; si no, el índice.

Los botones de acción en la tarjeta ocupan mínimo **44×44 px** (objetivo táctil cómodo) y
viven en una fila con borde superior dentro del área expandida.

`accionesMovil` existe porque `renderActions` devuelve botones de solo icono, pensados
para una fila estrecha de tabla. En la tarjeta hay ancho de sobra y el icono solo es
ambiguo con el pulgar, así que Clasificaciones y Usuarios pasan `accionesMovil` con
botones etiquetados (`✎ Editar`, `🗑 Borrar`). Las pestañas que no lo pasen siguen
mostrando los iconos de `renderActions`, agrandados.

### 4.2 `pages/dashboard/ui.tsx`

Se agrega una primitiva para agrupar campos:

```tsx
/** Grupo de campos con título; separa secciones dentro de un formulario largo. */
export function BloqueCampos({ titulo, descripcion, children }: {
  titulo: string;
  descripcion?: string;
  children: ReactNode;
}) { /* título pequeño en mayúsculas + hijos, separados por una línea */ }
```

Es la pieza que en la Ola 2 va a partir el formulario de Ventas en tres.

### 4.3 `tabs/LookupTab.tsx`

Se reescribe sobre `SmartTable` + `Modal`. Deja de pintar su propia `<Table>`.

**Props nuevas**

```ts
nuevo: string;      // "Nueva categoría"  → botón y título del modal de alta
editar: string;     // "Editar categoría" → título del modal de edición
ejemplo?: string;   // "Ej: Árabes, Diseñador, Nicho" → ayuda bajo el campo
```

Se pasan los dos textos ya redactados en vez de derivar género gramatical de una palabra:
"Nuevo aroma" y "Nueva categoría" no salen de la misma regla, y adivinarla produce texto
mal escrito.

**Cambios de contrato con `DashboardPage`**

`onAdd`, `onEdit` y `onDelete` pasan de `Promise<void>` a:

```ts
Promise<{ ok: boolean; error?: string }>
```

Así la pestaña sabe si guardar cerró bien y puede avisar con el mensaje del backend, que
ya viene redactado en español.

**Comportamiento**

- Botón **`+ {nuevo}`** en la barra de acciones, junto a Exportar/Importar.
- Modal con: campo `Nombre *`, la ayuda de `ejemplo`, y tres botones —
  `Cancelar`, **`Guardar y agregar otro`** (guarda, limpia el campo, deja el cursor
  adentro y el modal abierto) y `Guardar` (guarda y cierra).
- **Duplicado**: antes de llamar al servidor se compara contra la lista ya cargada
  normalizando (minúsculas y sin tildes). Si coincide, aviso
  *"Ya existe una categoría llamada Árabes"* sin gastar una petición. Si aun así el
  servidor rechaza, se muestra su mensaje.
- **Editar**: el mismo modal, prellenado. Desaparece la edición dentro de la fila.
- **Borrar**: conserva la confirmación que ya existe en `DashboardPage.tsx:215`, y ahora
  además avisa si el backend la rechaza (elemento en uso).
- Tabla: `numerada`, `paginadoLocal`, buscador de `SmartTable`, columna única `Nombre`
  marcada como `movil: 'titulo'`.

### 4.4 `tabs/UsuariosTab.tsx`

- `SmartTable` con `numerada` y `paginadoLocal`.
- Papeles móviles en las columnas: `persona` → `titulo`, `tipo` → `estado`,
  `created_at` → `meta`; el resto queda en `detalle`.
- El modal se parte con `BloqueCampos` en dos grupos:
  - **Datos de contacto**: nombre, apellido, correo, teléfono, dirección.
  - **Cuenta web**: estado y contraseña (el bloque entero solo aparece cuando la persona
    tiene cuenta real, igual que hoy).
- El `alert()` de error al eliminar (`UsuariosTab.tsx:103`) pasa a `toast.error`, que es
  el estándar del proyecto.

### 4.5 `DashboardPage.tsx`

Los tres handlers (`handleLookupAdd`, `handleLookupDelete`, `handleLookupEdit`,
líneas 209-223) devuelven `{ ok, error }` leyendo `res.ok` y el JSON de respuesta. Se
mantiene el `refreshAll()` en caso de éxito. La confirmación de borrado se queda donde
está.

## 5. Cómo se ve

### Clasificaciones — computador

```
CATEGORÍAS  (12)          [Exportar] [Importar] [+ Nueva categoría]

🔎 Buscar…                                        12 registros

┌────┬────────────────────────────────────────────┬──────────┐
│ #  │ NOMBRE                                ⇅    │          │
├────┼────────────────────────────────────────────┼──────────┤
│ 1  │ Árabes                                     │  ✎   🗑  │
│ 2  │ Diseñador                                  │  ✎   🗑  │
│ 3  │ Nicho                                      │  ✎   🗑  │
└────┴────────────────────────────────────────────┴──────────┘

Filas: 25 ▾                                     ‹  1  2  ›
```

### Modal de alta

```
┌─ Nueva categoría ───────────────────────────────┐
│  Nombre *                                       │
│  [ ____________________________ ]               │
│  Ej: Árabes, Diseñador, Nicho                   │
│                                                 │
│  [Cancelar]  [Guardar y agregar otro]  [Guardar]│
└─────────────────────────────────────────────────┘
```

### Tarjeta en celular (resumida y expandida)

```
┌──────────────────────────────────┐
│ 12 · 22 jul            ● Pagada  │   ← meta, #, estado
│ Andrés Rojas                     │   ← titulo
│ 2× Eros · Sauvage                │
│ $196.000                      ⌄  │   ← destacado
└──────────────────────────────────┘

── al tocar ──────────────────────────

┌──────────────────────────────────┐
│ 12 · 22 jul            ● Pagada  │
│ Andrés Rojas                     │
│ $196.000                      ⌃  │
│ ──────────────────────────────── │
│ Cliente    🔗 Andrés Rojas       │   ← detalle
│ Unidades   3                     │
│ Cupón      🎟 CP-7XK2M9 (-10%)   │
│ ──────────────────────────────── │
│    [ ✎ Editar ]   [ 🗑 Borrar ]   │
└──────────────────────────────────┘
```

(El ejemplo usa Ventas porque muestra los cinco papeles; en la Ola 1 solo se estrena en
Clasificaciones y Usuarios.)

## 6. Cómo se verifica

Sin pruebas automatizadas nuevas: el proyecto no tiene suite de front y montarla no es
parte de esta ola. La verificación es manual y visual, como se trabaja aquí.

1. **Compila**: `npm run build` en `frontend/` sin errores de TypeScript.
2. **Capturas** con Playwright + msedge headless, en 1440px y en 390px, de:
   Categorías, Aromas y Usuarios.
3. **Pruebas a mano**, cada una con su resultado esperado:
   - Agregar una categoría que ya existe → aviso *"Ya existe una categoría llamada X"*,
     sin petición al servidor.
   - Borrar una categoría que está en uso por un perfume → aviso rojo con el mensaje del
     backend (hoy no aparece nada).
   - "Guardar y agregar otro" tres veces seguidas → tres elementos creados sin cerrar el
     modal ni volver a hacer clic en el botón de alta.
   - Con 40 aromas: la página 2 arranca en el **#26**.
   - Ordenar por Nombre → el `#` se renumera con el orden visible; editar un elemento
     sigue afectando al correcto (se comprueba con un nombre único).
   - Filtrar hasta dejar 2 resultados estando en la página 3 → vuelve a la página 1 y se
     ven los 2.
   - En 390px: la tarjeta se expande al tocar, los botones se pueden pulsar con el pulgar,
     y no hay scroll horizontal en la página.
4. **No regresión**: Ventas, Créditos y Perfumes (que usan `SmartTable` con paginación de
   servidor y no reciben ninguna prop nueva) siguen viéndose y funcionando igual.

## 7. Riesgos

| Riesgo | Cómo se contiene |
|---|---|
| `SmartTable` la usan ~10 pestañas; romperla rompe medio dashboard | Todas las props nuevas son opcionales; sin pasarlas, el render es idéntico al de hoy. El punto 4 de la verificación lo comprueba |
| En vista de tarjeta no hay `<th>` donde colgar los filtros por columna | En celular se ofrece **buscador y orden**, no filtros por columna. Clasificaciones y Usuarios no los necesitan. Si en la Ola 2 hacen falta para Ventas, se resuelve ahí con un panel de filtros propio |
| Cambiar la firma de `onAdd`/`onEdit`/`onDelete` toca `DashboardPage` | Son 4 usos, todos en el mismo archivo y contiguos (líneas 361-380) |
| La paginación local se salta filas si el corte se hace antes de filtrar | El corte se aplica **sobre `processed`** (ya filtrado y ordenado), nunca sobre `rows` |

## 8. Después de esta ola

- **Ola 2 — Ventas y Créditos**: formulario en bloques con total en vivo, eliminar el
  campo "Cantidad" duplicado (`VentasTab.tsx:512`, que hoy compite con las líneas y
  obliga a cuadrarlo a mano), y partir el archivo de 607 líneas.
- **Ola 3 — Inventario, Proveedores, Insumos y precios, Costos de producción, Tamaños y
  fórmulas.**

Cada una con su propio diseño escrito y su aprobación antes de tocar código.
