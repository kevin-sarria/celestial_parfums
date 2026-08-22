# Historial de cambios (contexto, no pendientes)

Lo que ya está construido, en el orden en que se hizo. Se conserva **por el porqué**: explica cómo
se llegó al diseño actual. Nada de esta página es trabajo pendiente — para eso está
[`pendientes.md`](pendientes.md).

## Rediseño del dashboard — COMPLETO (3 olas, agosto 2026)

El dueño señaló 9 pantallas el 2026-08-01. Diseño y plan en `docs/superpowers/`.

- **Ola 1** — cimientos de `SmartTable` + Clasificaciones + Usuarios (rama
  `rediseno-dashboard-ola1`).
- **Ola 2** — Ventas y Créditos, que hacían lo mismo con dos implementaciones desalineadas. Se
  extrajo `pedido/` como pieza compartida. `VentasTab` pasó de 607 a 236 líneas y `CreditosTab` de
  565 a 313.
- **Ola 3** — Inventario, Proveedores, Insumos y precios, Costos de producción, Tamaños y fórmulas,
  más los tres Reportes con su selector de periodo (rama `rediseno-dashboard-ola2`).

**El rediseño está completo**; lo que queda son mejoras de fondo, no de forma. La maquetación
resultante y sus reglas están en [`diseno-ux.md`](diseno-ux.md).

## Inventario fase 2 — los 9 pasos (2026-08-01)

Orden acordado y ejecutado: (0) unificar tallas → (1) consumo por venta + ganancia real → (2) crear
producto al vuelo desde la venta → (3) tipos de producto → (4) cotizaciones B2B con la esencia del
perfume → (5) gráficos → (6) import/export de lo que falta.

**Los dos bloqueantes que había están resueltos**: la venta no guardaba la talla por producto
(hoy `venta_perfume` tiene `ml` propio) y las tres listas de tallas no coincidían (hoy se enlazan
por número, no por texto).

