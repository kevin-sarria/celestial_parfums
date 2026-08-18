# Regalos y extras en la venta: líneas con parte gratis + kit del combo

**Fecha**: 2026-08-18 · **Decidido con el dueño**: construirlo en dos olas (opción 1 de las tres
que se plantearon).
**Estado**: diseño aprobado por el dueño, sección por sección. Pendiente: implementación.

## El problema, medido

Hoy, cuando el dueño regala o vende aparte un accesorio (un perfumero recargable, una bolsa,
una tarjeta del negocio) dentro de una venta, no hay dónde ponerlo:

- Si lo escribe en "Notas", es texto libre: **no descuenta inventario y no tiene costo**. Pasó de
  verdad — una venta quedó con la nota *"Adicioné 1 perfumero recargable vacío"* y cero unidades
  de ese insumo salieron del sistema.
- La única forma de que SÍ descuente es crearle una ficha de producto (`tipo_producto:
  comprado`) y venderlo como una línea más — el rodeo que se usó para el primer perfumero de
  regalo (sesión del 2026-08-17). Funciona, pero **para poder decir "1 de estos dos va gratis y
  el otro se cobra" no había manera**: la única pieza que existía (`regalo_automatico` +
  botón "+ Agregar regalo") crea una línea aparte, fija en 1, que no se puede subir ni fusionar
  con una línea agregada a mano — buscar el mismo producto una segunda vez simplemente sube la
  cantidad de la OTRA línea, y el resultado es un número que no se puede separar en "regalo" y
  "cobrado".

Consecuencia de plata: lo regalado **no pesa en el costo de mercancía de la venta**, así que la
ganancia real del mes sale inflada exactamente en lo que cuestan los regalos — el mismo tipo de
mentira silenciosa que ya se corrigió para el producto terminado (2026-08-14).

## Alcance y las dos olas

Se descompone en dos olas (Viabilidad: cimientos de bajo riesgo primero, la pieza compleja
después, con el dueño opinando entre medio):

- **Ola 1 — el campo "Regalo" en cualquier línea + un buscador de accesorios en Ventas.** Ya
  resuelve el problema medido arriba: cualquier regalo o venta de un accesorio, en cualquier
  venta, con costo real. Bajo riesgo: dos columnas nuevas y una pantalla que ya existe, ganando
  un campo más.
- **Ola 2 — el "kit" del combo.** Construida ENCIMA de la ola 1. Le ahorra al dueño escribir a
  mano, cada vez, los mismos accesorios que trae un combo. No se empieza por aquí: primero se
  valida que la ola 1 se sienta bien en el día a día.

Este documento diseña las dos, pero **se implementan y se prueban por separado**.

## Modelo de datos

Dos columnas nuevas (ola 1) y una tabla nueva (ola 2). Ninguna toca una fila existente — todas
nacen con el valor que ya es cierto hoy.

### Ola 1

- **`perfumes.es_accesorio`** (`Boolean`, default `false`). Marca que esa ficha no es una
  fragancia — es un perfumero, una bolsa, una tarjeta. Sirve para separarla del buscador
  principal (212 fragancias) y para que nunca se cuele en un reporte de "fragancias vendidas".
  No reemplaza `tipo_producto`: sigue siendo `comprado` (se compra hecho, se revende o se
  regala, sin receta) — `es_accesorio` es ortogonal, dice de qué CLASE de producto se trata, no
  cómo se abastece.
- **`venta_perfume.regalo`** (`Int`, default `0`, `@db.UnsignedSmallInt`). Cuántas unidades de
  **esa línea** van gratis. Aplica igual a un perfume que a un accesorio — es un solo campo para
  los dos casos, confirmado con el dueño (sirve también para una promoción tipo "el 4to gratis"
  sobre la fragancia misma, no solo sobre accesorios).
  - **Candado**: `regalo <= cantidad`, validado en el esquema del backend (Zod) — no basta con
    que el formulario lo impida, porque una llamada directa a la API podría colar un regalo
    mayor que la cantidad.
  - Con `regalo = 0` (el valor por defecto) el comportamiento es **idéntico** al de hoy: es la
    "capacidad apagada por defecto" que exige el departamento de Desarrollo.

Migración nueva (una sola, con las dos columnas — se nombra con la fecha del día en que se
implemente, siguiendo la convención ya usada en el proyecto). Ambas columnas nacen con su
default; ninguna venta ni ficha existente cambia de significado.

**Regla adicional para no dejarla ambigua**: `es_accesorio = true` solo tiene sentido en un
perfume `tipo_producto = comprado` (se compra hecho, no tiene receta ni talla). El backend lo
valida al guardar la ficha — un `fabricado` o `fraccionado` no puede marcarse accesorio.

