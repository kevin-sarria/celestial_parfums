# Catálogo por línea — diseño

**Fecha:** 2026-10-04 · **Decidido con el dueño en la conversación del 2026-10-04.**
Tercer proyecto del rediseño del núcleo de producto (ver "Orden" al final).
Es el que quedó **a medias el 2026-10-04**: Claude Code alcanzó a hacer el inventario y se
acabó la sesión **sin escribir una línea de código**. Esto es ese inventario, ordenado.

## El problema

El dueño lo pidió así (2026-10-04, `pendientes.md`):

> **"el catálogo con una pestaña por línea (Contratipos · 1.1 · Originales · Productos y
> accesorios)"**

Hoy el catálogo del panel tiene **DOS pestañas**, y las partió una pregunta que **no es la que
el dueño se hace**:

| Pestaña de hoy | La pregunta que la define | Qué termina mostrando |
|---|---|---|
| **Perfumes** | "¿no existe antes de venderse?" | Contratipos **+ Originales** (el `fraccionado` cae aquí por el `NOT`) |
| **Productos** | "¿existe antes de venderse?" | 1.1 **+ Comprados y accesorios** |

El dueño **no piensa así**. Piensa en **líneas**: un contratipo, un 1.1, un original, un
perfumero. Y hoy esas cuatro cosas viven revueltas de dos en dos:

- Un **Original** (13 en producción) sale listado entre los contratipos — que es justo lo que la
  tienda ya separa con una etiqueta para que el cliente no los confunda.
- Un **1.1** (21 en producción) sale listado entre los perfumeros y las bolsas.

**El síntoma que lo prueba**: la tienda ya resolvió esto. La tarjeta pública dice
*Contratipo / 1.1 / Original* (`NOMBRE_LINEA`), y esa etiqueta existe porque *"si la tarjeta no
dice cuál es cuál, el cliente compara un decant original con un contratipo de 100 ml y cree que
algo está mal"* (`domain/entities/linea.ts`). El cliente ve la línea; **el dueño, no.**

## Lo que YA existe (el hallazgo que simplifica el proyecto)

**La línea está construida de punta a punta. No hay que inventar nada.** Medido en el código:

| Pieza | Dónde | Qué es |
|---|---|---|
| `lineaDe()` | `backend/src/repositories/perfume.mapeo.ts:107` | La función pura que **deduce** la línea de una ficha |
| `LineaProducto` | mismo archivo, línea 105 | `'contratipo' \| '1.1' \| 'original' \| 'accesorio' \| 'producto'` |
| El dato viaja | `perfume.mapeo.ts:290` | `linea: lineaDe(p)` — **ya viene en la respuesta del catálogo** |
| Tipo del frontend | `frontend/src/domain/entities/perfume.schema.ts:86` | El mismo enum, validado con Zod |
| Cómo se nombra | `frontend/src/domain/entities/linea.ts` | `NOMBRE_LINEA` (Contratipo / 1.1 / Original) |
| `lineaEmpaqueDe()` | `backend/src/empaque/lineaEmpaque.ts` | Ya traduce la línea al empaque (proyecto 1) |

Y la deducción, tal cual (`lineaDe`, el orden IMPORTA):

```ts
if (p.es_accesorio)                  return 'accesorio';
if (p.solo_armado)                   return '1.1';
if (p.tipo_producto === 'fraccionado') return 'original';
if (p.tipo_producto === 'comprado')  return 'producto';
return 'contratipo';
```

**La consecuencia es la idea central de este proyecto:**

> Las **4 pestañas** que el dueño pidió son **exactamente las 4 puertas de alta**
> (`TIPOS_ALTA`, `tabs/perfumes/tipoDeProducto.ts`) y **exactamente las líneas** que ya se
> deducen. Una sola clasificación, usada en tres sitios.

| Pestaña | `TipoAlta` (la puerta de alta) | `lineaDe` (lo que sale) |
|---|---|---|
| **Contratipos** | `fragancia` 🧪 | `contratipo` |
| **1.1** | `armado` ✨ | `1.1` |
| **Originales** | `decant` 💧 | `original` |
| **Productos y accesorios** | `comprado` 📦 | `accesorio` + `producto` |

Hoy el catálogo usa la partición **vieja** (`familia`: `fabricadas` / `productos`), definida en
`perfume.familia.ts` a partir de `{ OR: [{ solo_armado: true }, { tipo_producto: 'comprado' }] }`.
Esa partición **no se bota**: queda como la definición de la pestaña 4 (productos y accesorios),
que es la única que agrupa dos líneas.

