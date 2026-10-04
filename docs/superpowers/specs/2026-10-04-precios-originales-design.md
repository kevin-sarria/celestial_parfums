# Precios sugeridos de los originales — diseño

**Fecha:** 2026-10-04 · Proyecto 2 del rediseño del núcleo. Aprobado por el dueño en la conversación.

## El problema

El dueño: *"precios que debería recomendármelos dependiendo de si configuro que quiero ganarme un
mínimo de un 30 % o más; aún le faltan muchas ayudas a la página para que me facilite el trabajo de
sugerirme precios aproximados"*. Los originales cambian mucho de precio de uno a otro, y muchos
decants están sin precio y por eso escondidos de la tienda (2026-10-03). A los contratipos no les
hace falta: el 90 % comparte precio de lista.

## Decisiones del dueño

| # | Pregunta | Elegido |
|---|---|---|
| 1 | ¿Cómo se elige cuánto ganar? | **A** por defecto: un selector en la pantalla, cada vez. Con espacio para **B**: un original puede guardar su propia meta en un caso puntual |
| 2 | ¿Qué significa "30 %"? | **A**: 30 % del **precio de venta** (margen). Precio = costo ÷ (1 − 30 %) |
| 3 | ¿Qué productos entran? | **A**: solo los originales (decants y botella completa) |
| — | Redondeo | Al **$1.000 más cercano** |
| — | La meta | En porcentaje o en **pesos por unidad** (*"habrá casos en que por ganarme al cliente me ganaré 10 mil pesos en un producto"*) |

## Diseño

- **Pestaña Catálogo → Precios de originales**, solo del dueño.
- **Selector arriba:** "Quiero ganar [%] / [$]" y un valor. Se recuerda en el navegador (`localStorage`):
  es una comodidad, no un dato del negocio.
- **Por original**, una fila por talla con:
  - el **costo**, con su desglose;
  - el precio actual y lo que deja (en rojo si queda por debajo de la meta);
  - el precio sugerido y una casilla.
- **El costo** es el mismo que descuenta la venta (`inventario.consumoVenta.ts`):
  - líquido: `mlQueSalenDeLaBotella(ml, ml_botella)` × costo por ml de la botella;
  - merma de trasvase: va incluida en esa cuenta y se muestra aparte;
  - frasco del decant: el propio de la talla y, si no tiene, el de la receta del tamaño (la
    botella completa no gasta frasco);
  - empaque: lo de `empaque_linea` para `decant`/`botella_completa`, a costo del material del
    accesorio.

  Lo calcula el servidor (`GET /api/precios-originales`).
- **Sugerido:**
  - en porcentaje, `costo / (1 − p/100)`, con p entre 1 y 90;
  - en pesos, `costo + v`.

  Siempre se redondea a $1.000. Sin costo (botella sin precio de compra) no se sugiere nada.
- **Meta propia (B):** columnas `perfumes.meta_ganancia_tipo` (`porcentaje` | `pesos`, null =
  usa la de la pantalla) y `perfumes.meta_ganancia_valor`. Se ve como una etiqueta en el original,
  se pone y se quita con `PATCH /api/precios-originales/:id/meta`.
- **Aplicar:** "Poner el sugerido a los marcados" o "Ponerle precio a todos los que no tienen".
  Antes de guardar se confirma cuántos cambian. `PATCH /api/precios-originales/precios` escribe
  `perfume_presentacion.precio` (el precio propio de esa talla), limpia la caché del catálogo y
  devuelve la lista nueva. Los decants que tenían $0 aparecen solos en la tienda (opción B del
  2026-10-02).
- **Permisos:** todo `requireAdmin` (es costo y margen).

## Pruebas

- **Unidad:** el sugerido en % y en $, el redondeo, y que sin costo no se sugiere.
- **Base de datos:**
  - el costo de un decant = líquido con merma + frasco + empaque;
  - la botella completa no lleva merma ni frasco;
  - aplicar precios escribe el precio propio, y el decant deja de estar escondido.
- **e2e:** la pantalla sugiere con la meta general, una meta propia manda sobre ella, y "Ponerle
  precio a todos los que no tienen" lo guarda.

## Rediseño de la pantalla (2026-10-04, mismo día)

El dueño: *"no me gustó… hazla de nuevo pero ahora bien para que me facilite el trabajo y que no
se extienda infinitamente hacia abajo, imagínate cuando tenga más de 100 perfumes originales"*.
La primera versión era una tarjeta por original con todas sus tallas: defecto 13 de
`dashboard-interno-ux` (la lista que se ve bien solo porque hay pocos datos). Con 100 originales ×
4 tallas son 400 renglones seguidos.

Rehecha con el método de `dashboard-interno-ux`:

```
Precios de originales                                     (73 tallas)

 41 tallas sin precio  ·  no salen en la tienda     Quiero ganar [30] [% del precio ▾]
 6 por debajo de tu meta  ·  26 al día

┌──────────────────────────────────────────────────────────────────────────────┐
│ 🔎 Buscar…   [Todas | Sin precio 41 | Bajo tu meta 6]   [Poner el sugerido (41)]│
│ PERFUME · TALLA          TE CUESTA   PRECIO HOY ✎   GANAS        SUGERIDO        │
│ Khamrah Waha Original    $15.500     Sin precio     —            $22.000 [Usar] ⊙│
│ Decant 5 ml                                                                    │
│ …                                                                              │
│ Filas: 25 ▾                                                  ‹ 1 2 3 ›         │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Una fila por talla, paginada** (25 por página, buscador, orden y filtro por estado): la
  `SmartTable` de siempre, que además pone tope de alto y tarjetas en el celular.
- **Franja de métricas fuera de la tabla**: la principal es lo que cuesta ventas hoy (tallas sin
  precio); las demás, pequeñas. La meta general vive ahí.
- **Filtros rápidos** (Todas / Sin precio / Bajo tu meta) y **una acción principal** que aplica el
  sugerido a lo que muestra el filtro, con confirmación que dice cuántos cambian.
- **Por fila**: "Usar" pone el sugerido de esa talla de un toque; el precio se edita en la propia
  celda (Enter guarda, Esc cancela); el icono ⊙ abre la meta propia de ese perfume.
