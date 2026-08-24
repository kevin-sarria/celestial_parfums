# Productos y accesorios: separar lo que se fabrica de lo que ya existe

**Fecha**: 2026-08-23 · **Decidido con el dueño**: apartado propio en el dashboard (opción 2 de
tres), con el límite puesto en "no se fabrica al vender" (opción 1 de tres) y el alta desde el
lote (opción 1 de tres).
**Estado**: diseño aprobado por el dueño, parte por parte. Pendiente: implementación en 3 olas.

## El problema, medido

El dueño intentó vender un perfumero desde *Registrar venta*, escribió "perfumero" en el buscador
y recibió **"Sin productos en el catálogo"**. Lo mismo con los 1.1. Su reacción textual: *"sigo
sin entender dónde agrego los perfumeros para la venta o los 1.1 si ni siquiera los lista"*.

No era un fallo: era el modelo mental del sistema chocando con el del negocio.

- El buscador de la venta lee **fichas de perfume** (`urls.perfumes.todosConOcultos`), no insumos.
  Un perfumero que solo existe como `insumo_costo` nunca va a aparecer ahí.
- Un 1.1 tampoco aparece porque **su ficha no existe todavía**: hay 5 lotes registrados
  (perfumes 424, 549, 651, 619 y 446) apuntando a las fichas de los perfumes ORIGINALES.
- Y el orden está invertido respecto a cómo trabaja el dueño: **no se puede registrar un lote de
  algo que no esté ya en el catálogo**. Su cabeza dice *"lo armé, entonces ya lo tengo"*; el
  sistema exige la ficha primero. Textual: *"se supone que ya los tenemos cuando están hechos en
  producciones"*.

Consecuencia de plata, ya vivida: mientras el perfumero no sea un producto vendible, venderlo
**no descuenta inventario y su costo entra en cero**, así que la ganancia del mes sale inflada
exactamente en lo que cuestan los perfumeros regalados.

## La regla que gobierna todo el diseño

Una sola frase decide dónde vive cada cosa, y el sistema la evalúa solo — **no es una lista que
el dueño mantenga a mano**:

> ¿El producto **existe antes** de que lo vendas? → **Productos**.
> ¿Se **fabrica en el momento** de venderlo? → **Perfumes**.

En columnas que ya existen:

```
Productos = solo_armado = true            (los 1.1)
         OR tipo_producto = 'comprado'    (splash 200/250, gorras, y todo es_accesorio)

Perfumes  = TODO LO DEMÁS  (el complemento exacto de Productos)
```

**Perfumes se define como el complemento, no como una segunda lista.** Corregido el
2026-08-23 tras la revisión de la Tarea 1: la primera versión decía
`tipo_producto = 'fabricado' AND solo_armado = false`, y eso dejaba un hueco — un
`fraccionado` (un decant sacado de una botella grande) no caía en ninguna de las dos y
habría desaparecido de las dos pestañas sin avisar. Hoy no hay ninguno en el catálogo,
pero el código de decants existe y está vivo (`inventario.consumoVenta.ts`).

Un **decant va en Perfumes**, y sale de la propia regla que gobierna el diseño: no existe
antes de venderse — se corta de la botella grande en el momento de la venta. Definir una
familia en positivo y la otra como su complemento hace que la partición no pueda volver a
agujerearse, ni siquiera el día que aparezca un cuarto `tipo_producto`.

**El 212 VIP Black armado NO entra en Productos.** Es un perfume normal que casualmente tiene 5
frascos hechos; se queda en Perfumes. Se descartó explícitamente el criterio "lo que tenga stock
hoy": un producto que entra y sale de una pantalla según las unidades es de lo que más confunde
con el tiempo — hoy lo buscas ahí y mañana no está.

## El dashboard y la tienda se agrupan con criterios DISTINTOS

Es la decisión menos intuitiva del diseño y la que más fácil se deshace por error, así que queda
escrita con su porqué:

| | Criterio | Por qué |
|---|---|---|
| **Dashboard** | ¿Existe antes de venderse? | El dueño cuenta unidades. Un 1.1 y un perfumero se manejan igual: se cuentan, se arman o se compran, y se acaban |
| **Tienda** | ¿Es fragancia o accesorio? | El cliente no compra "unidades contadas". Compra perfume o compra accesorio |

Por eso un 1.1 vive con el perfumero en *Productos* (dashboard) pero sale con los perfumes en
`/perfumes` (tienda). **Un 1.1 no es un accesorio**: es un perfume de esencia con envase premium,
y meterlo en `/accesorios` sería mentirle al cliente.

## Costo aceptado por el dueño