## Lo que hay en producción (medido contra el respaldo `celestial_prod_20260930`)

Base para verificar después. **La base local `perfumes_db` está atrasada** (232 / 0 / 1): no sirve
para medir esto.

| Línea | Fichas | Publicadas | Pestaña de hoy en la que sale |
|---|---|---|---|
| Contratipo | 248 | 246 | Perfumes |
| 1.1 | 21 | 21 | Productos |
| Original | 13 | 13 | **Perfumes** ← el que confunde |
| Accesorio / Comprado | 0 | 0 | Productos |

## Decisiones que solo puede tomar el dueño

**Decididas el 2026-10-04 por el dueño.** Queda la pregunta y lo elegido; la opción no elegida se conserva por el porqué, por si cambia algo.

| # | Pregunta | Opción A (recomiendo) | Opción B |
|---|---|---|---|
| 1 | **¿Cuántas pestañas?** | **4**: Contratipos · 1.1 · Originales · Productos y accesorios (lo que ya pediste) | **5**: partir la última en *Splash* (comprado, no accesorio) y *Accesorios*. No la recomiendo: hoy tiene **0 fichas**, y esa división ya la hace la columna *Tipo* dentro de la pestaña |
| 2 | **¿Cómo se ven en el menú?** | **Cuatro entradas sueltas** dentro del grupo *Catálogo*. Un clic para lo que tocas a diario | **Una sola entrada "Catálogo"** con un selector de líneas arriba, igual que *Clasificaciones*. Menú más corto, pero dos clics |
| 3 | **¿Botón "+ Nuevo" en cada pestaña?** | **Sí, y ya nace con su tipo elegido**: en *1.1* abre la puerta `armado`, en *Originales* la `decant`… Eso ya existe (`valoresDeTipo`) | Un único "+ Nuevo" que primero pregunta el tipo. Más pasos para el caso de todos los días |
| 4 | **¿"Originales" se puede crear desde su pestaña?** | **Sí**, con la puerta `decant`, más un renglón que recuerde que *"lo normal es crearlo desde la compra de la botella"* | **No**: la pestaña solo lista; un original nace en *Compras a proveedores*. Es más puro, pero deja al dueño sin dónde corregir una ficha a medias |
| 5 | **Los nombres de las pestañas** | *Contratipos · 1.1 · Originales · Productos y accesorios* | Los que usted diga (ej. "Mis fragancias", "Premium", "Decants") |

## Lo decidido (2026-10-04)

| # | Pregunta | Elegido |
|---|---|---|
| 1 | ¿Cuántas pestañas? | **4** |
| 2 | ¿Cómo se ven en el menú? | **4 entradas sueltas** en *Catálogo* |
| 3 | ¿"+ Nuevo" en cada pestaña? | **Sí**, cada una abre su puerta ya elegida (recomendación aceptada) |
| 4 | ¿Un Original se crea desde su pestaña? | **Sí**, con el recordatorio de que lo normal es desde la compra |
| 5 | ¿Nombres? | **Fijos por ahora**: *Contratipos · 1.1 · Originales · Productos y accesorios* |

> **Aplazado a propósito (por pedido del dueño):** nombres configurables para que él decida cómo
> se llaman y cuándo. Se anota como idea futura; montarlo ahora es "complicar de más el proyecto"
> (palabras suyas). Si algún día se hace, es un Ajuste (una lista `linea → nombre`), no una columna
> en cada ficha.

## Diseño

### 1. Una sola tabla de verdad: `lineaDe` manda

**El `WHERE` de cada pestaña se escribe para coincidir EXACTAMENTE con `lineaDe`, respetando su
orden de preguntas.** No es un detalle: `lineaDe` pregunta `es_accesorio` **primero**, así que un
accesorio con `solo_armado` sigue siendo accesorio. Si el `WHERE` preguntara al revés, la pestaña
y la etiqueta de la fila dirían cosas distintas.

`perfume.familia.ts` pasa a `perfume.linea.ts` y su mapa queda así:

