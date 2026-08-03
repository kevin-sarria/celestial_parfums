# Rediseño del dashboard — Ola 2: Ventas y Créditos

**Fecha**: 2026-08-02
**Decidido con**: Kevin (dueño)
**Estado**: diseño para aprobar
**Continúa**: `2026-08-01-rediseno-dashboard-ola1-design.md` (Ola 1, hecha y verificada)
**Diagnóstico previo**: `2026-08-02-ola2-ventas-creditos-diagnostico.md`

---

## 1. Por qué

Ventas y Créditos hacen **lo mismo** —armar productos con talla y cantidad, calcular un
total, canjear un cupón— con **dos implementaciones distintas y desalineadas**. Cada una
quedó buena en lo que la otra no:

| | Ventas | Créditos |
|---|---|---|
| Precio de cada línea | ❌ | ✅ |
| Total en vivo mientras armas | ❌ | ✅ `CreditosTab.tsx:524` |
| Desglose del cupón | ❌ | ✅ |
| Guardarraíl anti doble descuento | ✅ `VentasTab.tsx:561` | ❌ |
| Precio de combo | ❌ | ✅ |

Son 1.172 líneas manteniendo por duplicado la misma regla de precios: cambiar una regla
obliga a acordarse de tocar las dos, y el día que alguien olvide una, los dos formularios
cobrarán distinto por lo mismo.

**Lo que más cuesta hoy**: en Ventas el valor se teclea **a ciegas**, sin que el sistema
diga cuánto suman las líneas. Ahí es donde se cobra de menos y nadie lo nota hasta cuadrar
caja.

## 2. Alcance

### Entra

1. **Un solo armador de pedido** compartido por las dos pantallas.
2. **Resumen del pedido** con subtotal, combo, cupón y total, también compartido.
3. **Ventas**: formulario en tres bloques, total sugerido, se elimina el campo "Cantidad"
   duplicado, tarjeta de celular, métricas con comparación contra el mes pasado.
4. **Créditos**: mismo armador y resumen, tarjeta de celular, y las métricas que hoy no
   tiene (cuánto te deben, cuánto está vencido).
5. **Los fallos silenciosos**: borrar avisa si el servidor rechaza, los tres `alert()`
   pasan a avisos, y la carga de datos deja de quedarse en "Cargando…" para siempre.
6. **Partir los dos archivos** (607 y 565 líneas) en piezas por debajo de ~500.

### No entra

- Ola 3: Inventario, Proveedores, Insumos y precios, Costos de producción, Tamaños y
  fórmulas.
- Cambiar cómo se guardan las ventas o los créditos en la base. El formato de envío al
  servidor **no se toca**: solo cambia cómo se arma en pantalla.

## 3. Decisiones tomadas con el dueño

| Decisión | Elegido | Razón |
|---|---|---|
| Unificar o arreglar por separado | **Unificar** en una sola pieza | Una regla de precios que mantener, no dos; y de paso parte los archivos gigantes |
| El valor de la venta | **Se sigue tecleando a mano** | Es la plata que entró de verdad. El sistema calcula y *ofrece*; la persona decide |
| El campo "Cantidad" suelto | **Desaparece** | Se deriva de las líneas; hoy es un dato duplicado que toca cuadrar a mano |
| Cupón ya canjeado al editar | **Bloqueado; solo se libera borrando la venta** | Hoy basta con borrar el texto del campo para revivirlo, y eso se puede hacer sin darse cuenta |

### El cupón canjeado se blinda (decidido el 2026-08-02)

Lo que **ya funcionaba**: un código canjeado no se puede usar en otra venta
(`anuncio.service.ts:321` lo rechaza con "ya fue canjeado").

**El agujero**: al editar una venta, `liberarCodigoDeVenta` devolvía a `activo`
**cualquier** código que se quitara del campo, incluidos los ya canjeados. Bastaba con
borrar el texto —a propósito o por descuido— para que esa persona pudiera volver a usarlo.