Se le mostró antes de decidir y lo eligió sabiéndolo: **buscar "Bon Bon" en la pestaña Perfumes
ya no encuentra el Bon Bon 1.1.** Son dos listas y hay que saber en cuál mirar. Se aceptó porque
el dueño piensa su inventario por "lo que tengo físicamente contado", y esa es su pantalla.

## Sin migración

Las cuatro columnas que este diseño necesita ya existen en `schema.prisma`:

| Columna | Línea | Qué aporta aquí |
|---|---|---|
| `solo_armado` | 403 | Marca los 1.1 |
| `es_accesorio` | 411 | Separa accesorio de fragancia (solo válido con `comprado`) |
| `tipo_producto` | 381 | `fabricado` / `comprado` |
| `publicado` | 421 | El "Mostrar en la tienda" |

Despliegue normal: `git pull` + build. **No se toca ni un dato.**

## Pantalla: Productos (nueva, dentro de Catálogo)

```
CATÁLOGO ▸  Perfumes   Productos   Combos   Precios   Descuentos
            (215)      (7)

PRODUCTOS  (7)                                    (datos de ejemplo)
┌──────────────────────────────────────────────────────────────────────┐
│ 🔎 Buscar…                              [Exportar]  [+ Nuevo producto]│
│ ┌────┬────────────────────┬───────────┬────────┬───────────┬───────┐ │
│ │ #  │ NOMBRE          ⇅  │ TIPO      │ STOCK  │ PRECIO    │TIENDA │ │
│ ├────┼────────────────────┼───────────┼────────┼───────────┼───────┤ │
│ │ 1  │ Asad 1.1           │ 1.1       │   1    │ $120.000  │  Sí   │ │
│ │ 2  │ Bon Bon 1.1        │ 1.1       │   4    │ $150.000  │  ⚠No  │ │
│ │ 3  │ Splash Coco 250    │ Comprado  │  12    │  $45.000  │  Sí   │ │
│ │ 4  │ Perfumero Recarg.  │ Accesorio │  20    │   $5.000  │  Sí   │ │
│ │ 5  │ Bolsa de Organza   │ Accesorio │  50    │   $2.000  │  No   │ │
│ └────┴────────────────────┴───────────┴────────┴───────────┴───────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

- **Sin columnas de esencia ni de talla**: un accesorio no las tiene y un 1.1 tiene una sola.
- **STOCK** sale de `perfume_presentacion.stock` (los armados) o del insumo enlazado (los
  comprados). Es lectura, no un campo editable: se mueve al armar, comprar o vender.
- **TIPO** se deduce, no se guarda: `solo_armado` → "1.1"; si no, `es_accesorio` → "Accesorio";
  si no, "Comprado". El orden importa: un accesorio es siempre `comprado`, y mostrarlo como tal
  escondería lo único que lo distingue.
- **TIENDA** no es un interruptor nuevo. Es la acción **"Sacar / Devolver a la tienda"** que ya
  existe en cada fila (`AccionesPerfume.tsx`), **con su confirmación** — decisión del dueño del
  2026-08-14, sostenida: toca la tienda de cara al público.

**No se duplica `PerfumesTab.tsx`** (468 líneas). Copiarla daría dos pantallas casi iguales que un
día dirán cosas distintas. Se extrae la parte compartida (tabla + modal de ficha) a una pieza
sola y las dos pantallas la configuran. Es más trabajo hoy y menos problema siempre.

## Pantalla: Producciones deja de ser solo un historial

```
PRODUCCIONES  (5)
┌────────────────────────────────────────────────────────────────────┐
│ FECHA    LOTE                  COSTO      EN TIENDA                │
│ 21 ago   4 × Bon Bon 1.1     $327.316   ⚠ Sin foto      [Completar]│
│ 21 ago   5 × 212 VIP Black   $120.940   ✓ Sí            [Ver ficha]│
│ 20 ago   1 × Asad 1.1         $54.436   ⚠ Sin publicar  [Completar]│
└────────────────────────────────────────────────────────────────────┘
```

**Completar** abre la ficha REAL del producto (el mismo modal de Productos), no una copia ni un
formulario nuevo. Ahí van foto, descripción, notas y el publicar. El aviso ⚠ dice qué le falta:
sin foto, sin descripción o sin publicar.

Por qué aquí: es donde el dueño está cuando termina de armar. Pedirle que se acuerde de ir a otra
pestaña es exactamente cómo quedaron 9 frascos sin ficha.

## Alta de un 1.1 desde el lote

```
INVENTARIO ▸ Registrar uso ▸ Armé perfumes
┌─────────────────────────────────────────────┐
│ ¿Qué armaste?                               │
│ 🔎 bon bon 1.1                              │
│ ─────────────────────────────────────────── │
│  + Crear "Bon Bon 1.1" como producto nuevo  │
│      Envase   [ Frasco premium 1.1     ▾ ]  │
│      Precio   [ 150000                   ]  │
│      Esencia  [ Bon Bon                ▾ ]  │
│                                             │
│  Nace fuera de la tienda. Le pones foto y   │
│  la publicas cuando quieras.                │
└─────────────────────────────────────────────┘
```

Es el **tercer hermano** de un patrón que ya existe dos veces en `emparejarEsencias.repository.ts`:

| Origen | Función | Qué crea |
|---|---|---|
| Una esencia | `enlazarOCrearPerfume` | La fragancia que sale de ella (`fabricado`) |
| Un accesorio | `enlazarOCrearAccesorio` | El producto que se revende tal cual (`comprado`) |
| **Un lote** | **nuevo** | **El 1.1 que acabas de armar (`solo_armado`)** |

Reglas heredadas de los hermanos, no reinventadas:
- **Nace `publicado: false`.** Nadie ve una ficha a medio llenar.
- **Si ya hay un producto con ese nombre, no se toca**: se avisa y decide el dueño. Convertir una
  ficha existente porque coincide el nombre es justo como se corrompen los datos.
- **Una sola puerta de alta para el 1.1** (desde el lote). Se descartó ofrecer las dos puertas:
  "Bon Bon 1.1" creado por un lado y "Bon bon 1.1" por el otro son dos fichas, stock partido y
  costos que no cuadran.

`+ Nuevo producto` en la pestaña Productos sigue existiendo, pero **no ofrece marcar "solo
armado"**: sirve para accesorios y comprados, que no nacen de un lote. Un 1.1 se crea únicamente
al armarlo. Es la consecuencia directa de la puerta única, y hay que decirlo aquí o alguien
"arreglará" el formulario en tres meses agregándole la casilla.

## La tienda

```
MENÚ:   Inicio    Perfumes    Accesorios    Combos    Blog
                  ────────    ══════════
        fragancias + 1.1      perfumero, bolsa,
        + splash              tarjeta
