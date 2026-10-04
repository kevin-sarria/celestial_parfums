# Empaque por línea, talla y combo — diseño

**Fecha:** 2026-10-04 · **Decidido con el dueño en la conversación del 2026-10-03/04.**
Primer proyecto del rediseño del núcleo de producto (ver "Orden" al final).

## El problema

El dueño: *"no tenerlo como actualmente que sí o sí hasta con los 1.1 les descuenta la bolsa de
organza y el perfumero; eso debería ser configurable por combos y así, no por categorías completas
o en general"*.

Hoy hay **dos mecanismos** que reparten lo mismo (bolsa y perfumero), y no se hablan:

| Mecanismo | Dónde vive | Se ve en la venta |
|---|---|---|
| Accesorios de la receta del tamaño (`formula_accesorios`), con excepción por perfume y talla (`perfume_presentacion.accesorios`) | Se descuentan por debajo al vender **y al armar un lote** | No |
| Kit del combo (`combo_contenido`), sugerido como líneas de regalo | `KitDelCombo.tsx` | Sí |

Medido en el respaldo de producción del 2026-09-30:

- Recetas: 30 ml y 100 ml llevan bolsa + perfumero; 75 ml, bolsa; 6 ml y 50 ml, nada.
- Hay 22 excepciones por perfume y talla, y **todas** son "1.1 de 100 ml sin nada".
- Los 4 combos se llaman "+ Obsequio", pero su kit está vacío.
- No existe ningún producto accesorio (`es_accesorio = 1`): la bolsa (insumo 8) y el perfumero
  (insumo 11, tipo envase) solo existen como materiales.

## Decisiones del dueño

| # | Pregunta | Elegido |
|---|---|---|
| 1 | ¿Quién decide el empaque? | **A**: cada línea trae un empaque por defecto; al vender viene marcado y se quita o se agrega |
| 2 | ¿Granularidad? | **A**: por **línea y talla** |
| 3 | ¿Combos? | **A**: el combo trae su empaque y **reemplaza** al de sus perfumes. Se configura libremente: bolsa y perfumero, solo perfumero, lo que el dueño quiera |
| 4 | ¿El cliente lo ve? | **A**: la tienda dice "Incluye …" según la talla o el combo |
| 5 | ¿Qué mecanismo queda? | **A**: el de **líneas de regalo** (productos accesorio). Desaparece el descuento por debajo |
| — | El obsequio de los combos | Es el perfumero recargable vacío (mero marketing) |

## Diseño

### Datos

- **Dos productos accesorio** (migración de datos): "Bolsa de organza" → insumo 8 y "Perfumero
  recargable 6 ml" → insumo 11. Ambos `tipo_producto = comprado`, `es_accesorio = true`,
  `publicado = false` y precio 0. Si el dueño quiere vender el perfumero aparte, le pone precio y
  lo publica: es el mismo producto, cobrado en vez de regalado. Se crean solo si no existe ya un
  accesorio ligado a ese insumo; los ids se buscan por insumo, no se quedan fijos en el código.
- **Tabla nueva `empaque_linea`**: `(linea, presentacion_id | null, perfume_id, cantidad)`, con
  unique en `(linea, presentacion_id, perfume_id)`.
  - `linea` es un ENUM: `contratipo`, `uno_uno`, `decant`, `botella_completa`, `producto`.
  - `botella_completa` usa `presentacion_id = null`: vale para cualquier botella entera.
  - `perfume_id` solo admite accesorios (`es_accesorio`); se valida en el servidor, igual que
    `combo_contenido`.
- **La línea de una venta** sale de `lineaDe()` (`perfume.mapeo.ts`), más la talla:
  - un original en su botella completa → `botella_completa`;
  - un original en una talla menor → `decant`.

  No se agrega ningún campo nuevo al perfume.
- **Siembra inicial**, que replica lo de hoy:
  - contratipo 30 ml y 100 ml → bolsa ×1 + perfumero ×1; contratipo 75 ml → bolsa ×1;
  - el resto, vacío;
  - los 4 combos con kit vacío → perfumero ×1 como punto de partida.
- **Se retiran**: `formula_accesorios` (tras sembrar desde ella) y la columna
  `perfume_presentacion.accesorios`. Esto **no toca el frasco propio por talla**
  (`envase_insumo_id`), que sigue igual.

### Una sola cuenta: `empaqueDelPedido`

Función pura. Recibe:
- las líneas del pedido: perfume, talla, cantidad y lo regalado;
- los combos detectados (los mismos de `useComboDetector` / `precioPedido.ts`);
- la configuración de empaque.