### Ola 2

- **`combo_contenido`** (tabla nueva): `id`, `combo_id` (FK a `combos`, `onDelete: Cascade`),
  `perfume_id` (FK a `perfumes`, debe cumplir `es_accesorio = true` — se valida en el backend,
  no con una constraint de base que Prisma no expresa fácil), `cantidad` (`Int`,
  `@db.UnsignedSmallInt`).
  - Una fila por accesorio que trae el combo. "3 de 30 ml" podría tener tres filas: perfumero
    ×1, bolsa ×1, tarjeta ×1.
  - **Sin variantes** (bolsa grande vs. 3 chicas): se guarda **una sola combinación por
    defecto**. El dueño ajusta la línea a mano en la venta cuando el cliente pide otra — la ola
    1 ya lo permite sin construir nada más. Ver "Decisiones tomadas" más abajo, por qué se
    descartó modelar variantes.
  - Borrar un combo borra su contenido en cascada (no tiene sentido sin el combo). Borrar un
    accesorio (`perfumes` con `es_accesorio = true`) que esté en algún `combo_contenido` debe
    **rechazarse**, mismo criterio que ya existe para un insumo en uso — el mensaje dice en qué
    combos está.

## Motor de cobro y descuento

Una sola regla, para toda línea (perfume o accesorio):

> **Se cobra** `precio_unitario × (cantidad − regalo)`.
> **Se descuenta del inventario** la `cantidad` completa, regalada o no — el material salió de
> la bodega igual.

Esto es lo que hace que el costo de mercancía de la venta (y por lo tanto la ganancia del mes)
quede correcto sin ningún reporte nuevo: `consumirPorVenta` ya congela el costo de cada línea por
su `cantidad`; no cambia. Lo único que cambia es `subtotalDeLineas`/`precioUnitario`
(`frontend/src/pages/dashboard/pedido/lineasPedido.ts`), que hoy multiplican por `cantidad` a
secas y pasan a multiplicar por `cantidad − regalo`.

**Se retira** el campo `regalo: boolean` de `LineaPedido` (el hack de la sesión anterior: una
línea aparte, fija en 1, que no se fusiona con las demás) y con él:

- El botón "+ Agregar regalo" / el aviso "Este pedido califica para regalar…" en `VentaForm.tsx`.
- El bloqueo de cantidad en `ArmadorPedido.tsx` para líneas regalo.
- Los guardas `!l.regalo` que evitaban que una línea regalo se fusionara con una normal — ya no
  hacen falta: con `regalo` como número en la MISMA línea, buscar el mismo producto dos veces
  vuelve a fusionar de forma simple (sube `cantidad`), como cualquier otro producto.

## Pantalla de Ventas

**Dos buscadores en "¿Qué se llevó?"**, uno al lado del otro:

- El de siempre: perfumes (`es_accesorio = false`).
- Uno nuevo: accesorios (`es_accesorio = true`), mismo componente (`BuscadorSelect`), mismo
  comportamiento — busca, elige, se agrega.

Los dos alimentan la MISMA lista de líneas. **Cada línea (de cualquiera de los dos buscadores)
gana un campo "Regalo"**, junto a "Cantidad", con el candado de no poder pasarse. El precio de la
línea se recalcula solo con la fórmula de arriba.

Ejemplo real que motivó el diseño (venta de Edwin García, 2026-08-17): busca "Perfumero
Recargable" → línea con cantidad 1. Lo busca otra vez (o edita el número directo) → cantidad 2.
Pone Regalo: 1. Una sola línea, clara: 2 en total, 1 gratis (el del combo), 1 cobrado ($5.000).

## El kit del combo (ola 2)

**Dónde se configura**: en la pantalla de Combos que ya existe. Cada combo gana una sección
nueva — "¿Qué trae este combo por defecto?" — con el mismo buscador de accesorios de Ventas y un
campo de cantidad por cada uno agregado. Se guarda en `combo_contenido`.

**Cómo se sugiere**: `detectarCombos` (el motor que ya existe y calcula el precio de combo) ya
sabe CUÁNDO un pedido califica. Cuando califica y ese combo tiene contenido configurado, aparece
un aviso — *"Este combo trae: 1 perfumero, 1 bolsa, 1 tarjeta → Agregar"* — con un botón. Un clic
agrega esas líneas, cada una con `regalo = cantidad` (100% gratis). El dueño las edita después
como cualquier línea: cambia cantidades, quita una, agrega la variante que pidió el cliente.

**Si el accesorio del kit está apagado** (`perfumes.publicado = false` o `activo` según el
insumo de fondo), esa línea del kit simplemente no se sugiere — mismo criterio que el resto del
catálogo: un producto apagado no aparece en ningún buscador de venta.