```

- **`/perfumes`**: deja de mostrar `es_accesorio`. Los 1.1 y los splash siguen ahí — son
  fragancias — y ya se filtran por categoría, sin inventar nada.
- **`/accesorios`**: página nueva. **Título y description propios** (Marketing rechaza una página
  nueva sin ellos), canonical, y entrada en el `sitemap.xml`. Sin filtros de género ni de notas:
  en una bolsa de organza no significan nada.
- El menú del pie (`Footer.tsx`) y el de cabecera (`CatalogHeader.tsx`) ganan la entrada. El
  grupo TIENDA pasa de 4 a 5 elementos; el orden del embudo no cambia (Accesorios va después de
  Perfumes, antes de Combos: es complemento, no destino).

Un producto solo se ve en la tienda si el dueño lo publicó. Los creados desde un lote nacen
apagados.

## Medido contra los datos reales (2026-08-23)

La base local del dueño (`perfumes_db`) estaba atrasada; los números buenos salen de sus capturas
de la tienda en vivo y de la base local para lo que sí coincide.

| Medición | Valor | Qué implica |
|---|---|---|
| Perfumes por tipo | **222, TODOS `fabricado`** | Ninguno `solo_armado`, ninguno `es_accesorio` |
| Insumos tipo accesorio | 2 (Perfumero Recargable, Bolsa Organza) | Existen como material, **sin ficha de producto** |
| Envases 1.1 (en vivo) | 5, todos en **0 unidades** | Cada producción se llevó el suyo. Correcto |
| Producciones (en vivo) | **6 lotes** (5 de 1.1 + 1 de 212 VIP Black ×5) | Uno más que los 5 de `pendientes.md`: Khamrah, 21/8 |
| Categorías | 1.1, Contratipo, Original | La categoría 1.1 ya existe |
| Stock de Perfumero Recargable | **−5.000 unidades** | Salieron 5 que nunca entraron: el problema de los regalos, en números |

### Consecuencia de diseño: la pestaña Productos NACE VACÍA

Con 222 fabricados y cero de todo lo demás, el día que se publique la pestaña muestra **0 filas**.
Una tabla en blanco no enseña nada. Aplica la skill `arranque-guiado`, y sus reglas se respetan
tal cual:

```
PRODUCTOS                                              0 de 3

Aquí van las cosas que ya existen antes de venderlas: los 1.1 que
armas, los splash que compras hechos y los accesorios.