Devuelve, por accesorio, cuánto le toca al pedido:
- **Perfumes que caen en un combo:** su empaque no cuenta; cuenta el kit del combo × las veces
  que se arma.
- **El resto:** el empaque de su línea y talla × la cantidad.

Igual que la detección de combos, vive **en el servidor**
(`backend/src/permisos/precioPedido.ts` o un archivo hermano) **y en el panel**, con una copia
documentada en ambos lados y pruebas en los dos. `kitPendiente` se absorbe en esta función: el kit
pasa a ser un caso de ella.

### Al vender (Ventas y Créditos)

- Debajo del pedido sale el bloque **"Este pedido lleva"**: cada accesorio con su cantidad y una
  casilla **marcada**. Reemplaza a `KitDelCombo.tsx`.
- Lo ya regalado a mano en las líneas cuenta como puesto (la regla actual de `kitPendiente`).
- Al guardar, lo que sigue marcado entra como **líneas de regalo**, fusionadas con las existentes
  (`agregarKit`). Desmarcar = no lleva.
- **Personal** (`controlPrecio.ts`): un regalo de accesorios **hasta** lo que da
  `empaqueDelPedido` no es descuento. Si se regala más, o se regala un perfume, sigue siendo un
  descuento que espera la aprobación del dueño.

- Las líneas de accesorio **no cuentan como perfumes**: ni para armar combos, ni para
  `cantidad_perfumes`, ni para sellos. Ya es así con el kit; se verifica con una prueba, porque
  ahora entran en casi todas las ventas.

### Inventario

- `recetaDe` (venta de un contratipo) deja de agregar accesorios: los descuentan las líneas de
  regalo, como cualquier producto comprado.
- Armar un lote (`accesoriosDeLote`, `inventario.maceracion.ts`, producciones) deja de descontar
  accesorios. **El empaque sale solo al vender.**
- `accesoriosSobrantes.ts` y el aviso "Corregir" de las ventas de 1.1 se revisan: si ya no hay
  lotes que cobren accesorios, el aviso muere solo cuando no queden pendientes.
- **Cotizaciones de mayoreo**: los accesorios por defecto de una talla salen del empaque
  `contratipo` de esa talla.
- **Historial**: las ventas, lotes y movimientos pasados **no se reescriben** (cifras congeladas).

### Pantallas

- **Catálogo → Empaque** (nueva, solo del dueño): una sección por línea, una fila por talla de esa
  línea, y en cada fila los accesorios con su cantidad (agregar, quitar, ±). En el celular, una
  tarjeta por línea. Arriba, una frase: "Lo que se regala con cada venta. Un combo manda sobre
  esto: se configura en su ficha".
- **Ficha de combo**: el editor de kit de siempre (`KitDelComboEditor.tsx`), ahora con los
  accesorios disponibles.
- **Ficha de perfume**: desaparecen los "accesorios por talla" de `FrascosPorTalla.tsx`; queda solo
  el frasco.
- **Tienda**: en la ficha, bajo la talla elegida, "Incluye bolsa de organza y perfumero recargable
  6 ml" (sin línea si no incluye nada). En el combo, lo que trae su kit. Viaja calculado desde el
  servidor (`incluye` por talla en `mapPerfume`) para que la tienda no repita la regla.

### Permisos

- La pantalla Empaque y su API: `requireAdmin`.
- La configuración de empaque que necesita el formulario de venta se lee con `ventas.registrar`
  o `creditos.registrar`.

## Pruebas

- **Unidad**, en los dos lados: `empaqueDelPedido`.
  - Un contratipo de 100 ml lleva bolsa y perfumero.
  - Un 1.1 no lleva nada.
  - Un trío en combo lleva solo el kit.
  - Lo ya regalado se descuenta de lo pendiente.
- **Base de datos:**
  - Vender un contratipo de 100 ml con las líneas de regalo descuenta la bolsa y el perfumero una
    sola vez.
  - Armar un lote ya no los descuenta.
  - La siembra crea los accesorios una sola vez (correrla dos veces no duplica nada).
- **Servidor, personal:**
  - Regalar el empaque que toca no crea solicitud.
  - Regalar de más sí la crea.
- **e2e:**
  - El bloque "Este pedido lleva" sale marcado y desmarcarlo no lo agrega.
  - La pantalla Empaque guarda.
  - La tienda muestra "Incluye …".

## Orden del rediseño (acordado)

1. **Este**: empaque por línea, talla y combo.
2. Apartado de precios sugeridos (margen mínimo, sugerido por talla, aplicarlo a todos los decants
   sin precio).
3. El panel organizado por línea (Contratipos · 1.1 · Originales · Productos).
4. Alertas según la velocidad de venta (opción C).