**La regla nueva**: un código en estado `canjeado` queda amarrado a su venta. Para
soltarlo hay que **eliminar la venta**, que es una acción deliberada y con confirmación.
Kevin eligió esta opción sabiendo el costo: si se teclea el código equivocado, corregirlo
obliga a borrar la venta y volver a registrarla. A cambio, nadie revive un cupón sin
querer.

**Ojo — en Créditos hoy funciona distinto A PROPÓSITO**: quitar el código al editar un
crédito lo libera, y `CLAUDE.md` lo documenta como *"el único camino para devolver un
cupón canjeado en crédito"*. Esta ola **no toca esa regla**; si se quiere igualar, es una
decisión aparte que hay que hablar con el dueño.

## 4. El punto delicado: la talla se guarda de dos formas

- **Créditos** usa `presentacion`, un **texto** (`"30ML"`): es la clave con la que se
  busca el precio en `perfume.precios[]`.
- **Ventas** usa `ml`, un **número** (`30`): es lo que necesita el inventario para saber
  qué receta descontar.

Las dos hacen falta y **no son intercambiables**. La decisión es **exponer `ml` desde el
servidor**, no adivinarlo en el navegador leyendo el texto:

- El dato ya existe (`presentaciones.ml`, migración `20260801140000_tallas_en_ml`) y ya
  viene en la consulta: es **una línea** en `resolverPrecios`
  (`backend/src/repositories/perfume.repository.ts:33`).
- Adivinarlo con una expresión regular es justo lo que `CLAUDE.md` advierte que no se
  haga, porque de ese número depende **qué insumo se descuenta**.
- Y no siempre hay número que adivinar: `"200/250ML"` y `"Combo Personalizado"` tienen
  `ml` nulo **a propósito**.

Con `ml` dentro de `precios[]`, **elegir la talla en pantalla fija las dos cosas a la vez**
y desaparece toda posibilidad de que se desincronicen.

## 5. Diseño técnico

### 5.1 Backend (tres cambios pequeños, sin migración)

**a. `ml` en cada precio** — `perfume.repository.ts`, dentro de `resolverPrecios`:

```ts
presentacion: r.presentacion.nombre,
ml: r.presentacion.ml,          // ← nuevo: el número real de la talla
precio: Number(...),
```

Es aditivo: quien no lo lea sigue funcionando igual.

**b. `GET /creditos/totales`** — nuevo, junto al patrón que ya usa
`GET /ventas/totales`. Va **antes** de cualquier ruta con `:id` en el router.

```ts
{
  total_en_deuda: number;       // suma de saldos pendientes
  clientes_con_deuda: number;   // personas distintas que deben
  vencido: number;              // saldo de créditos pasados de fecha_limite
  creditos_vencidos: number;
  abonado_mes: number;          // abonos recibidos este mes
}
```

Hace falta un endpoint porque **"cuánto te deben" no se puede calcular con la página que
está en pantalla**: daría un número falso que cambia al pasar de página.

**c. Blindar el cupón canjeado** — dos cambios que se sostienen entre sí:

1. `liberarCodigoDeVenta` recibe un tercer parámetro `soloNoCanjeados`. Al **editar**
   (`venta.repository.ts:165`) se pasa `true`: los canjeados no se sueltan. Al **borrar**
   (`:199`) se deja como está: la venta ya no existe y el cupón debe volver a su dueño.
2. `updateVenta` **rechaza** el cambio: si la venta tiene un código `canjeado` y llega uno
   distinto (o ninguno), responde *"Esta venta ya canjeó el cupón X. Para cambiarlo hay
   que eliminar la venta."*

El punto 2 no es redundante: el bloqueo del campo en pantalla es comodidad, **la regla
tiene que vivir en el servidor**, que es lo único que no se puede saltar.

> **Cuidado con el mes**: los cortes se construyen con `new Date(Date.UTC(a, m, 1))`,
> nunca con `setHours(0,0,0,0)` — las columnas `@db.Date` se leen como medianoche **UTC** y
> en Colombia el día 1 se quedaría fuera del mes.

> **Descartado**: se había propuesto un `ingresos_mes_anterior` para comparar dentro de la
> caja. Kevin lo movió a **Reportes**, en su propia tanda: ahí ya hay gráficos y es la
> pantalla donde uno va a *analizar*, no a *registrar*. Comparar meses dentro de una caja
> de la pantalla de registro es meter análisis donde estorba.