**Si ya había una línea manual del mismo accesorio** (por ejemplo, ya había puesto una bolsa a
mano antes de que apareciera el aviso), el clic la fusiona (sube `cantidad` y `regalo` en la
misma línea) en vez de crear una segunda — mismo mecanismo de fusión de toda la pantalla, sin
caso especial.

**Combos distintos en la misma venta**: sigue la decisión ya tomada — no se intenta detectar ni
sugerir dos kits a la vez. El dueño separa esas ventas él, como excepción rara (confirmado con
él: es infrecuente y automatizarlo cuesta más de lo que ahorra).

## Decisiones tomadas con el dueño (resumen de la conversación de diseño)

1. **El campo "regalo" es genérico** (perfume o accesorio), no exclusivo de accesorios —
   confirmado explícitamente porque puede hacer falta para promociones sobre la fragancia misma.
2. **Se reusa el patrón `Perfume` + `tipo_producto: comprado`** para los accesorios (opción 1 de
   3 presentadas), en vez de una tabla `venta_extra` paralela — reaprovecha el motor de consumo,
   reversión y congelado de costo que ya existe y está probado, en vez de construir uno nuevo
   desde cero para lo mismo.
3. **Sin modelar variantes del contenido de un combo** (bolsa grande vs. 3 chicas vs. mixta): se
   guarda una combinación por defecto y se ajusta a mano en la venta cuando aplica. Construir un
   selector de variantes es trabajo real para un caso que el dueño mismo describe como "depende
   del cliente" — con la ola 1 ya resuelto (editar cualquier línea es igual de fácil sin importar
   si viene del kit o se agregó a mano), no hay ahorro adicional que justifique el selector.
4. **No se detectan ni sugieren varios combos distintos en la misma venta.** Si pasa, el dueño
   sigue separando esas ventas él mismo, como ya lo hacía antes de este cambio.
5. **Se retira por completo `regalo_automatico`** (perfumes.regalo_automatico, el botón "+
   Agregar regalo"): nunca llegó a producción, así que no hay dato real que migrar. El kit del
   combo lo reemplaza y hace más de lo que ese campo hacía.
6. **Los reportes no necesitan una pieza nueva.** El costo de un regalo ya entra al costo de
   mercancía de la venta (la misma cuenta de siempre); una cifra aparte de "cuánto se regaló este
   mes" queda para una vuelta futura, si hace falta.

## Pruebas que tiene que dejar

Ola de base (`*.bd.test.ts`), escritas desde la regla — con datos reales, contando antes y
después (QA):

1. Una línea con `cantidad: 2, regalo: 1` cobra el precio de 1 unidad, y descuenta 2 del
   inventario del insumo.
2. `regalo` mayor que `cantidad` se rechaza en el servidor (no solo en el formulario).
3. Buscar el mismo accesorio dos veces en una venta fusiona en una sola línea (sube `cantidad`),
   nunca crea una segunda.
4. Borrar una venta con líneas regalo devuelve el inventario **exacto** (perfume y accesorios
   por igual) — contado en SQL, no en pantalla.
5. Un combo con contenido configurado, detectado en una venta: el botón agrega las líneas
   correctas, cada una con `regalo = cantidad`.
6. La misma venta, con una línea de ese accesorio ya puesta a mano antes de aceptar el kit: el
   clic fusiona en vez de duplicar.
7. Borrar un accesorio que está en el contenido de un combo se rechaza, con el mensaje de en qué
   combo está (mismo patrón que un insumo en uso).
8. **No regresión**: abrir Créditos (comparte `ArmadorPedido`) y confirmar que se ve y funciona
   igual — su casilla "sin descuento" sigue intacta y el campo Regalo aparece igual ahí (créditos
   también puede regalar algo, no hay motivo para que sea distinto).
9. Reporte de ganancia del mes: una venta con un accesorio 100% regalado resta su costo real de
   la ganancia, sin sumar nada a los ingresos por esa línea.

## Lo que NO cambia

- El precio de combo en sí (`detectarCombos`, la política de mayoreo automático) — el kit se
  monta ENCIMA de esa detección, no la toca.
- Las ventas históricas: `regalo` nace en 0 para todas, que es exactamente lo que representan
  (nada se regaló, según lo que el sistema sabía hasta hoy).
- El costeo de cotizaciones B2B y el motor de `costeoCotizacion.ts` — ese módulo ya maneja sus
  propios "accesorios" con `alcance: pedido/unidad` para cotizar, y es un mundo aparte (nunca
  toca inventario real). No se tocan ni se fusionan los dos sistemas.