| Paso | Qué quedó |
|---|---|
| **1 — tallas en ml** | `presentaciones.ml` (número) + `formula_volumen_id`. La talla dejó de ser texto: el número sale del propio nombre con REGEXP y el enlace catálogo↔receta se hace POR NÚMERO. Probado con "30ml", "50 ml" y "100 ml". Creadas las recetas de 75 ml y 6 ml, y corregidas las feromonas del 100 ml (0.40 → 0.30) |
| **2 — líneas de venta** | `venta_perfume` con id propio, `ml` y UNIQUE(venta, perfume, ml); las 205 líneas existentes se conservaron. `createVentaSchema` acepta las DOS formas (`lineas[]` nueva y `perfume_ids[]` vieja) y `lineasDeVenta()` las normaliza. `ventas.presentacion` dejó de ser obligatorio: se DERIVA de las líneas. El formulario del dashboard pasó a ser un editor de líneas |
| **3 — la venta consume inventario** | `consumirPorVenta` + `ventas.costo_mercancia` + `ganancia_mes`. Verificado: 3× 30ml descontaron 45 ml de esencia, 42,9 de diluyente, 1,2 de sellador, 0,9 de feromonas y 3 envases; costo 27.768; ganancia 196.000 − 27.768 = 168.232. Al borrar, todo volvió exacto |
| **4 — crear producto al vuelo** | "+ Crear producto nuevo" en el buscador del formulario de venta, con un mini-form (nombre + precio). **Aroma y ocasión dejaron de ser obligatorios**: el catálogo ya no es solo perfumes (una gorra no tiene notas olfativas) y exigirlos frenaba el mostrador |
| **5 — tipos de producto** | `perfumes.tipo_producto` (fabricado/comprado/fraccionado) + `insumo_producto_id` + `ml_utiles`. Verificado: 1 gorra + 2 decants de 10 ml → gorra 20→19, botella 95→75, costo 144.320 |
| **6 — frasco y caja por perfume + talla** | `perfume_presentacion.envase_insumo_id` y `accesorios`. Lo definido ahí MANDA sobre la receta del tamaño. Verificado: dos perfumes de 100 ml con la misma esencia descontaron cada uno SU frasco |
| **7 — cotizaciones con la esencia real** | `LineasCotizacion` pasa `perfume.insumo_esencia_precio` como 4º parámetro. Verificado: 1 Million cuesta 5.488 y 1 Million Lucky 1.939 — casi el triple. En 500 unidades, 1,7 millones de diferencia que antes no se veían |
| **8 — gráficos** | `GraficoMeses.tsx` (barras apiladas, SVG/CSS puro, sin dependencias nuevas) + `GET /ventas/por-mes`. La paleta se validó con el script del design system: el iris de marca (#524276) FALLA como color de barra; los que pasan son #8661cc y #c78200 |
| **9 — import/export de todo** | `import/resto.ts` suma formulas (import+export) y producciones, cotizaciones, usuarios, blog y avisos. Verificado: los 24 exportadores responden 200; reimportar formulas actualizó las 5 recetas; producciones rechaza con su motivo |

## Estado de la base local (2026-08-01, histórico)

Se importó el dump real del servidor y se le aplicaron las migraciones pendientes. El export de
TablePlus venía **cortado** a mitad de la última fila de `ventas`; la copia reparada quedó en
`Documents\celestial_db_REPARADO_2026-08-01.sql`. A la venta 1267 (Esteban Madera) se le
completaron `pagada=1` y `user_id=NULL` a mano — si el dueño dice otra cosa, corregirla.

## Correcciones de UX que pidió el dueño (agosto 2026)

Cada una nació de una queja concreta suya. La regla que dejó cada una está en
[`diseno-ux.md`](diseno-ux.md); aquí queda el registro de qué se cambió.

- **Faltaba el botón de "Registrar llegada" en Inventario** — solo había salida y producción, y las
  compras vivían escondidas bajo "Proveedores". Los botones de Excel se bajaron a su propio menú:
  competían con las acciones reales.
- **Crear insumo al vuelo dentro de la compra** (`DetalleCompra.tsx`), primero en la lista del
  buscador (al final nadie ve que existe) y sin pedir precio.
- **Las fórmulas eran un párrafo corrido** ("esencia 15 · diluyente 14.3 · …") y pasaron a una
  rejilla de 4 casillas etiquetadas.
- **Las líneas de la compra llevan la etiqueta EN cada casilla** — antes estaban una sola vez en
  una fila de encabezado tipo tabla. Se maquetaron con `@container` en vez de `sm:`.
- **La maquetación de una pestaña** (encabezado fuera de la tarjeta, métricas en rejilla, tabla
  sola, botones dentro de la barra de `SmartTable`).
- **UNA PANTALLA, UNA TABLA**: el historial de lotes salió de Inventario a la pestaña
  `producciones`.
- **UNA sola pantalla de materiales**: "Insumos y precios" se eliminó y la absorbió Inventario.
- **El menú se partió en dos** (plata / operación) cuando "Ventas y créditos" llegó a 8 pestañas.
- **La barra de arriba quedó solo con la campana**; el respaldo bajó al menú lateral y su
  recordatorio pasó a ser una línea de notificación.
- **La lista de material bajo mínimo dejó de pintarse entera** (55 renglones) y se convirtió en una
  línea de la campana + la pantalla `reposicion`. Medido: de 55 renglones a **41 px** en escritorio
  y 60 px en celular.
- **`richColors` de sonner se quitó** y el toast se reescribió con la paleta de la app.
- **Agregar al carrito dejó de abrir el carrito** (pedido de un cliente real).
- **Un solo desplegable en toda la app**: los 58 `<select>` nativos se cambiaron **por dentro**,
  sin tocar los 58 sitios (se comprobaron los 53 manejadores, todos usan `e.target.value`).
- **Los modales ganaron encabezado y pie anclados**: un cambio arregló los 25 modales.
- **El desplegable dejó de ignorar el alto que le pide la pantalla** (2026-08-14): el botón
  fijaba `h-9` dentro de una caja de 32 px y el panel abría pegado al campo.
- **La tabla del pedido sugerido salió a su propio archivo** (2026-08-14): estaba declarada
  dentro del componente y se remontaba entera en cada tecla.
- **Las acciones de la fila de perfumes se agruparon en un `⋯`** (2026-08-14), con el estado
  de solo lectura y solo para las excepciones.

## Sesión del 2026-08-14

Cuatro cosas que reportó el dueño y una que se destapó investigándolas.

- **La documentación se partió en 9 archivos.** `CLAUDE.md` había pasado de 150k caracteres y
  quedó en ~9,7k: solo lo que aplica siempre, más el índice de `docs/`. Se eliminaron ~21k de
  contenido obsoleto (pasos ya completados escritos como pendientes, estados "al día" caducados)
  y varias contradicciones que se arrastraban: el `stock_minimo` explicado con las dos
  semánticas, "Insumos y precios" viva y eliminada a la vez, Inventario en dos secciones del
  menú y el anti-abuso con dos juegos de números.
- **El desplegable respeta la caja que le da la pantalla.** El botón fijaba `h-9` dentro de una
  caja de 32 px, sobresalía 4 px y el panel abría pegado al campo (1 px de aire en vez de 4).
  Medido: los anchos SIEMPRE coincidieron — la sospecha inicial de que el panel era más ancho
  era falsa, y solo el navegador lo demostró.
- **La tabla del pedido sugerido salió a su archivo.** Estaba declarada dentro del componente y
  se remontaba entera en cada tecla: se escribía "999" y quedaba "200".
- **Las acciones de la fila de perfumes se agruparon en un `⋯`**, con el estado de solo lectura
  y solo para las excepciones. Se probó dejar "Editar" fuera del menú y el dueño lo corrigió;
  de ahí salió la regla de 2 acciones sueltas / 3 o más al menú.
- **Las tablas ganaron columnas de verdad** (`Imagen | … | Estado | Acciones`). El encabezado
  "Acciones" se puso en `SmartTable`, así que las 10 tablas quedaron iguales de una vez.
- **Producto terminado**: el motor (armar suma frascos, vender los saca primero) y **las tres
  reglas de disponibilidad** — hasta ese día los 229 perfumes se trataban como contratipos, y el
  dueño lo corrigió: cómo se consigue un producto cambia cuándo se puede vender. Con ellas, un
  1.1 sin armar deja de ofrecerse aunque haya esencia, y un original sin botella deja de poder
  venderse (antes un `comprado` **nunca** se agotaba solo). Ver
  [`reglas-negocio.md`](reglas-negocio.md) e [`inventario-costeo.md`](inventario-costeo.md).
- **Y se destapó un borrado silencioso**: guardar la ficha de un perfume rehacía su tabla de
  tallas, que desde esa misma mañana guarda los frascos armados. Cambiar una descripción borraba
  el inventario. Ver [`gotchas.md`](gotchas.md).
- **Una talla nueva nace sabiendo sus mililitros.** Crear "90 ML" guardaba solo el nombre, y una
  talla sin número no se costea: cada venta suya entraba en cero. Salió al ir a cargar los
  ORIGINALES, que vienen en tamaños que no existían en la lista.
- **Los frascos armados se ven en Inventario**, con su métrica y su tabla. Hasta entonces armar
  un lote hacía *desaparecer* inventario: la plata salía de los materiales y no aparecía en
  ninguna pantalla.
- **`perfume.repository.ts` se partió en dos** (912 líneas): la capa de lectura se fue a
  `perfume.mapeo.ts`. Una consulta y una regla de negocio no son el mismo oficio.
- **Se descubrió por qué el MySQL local se caía solo**: no era la base, era Prisma. Ver
  [`gotchas.md`](gotchas.md).

## Sesión del 2026-08-18 al 22: filtros al servidor y regalos en la venta

- **Los filtros de columna dejaron de mentir en 6 tablas.** Filtraban solo la página que ya
  estaba cargada, así que "Rol = admin" sobre la página 1 escondía a los admin de la página 3.
  Ahora el filtro viaja al servidor (`utils/filtros.ts`, compartido por Perfumes, Ventas,
  Créditos, Pagos, Combos y Recompensas).
- **Regalos y extras en la venta, Ola 1** (diseño y plan en `docs/superpowers/`). El caso real:
  una venta con dos perfumeros recargables, uno del combo (gratis) y otro cobrado. Antes eso se
  escribía en Notas — texto libre que **no descuenta inventario y no tiene costo**, así que la
  ganancia del mes salía inflada justo en lo que costaban los regalos.
  - Nació y murió en cuatro días un primer intento, `regalo_automatico`: un botón que agregaba
    una línea aparte fija en 1. **No servía**: buscar el mismo producto otra vez subía la
    cantidad de la OTRA línea y el número resultante no se podía separar en "regalo" y "cobrado".
    Nunca llegó a producción; su migración se conserva solo para que aplicar en orden desde cero
    siga funcionando.
  - Lo que quedó: **cualquier línea tiene un campo "Regalo"** (`venta_perfume.regalo`, con el
    candado `regalo <= cantidad` en el backend) y **los accesorios tienen su propio buscador**
    en Ventas (`perfumes.es_accesorio`), para no mezclarse entre las 212 fragancias. Detalle en
    [`reglas-negocio.md`](reglas-negocio.md).
  - **Créditos se dejó igual a propósito**: su backend no guarda el regalo, así que su formulario
    no enciende `permitirExtras`. Hay un recorrido que lo vigila, porque encenderlo por error
    dejaría escribir un regalo que el servidor descarta en silencio.
  - **La Ola 2 (el kit del combo) se dejó para después** de que el dueño use esta unos días.

## Cosas que se probaron y se descartaron

- **Three.js para la tarjeta de recompensas**: pesaba mucho para el público de gama baja y el
  render no igualaba los trazos de la versión en CSS puro. **No reintroducirlo sin buena razón.**
- **Un toast propio**: apilaba avisos duplicados y en móvil se montaba sobre el formulario. Se usa
  sonner.
- **`richColors` de sonner**: paleta ajena a la marca. Ver [`diseno-ux.md`](diseno-ux.md).
- **Un colchón de 3 unidades para el agotado automático**: escondía 86 de 220 perfumes. Y cortar en
  cero dejaba vender un 30 ml con 3 ml de esencia. Se eligió "no alcanza ni para uno".
- **Comparar cadenas en el emparejador de esencias**: acertaba 7 de 29. Por palabras (Dice) sube a
  19.
- **Usar el género de la esencia para desambiguar perfumes**: resolvió **cero** de los 5 casos
  ambiguos. Lo que sirve es "solo son candidatos los perfumes sin esencia".
- **`output` en el generator de Prisma**: funcionaba en local y rompía producción.
- **Ordenar la lista de esencias por nombre en el selector**: se ordenan las esencias primero,
  porque diluyente/sellador/feromonas también son materia prima.