```ts
// Cada línea en POSITIVO, menos `contratipo`, que es el COMPLEMENTO: dos listas paralelas se
// desincronizan el día que el enum crezca y lo que caiga en el hueco desaparece de todas.
const ACCESORIO = { es_accesorio: true };
const UNO_UNO   = { es_accesorio: false, solo_armado: true };
const ORIGINAL  = { es_accesorio: false, solo_armado: false, tipo_producto: 'fraccionado' };
const COMPRADO  = { es_accesorio: false, solo_armado: false, tipo_producto: 'comprado' };

export const WHERE_LINEA = {
  contratipo: { AND: [{ es_accesorio: false }, { solo_armado: false },
                      { NOT: { tipo_producto: { in: ['fraccionado', 'comprado'] } } }] },
  uno_uno:    UNO_UNO,
  original:   ORIGINAL,
  // La pestaña 4 son DOS líneas: es la partición vieja, intacta.
  producto:   { OR: [ACCESORIO, COMPRADO] },
} as const;
```

- El parámetro `?familia=fabricadas|productos` **se reemplaza** por `?linea=<una de las 4>`: dos
  formas de pedir lo mismo es exactamente lo que el proyecto prohíbe (*"una regla vive en UN solo
  sitio"*). `familia` sobrevive **solo** como el cuerpo de `producto`.
- El valor `linea` de cada fila **sigue siendo el de 5 valores** (`lineaDe`): es lo que pinta la
  columna *Tipo* y la etiqueta de la tienda. La pestaña agrupa de a 4; la fila dice de a 5.
- **Se conserva el patrón defensivo**: una prueba que verifique que *las 4 líneas juntas son el
  catálogo entero* y que *ningún tipo de producto se queda fuera*. Es la prueba que ya existe para
  las dos familias, ahora con cuatro.

### 2. Backend (lo que cambia, archivo por archivo)

| Archivo | Cambio |
|---|---|
| `repositories/perfume.linea.ts` | Nace (renombra `perfume.familia.ts`): `WHERE_LINEA`, `esLinea()`, `naceComoLinea()` |
| `repositories/perfume.repository.ts` | `selectParfumsPaginated(..., linea?)` usa `WHERE_LINEA[linea]` en vez de `WHERE_FAMILIA[familia]` |
| `services/perfume.service.ts` | La clave de caché pasa de `familia` a `linea` |
| `controller/perfume.controller.ts` | Lee `?linea=` con `esLinea()` (una línea desconocida se ignora, igual que hoy) |
| `routes/import.router.ts` + `services/import/catalogo.ts` | El export filtra por línea y el archivo se llama `export_contratipos.xlsx`, `export_1.1.xlsx`, `export_originales.xlsx`, `export_productos.xlsx` |
| `repositories/productos.primerosPasos.repository.ts` | Usa `WHERE_LINEA.producto`; el nombre del archivo deja de ser "productos" genérico |

**Nada más del backend se toca.** La tienda pública, Ventas, Créditos y los reportes siguen sin
mandar `linea`, y sin el parámetro el listado devuelve **todo** — que es lo que garantiza que el
buscador de la venta no pierda nada (`todosConOcultos` **no** lleva línea, a propósito).

### 3. Frontend — las pestañas

- **`tabs/PerfumesTab.tsx` + `tabs/ProductosTab.tsx` → `tabs/LineaTab.tsx`** (una sola). Hoy son
  dos archivos casi idénticos; con cuatro pestañas serían cuatro copias de lo mismo. `LineaTab`
  recibe la línea y saca de ahí: el sustantivo, la columna, el `ExportButton`, el texto de vacío y
  el punto de partida de la ficha.
- **`columns.tsx`**: `perfumesColumns` y `productosColumns` se unifican en `columnasDeLinea(linea)`.
  La columna *Tipo* (que hoy solo existe en Productos) **se queda en la pestaña 4**, que es la
  única que agrupa dos líneas.
- **`useFichaPerfume`**: cada pestaña le pasa su `valoresIniciales` — que ya se calculan con
  `valoresDeTipo(tipo)` de `tipoDeProducto.ts`. **No se escribe una tabla nueva.**
- **`pestanas.ts`, `navegacion.ts`, `types/index.ts`**: el union `Tab` cambia `perfumes` y
  `productos` por las cuatro líneas; el grupo *Catálogo* las lista en su orden.
- **`DashboardPage.tsx`**: hoy tiene **6 `useState` por pestaña** (data, page, total, pageSize,
  search, filtros) y dos funciones `load…` casi iguales. Con cuatro pestañas serían **24 estados y
  4 funciones**. Se refactoriza a **un solo mapa por línea** y **una sola función `cargarLinea`**.
  Es exactamente la regla del proyecto (*"refactoriza siempre que puedas"*) y evita la cuarta copia.
- **Permisos**: las cuatro pestañas siguen siendo `catalogo.ver` para mirar y solo-dueño para
  crear/editar/borrar/importar. La configuración no cambia.

### 4. Lo que ve el dueño en cada pestaña

| Pestaña | Botón | Columnas | Vacío dice |
|---|---|---|---|
| Contratipos | + Nuevo perfume (puerta `fragancia`) | las de hoy en Perfumes | — (nunca está vacía) |
| 1.1 | + Nuevo 1.1 (puerta `armado`) | las de hoy + *Unidades* (frascos armados) | "Todavía no armas ningún 1.1" |
| Originales | + Nuevo original (puerta `decant`) + el recordatorio de la compra | + *Te cuesta* por talla | "Aquí van tus originales y sus decants. Lo normal es que nazcan al comprar la botella" |
| Productos y accesorios | + Nuevo producto (puerta `comprado`) | las de hoy en Productos (con *Tipo* y *Unidades*) | el texto de hoy |

### 5. Lo que NO se toca (trampas ya vividas)

- **La tienda pública.** Ya parte por `es_accesorio` (`/perfumes` vs `/accesorios`), que es **otra
  pregunta** —la del cliente— distinta de la del panel. **No reutilizar `WHERE_LINEA` ahí.**
- **El buscador de Ventas y Créditos** (`todos=1` sin línea): se vende de todo desde el mismo
  buscador. Un filtro de línea ahí dejaría al dueño sin poder vender un perfumero.
- **La lógica de venta, costo, empaque y reportes.** Nada de esto cambia: la línea ya viaja y ya
  la usan `lineaEmpaqueDe` y el reporte por línea.
- **El histórico.** No se reescribe ni una fila: la línea se **deduce**, y por eso un cambio de
  regla se refleja solo.
- **`perfume_presentacion`, `envase_insumo_id`, empaque y precios de originales.** Sin cambios.

## Pruebas

- **Base de datos** (`perfume.linea.bd.test.ts`, renombra la de familia):
  - las 4 líneas juntas son el catálogo entero (nada se pierde por el hueco);
  - ningún `tipo_producto` del enum se queda fuera de las 4;
  - un accesorio con `solo_armado` sale en *Productos y accesorios* y **no** en *1.1* (el orden de
    `lineaDe` es el que manda);
  - el export respeta la línea y sin línea baja el catálogo entero.
- **e2e** (los que ya existen y hay que **actualizar**, no solo agregar):
  - `e2e/altaPorTipo.e2e.test.ts` usa `'+ Nuevo producto'` (línea 32) — con las pestañas nuevas el
    botón cambia por línea;
  - `e2e/desplegable.e2e.test.ts` usa `elegirTipoDeAlta`;
  - nuevo: cada pestaña lista **solo** su línea y su "+ Nuevo" abre la puerta correcta.
- **Medición contra el respaldo**, no a ojo: las 4 pestañas deben sumar 248 + 21 + 13 + 0 y decir
  dónde cayó cada una.

## Orden del rediseño (acordado)

1. ~~Empaque por línea, talla y combo~~ — hecho (`20261006120000_empaque_por_linea`).
2. ~~Precios de originales~~ — hecho (`20261007120000_meta_ganancia`).
3. **Este**: el catálogo con una pestaña por línea.
4. ~~Alertas según la velocidad de venta~~ — hecho (`dce5101`).

**Sin migración**: la línea se deduce, no se guarda. El deploy es `git pull` + build de los dos
lados.

## Revisión antes de publicar (2026-10-04)

El trabajo lo hizo otra sesión y se revisó antes de subirlo. Se corrigió:

- **El "+ Nuevo" de cada pestaña seguía preguntando "¿qué es?"** (la decisión 3 no estaba hecha):
  `useFichaPerfume` recibe `tipoInicial` y la pestaña abre su tipo ya elegido; "Cambiar" vuelve a
  la pregunta.
- **Primeros pasos de Productos**: "Dale su ficha a un 1.1" abría la ficha de un comprado. Ahora
  lleva a la pestaña 1.1.
- **Enlace viejo `/dashboard/perfumes`**: caía en Inicio; ahora lleva a Contratipos
  (`PESTANAS_RENOMBRADAS`).
- **Contador del título**: decía las filas de la página; ahora el total.
- **Originales**: en vez de género, aromas y duración, la columna *Tallas con precio* ("2 de 4") y
  el enlace a Precios de originales.
- **Fuera de este proyecto**: la sesión también cambió el buscador de la tienda pública para
  escribir los filtros en la dirección de la página. No se pidió, así que se apartó sin publicar
  y queda para que el dueño decida.