### 5.2 Las piezas compartidas nuevas — `pages/dashboard/pedido/`

**`lineasPedido.ts`** — reemplaza y amplía `creditoLineas.ts` (que hoy vive suelto en
`dashboard/`). Funciones **puras**, sin estado ni peticiones:

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

Conserva `precioLista`, `precioUnitario`, `itemsDeLineas`, `articulosDeLineas`,
`presentacionResumen` y `descuentoDeCupon`, y suma `subtotalDeLineas` y
`unidadesDeLineas`.

Los productos sin talla (una gorra) llevan `presentacion` y `ml` en `null`: no todo lo que
se vende tiene mililitros.

### 5.2b La maquetación de la página (decidido el 2026-08-02)

Kevin señaló que las cajas de métricas *"metidas dentro del contenedor de la tabla junto a
todos los botones se ve pésimo y nada similar a un dashboard serio"*. Tiene razón, y la
causa es concreta:

**Hoy todo vive dentro de una sola tarjeta blanca** (`Section`): el título, los botones de
exportar/importar/crear, las tres cajas, un párrafo de ayuda, el buscador y la tabla.
Siete cosas distintas apiladas en el mismo plano, sin jerarquía.

Y hay un detalle que lo empeora: `StatCard` usa `bg-background` (marfil) **dentro** de una
tarjeta `bg-card` (blanca). Está al revés — las cajas parecen huecos hundidos en vez de
elementos que resaltan.

**Piezas nuevas en `dashboard/ui.tsx`** (opt-in, como todo desde la Ola 1: las pestañas que
no las usen se ven igual que hoy):

- **`EncabezadoPagina`** — título y acciones **fuera** de la tarjeta, en el plano de la
  página.
- **`FranjaMetricas`** — rejilla responsiva (`grid`, no `flex-wrap`) para que las cajas
  queden del mismo ancho en vez de con sobras al final de la fila.
- **`StatCard`** gana una `nota` opcional (la línea de apoyo) y pasa a `bg-card`, porque
  ahora vive sobre el fondo marfil de la página.

```
Ventas                    [Exportar] [Importar] [+ Registrar venta]

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ INGRESOS     │  │ TOTAL        │  │ UNIDADES     │
│ DE AGOSTO    │  │ EN DINERO    │  │ VENDIDAS     │
│ $1.240.000   │  │ $18.900.000  │  │ 538          │
│ incluye      │  │ histórico    │  │              │
│ $120.000 de  │  │              │  │              │
│ abonos       │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘

┌─────────────────────────────────────────────────────────┐
│  🔎 Buscar…                            261 registros    │
│  ┌───┬─────────┬──────────┬────────┬─────────┐          │
│  │ # │ DIA     │ PERSONA  │ VALOR  │ PAGO    │          │
│  └───┴─────────┴──────────┴────────┴─────────┘          │
└─────────────────────────────────────────────────────────┘
```

La tarjeta blanca queda conteniendo **solo la tabla**, que es lo que debe contener.

**`ArmadorPedido.tsx`** — el buscador, la lista de líneas y el interruptor de combo.

```
  [🔎 Buscar y agregar producto…                              ]
  ┌──────────────────────────────────────────────────────────┐
  │ 1 Million      [30 ml ▾] [2]  sin −10% ☐      $120.000 ✕ │
  │ Khamrah        [100 ml▾] [1]                   $76.000 ✕ │
  └──────────────────────────────────────────────────────────┘
                                                  3 unidades
  ☐ Aplicar precio de combo (mayoreo)
```

Props (lo que cambia entre las dos pantallas es **opcional**, igual que en `SmartTable`):

| Prop | Para qué |
|---|---|
| `lineas`, `onChange` | El estado vive en el formulario, no aquí |
| `catalogo` | Perfumes con sus `precios[]` |
| `combos`, `aplicarCombo`, `onAplicarCombo` | Solo Créditos muestra el interruptor |
| `permitirSinDescuento` | Solo Créditos: el check por línea |
| `onCrearProducto` | Solo Ventas: "+ Crear producto nuevo" al vuelo |