○ 1. Pon a la venta un accesorio que ya tienes
     Tienes 2 sin ficha: Perfumero Recargable, Bolsa Organza    [Empezar]
○ 2. Dale su ficha a un 1.1 que ya armaste
     Tienes 5 lotes de 1.1 apuntando al perfume normal          [Empezar]
○ 3. Muéstralos en tu tienda
     Nacen apagados; tú decides cuáles se ven                   [Empezar]
```

- **El progreso se deduce de los datos**, nunca de una bandera: `¿hay algún es_accesorio?`,
  `¿algún solo_armado?`, `¿alguno publicado?`. Quien ya trabajó nunca ve la lista.
- **Cada paso abre la pantalla real**, no un formulario paralelo.
- **Ningún paso bloquea nada.** La lista desaparece sola cuando los tres están hechos.
- Los conteos del texto ("Tienes 2 sin ficha") **se calculan**, no se escriben a mano.

## Pendiente que salió de esta sesión y NO entra aquí

**La maceración.** El sistema asume que producir = llenar frascos, y en la realidad son dos
momentos separados por semanas. El lote de 212 VIP Black (11/8, 5 × 100 ml) hoy miente: el líquido
está en un frasco de 1 litro macerando y los 5 envases siguen vacíos en la repisa. Decisión del
dueño (2026-08-23): **va después de estas 3 olas**. Detalle y modelo propuesto en
[`pendientes.md`](../../pendientes.md).

## Implementación en 3 olas

El orden lo fija el riesgo de cara al cliente, no la dificultad:

1. **Ola 1 — el dashboard.** Pestaña Productos + Perfumes filtrado + la extracción de la pieza
   compartida. **No cambia nada de lo que ve el cliente.** El dueño la usa unos días y opina antes
   de que el patrón se copie.
2. **Ola 2 — Producciones.** Completar ficha desde el lote y el alta del 1.1 al armar. Aquí
   desaparece la fricción medida arriba.
3. **Ola 3 — la tienda.** `/accesorios`, sacar accesorios de `/perfumes`, SEO y sitemap. Va de
   última **a propósito**: es la única que ve el cliente, y las fichas deben estar llenas antes.

## Pruebas que tiene que dejar

**Backend (base):**
- Un `solo_armado` no sale en el listado de Perfumes y sí en el de Productos.
- Un `comprado` con `es_accesorio` sale en Productos y **no** en `/perfumes` público.
- Un `fabricado` con frascos armados (el 212 VIP Black) **sigue** en Perfumes.
- Crear el 1.1 desde un lote lo deja `publicado: false` y `solo_armado: true`.
- Nombre repetido al crear desde el lote: se rechaza y avisa, no crea una segunda ficha.

**Recorrido en navegador (E2E):**
- Armar un lote de un 1.1 que no existe → crearlo ahí mismo → verlo en Productos fuera de la
  tienda → completar la ficha desde Producciones → publicarlo → verlo en `/perfumes`.
- Un accesorio publicado aparece en `/accesorios` y **no** en `/perfumes`.

**Visual:** capturas de Productos, Perfumes y Producciones en escritorio y celular, **con medidas
en píxeles**, y no-regresión en dos pantallas que no se tocaron.

**Con datos reales:** medir contra los 222 productos del dueño antes de dar nada por bueno. En la
sesión de diseño no se pudo — **MySQL de XAMPP estaba apagado**.

## Lo que NO cambia

- **Ninguna regla de negocio.** No se toca ni un precio, ni una receta, ni el costo promedio, ni
  el consumo por venta, ni las tres reglas de disponibilidad (`motivoAgotado`).
- **La confirmación al sacar de la tienda** se queda (decisión del dueño, 2026-08-14).
- **El buscador de accesorios en Registrar venta** ya está construido (commit `076e723`,
  2026-08-22, sin desplegar). Este diseño no lo rehace.
- **Créditos sigue sin regalos ni accesorios**: su backend no los guarda.
- **Los datos no se mueven.** Perfumes y Productos son dos vistas de la misma tabla.

## Efecto sobre el runbook de los 9 frascos

El runbook de [`pendientes.md`](../../pendientes.md) tiene hoy 4 pasos, e incluye crear 5 fichas
de 1.1 a mano. **Con la Ola 2 ese paso desaparece**: las fichas nacen del propio lote al
rehacerlo, y queda solo borrar y volver a registrar.

Decisión pendiente del dueño: esperar la Ola 2 y hacerlo en la mitad de pasos, o hacerlo a mano ya
si necesita vender antes. **Si es urgente, a mano** — no vale la pena dejar de vender por esperar
código.