**Comportamiento**: agregar un producto que ya está **con la misma talla** suma unidades;
cambiar la talla de una línea hasta dejarla idéntica a otra **fusiona las dos**. Es lo que
`VentasTab` ya hace bien hoy y hay que conservar: sin eso, la misma referencia aparece
dos veces y el conteo miente.

**`ResumenPedido.tsx`** — el bloque de totales.

```
  Productos (3)                                  $196.000
  Precio de combo                                −$21.000
  Cupón CP-7XK2M9 (−10%)                         −$17.500
  ──────────────────────────────────────────────────────
  Sugerido                                       $157.500
```

Las líneas que valen cero **no se pintan**: un resumen con "Combo −$0" es ruido.

### 5.3 Ventas

El modal se parte en tres bloques con `BloqueCampos` (la pieza de la Ola 1):

```
REGISTRAR VENTA

  ¿CUÁNDO Y A QUIÉN?
  Día *                         Persona *
  [2026-08-02]                  [Andrés Rojas____________]
  Cliente enlazado (opcional)
  [🔎 — Sin cliente —                                   ▾]

  ¿QUÉ SE LLEVÓ?
  [🔎 Buscar y agregar producto…                         ]
  ┌──────────────────────────────────────────────────────┐
  │ 1 Million          [30 ml ▾]  [2]         $120.000 ✕ │
  │ Khamrah            [100 ml▾]  [1]          $76.000 ✕ │
  └──────────────────────────────────────────────────────┘
                                              3 unidades

  ¿CUÁNTO Y CÓMO?
  Productos (3)                                  $196.000
  Cupón CP-7XK2M9 (−10%)                         −$17.500
  ──────────────────────────────────────────────────────
  Sugerido                                       $178.500

  Valor de la venta (COP) *       Estado de pago
  [ 178.500 ]  ↩ usar el sugerido [ Pagada        ▾]

  Código de descuento
  [ CP-7XK2M9 ] [Validar]   ✓ válido, de Andrés Rojas

  Notas
  [____________________________________________________]
```

- El campo **"Cantidad" desaparece** (`VentasTab.tsx:512`). Las unidades salen de las
  líneas y se muestran bajo ellas.
- **El descuento de la página y el precio de combo se aplican solos** en el sugerido: al
  contado el combo es política de precios permanente, no una promo.
- **El cupón ya canjeado sale bloqueado al editar**, con el código a la vista y la nota
  de que para cambiarlo hay que eliminar la venta:

```
  Código de descuento
  [ CP-7XK2M9                                      ] 🔒
  Ya canjeado. Para cambiarlo hay que eliminar la venta y volver a registrarla.
```

- **Se conserva intacto el guardarraíl anti doble descuento**: al editar una venta cuyo
  código no cambió, el valor guardado ya trae el descuento y en vez de la sugerencia sale
  el aviso de "no lo vuelvas a descontar". Es la regla que protege las ~261 ventas
  históricas, todas registradas con el descuento ya aplicado a mano.

**Métricas**: ver §5.2b. El contenido de las tres cajas **no cambia**; lo que cambia es
dónde viven y cómo se ven. Lo único que se corrige del texto es la etiqueta larguísima
metida dentro del título (*"Ingresos este mes (incluye $120.000 de créditos)"*): el título
queda en `INGRESOS DE AGOSTO` y el paréntesis baja a la línea de apoyo.

### 5.4 Créditos

Mismo armador y mismo resumen. Conserva lo suyo: fecha límite, interruptor de combo
apagado por defecto, check "sin −X%" por línea, y el aviso de que el cupón se consume al
instante.

**Métricas que hoy no existen**, con la misma maquetación de §5.2b:

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ TE DEBEN HOY │  │ VENCIDO      │  │ ABONADO      │
│              │  │              │  │ ESTE MES     │
│ $541.250     │  │ $170.000     │  │ $100.000     │
│ de 4         │  │ 1 crédito    │  │              │
│ clientes     │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
```

Abrir la pantalla de las deudas y no ver cuánto te deben es la carencia más grande de las
dos pestañas: hoy toca sumarlo a mano.

### 5.5 Los fallos silenciosos

- `handleDelete` de las dos (`VentasTab.tsx:246`, `CreditosTab.tsx:273`) mira `res.ok` y
  avisa con el mensaje del servidor.
- Los tres `alert()` (enlazar perfumes, registrar abono, guardar cupo) pasan a avisos.
- `load()` de las dos se envuelve en `try/catch/finally`: al fallar, mensaje con botón de
  reintentar en vez de una lista vacía que parece "no tienes ventas".

### 5.6 Cómo quedan los archivos

| Archivo | Antes | Después |
|---|---|---|
| `tabs/VentasTab.tsx` | 607 | ~250 (lista, métricas y estado) |
| `tabs/VentaForm.tsx` | — | ~300 (el modal) |
| `tabs/CreditosTab.tsx` | 565 | ~280 |
| `tabs/CreditoForm.tsx` | — | ~280 |
| `pedido/ArmadorPedido.tsx` | — | ~180 |
| `pedido/ResumenPedido.tsx` | — | ~80 |
| `pedido/lineasPedido.ts` | 59 (`creditoLineas.ts`) | ~110 |

Ninguno pasa de ~500.

## 6. Cómo se verifica

Como en la Ola 1: sin suite de pruebas en el frontend, la verificación es `npm run build`
+ `npm run lint` (comprobando que el número de avisos **no sube**) y una pasada real por
el navegador con un admin temporal en la base local, que se borra al terminar.

**Toca dinero, así que las pruebas se hacen con números concretos y se comprueban contra
la base**:

1. Venta de 2× 30 ml + 1× 100 ml → el sugerido cuadra con la lista de precios, y las
   unidades muestran 3 sin haberlas tecleado.
2. Cambiar la talla de una línea hasta dejarla igual a otra → **se fusionan**, no se
   duplican.
3. Un producto sin talla (gorra) → entra con `ml` nulo y no rompe el cálculo.
4. Cupón válido → el resumen muestra el desglose y "usar el sugerido" pone el valor final.
5. **Editar** esa misma venta sin cambiar el código → sale el aviso de "ya tiene este
   cupón", **no** la sugerencia. (Es el guardarraíl que evita descontar dos veces.)
6. La venta guardada tiene las **líneas con su talla** correctas en `venta_perfume`, y el
   inventario descontó lo que debía.
6b. **El cupón canjeado no se puede revivir**: abrir esa venta y borrar el código del
   campo no debe poder hacerse en pantalla, y mandando la petición a mano (saltándose la
   pantalla) el servidor la rechaza. Se comprueba en la base que el código sigue
   `canjeado` y enlazado. Después, **borrar** la venta sí lo devuelve a `activo`.
7. Crédito con las mismas líneas + combo encendido → la deuda baja por el ahorro.
8. Borrar una venta con el servidor rechazando → **avisa** (hoy no dice nada).
9. Los totales de Créditos cuadran con la suma a mano de los saldos.
10. En 390px: las dos pestañas en tarjeta, y el formulario se puede llenar con el pulgar.
11. **No regresión**: Perfumes, Combos y Clasificaciones siguen igual.

## 7. Riesgos

| Riesgo | Cómo se contiene |
|---|---|
| Tocar el formulario que registra la plata | El formato que se manda al servidor **no cambia**; solo cambia cómo se arma en pantalla. Las pruebas 6 y 7 lo comprueban contra la base |
| Perder el guardarraíl anti doble descuento al mover código | Tiene prueba propia (la 5) y se migra tal cual, sin "mejorarlo" |
| `creditoLineas.ts` lo importan varias pantallas | Se mueve a `pedido/lineasPedido.ts` y se actualizan los imports en el mismo paso; TypeScript no deja pasar uno olvidado |
| Que el armador compartido acabe lleno de excepciones | Lo que difiere entre las dos pantallas entra como prop **opcional**, misma regla que `SmartTable` en la Ola 1 |

## 8. Deploy

**El backend cambia** (tres archivos), así que hay que compilarlo, no solo el frontend.
Sin migraciones y sin dependencias nuevas.
