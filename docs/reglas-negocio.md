# Reglas de negocio

**Decididas con el dueño. No cambiarlas sin preguntarle.** Lo de inventario, costos y
cotizaciones está en [`inventario-costeo.md`](inventario-costeo.md).

## Precios por presentación (base de todo lo demás)

- El precio NO vive en el perfume: sale de una **cascada** resuelta en `mapPerfume`:
  1. `perfume_presentacion.precio` (excepción de ESE perfume en ESA talla)
  2. `precios` (categoría × presentación) — la lista de precios del negocio
  3. `perfumes.precio` (respaldo: perfumes sin categoría o sin lista)
- Cambiar una casilla de la lista mueve a TODOS los perfumes de esa categoría de una vez; los
  que tienen precio propio no se enteran. Editor: dashboard → Catálogo → Precios.
- `mapPerfume` expone `precios[]` (talla + precio + `propio` + `ml`), `precio` (el más barato,
  para las cards) y `varios_precios` (dispara el "desde $X").
- El carrito guarda el precio de LA talla elegida: `AddToCartModal` recibe precios de lista y
  aplica `finalPrice` UNA sola vez (no pasarle precios ya descontados).
- **Esencia premium** (`perfumes.esencia_premium`): contratipos con la esencia de mayor
  calidad del laboratorio (ej: Ahli Octans, 60k los 30ml). Llevan distintivo en card y detalle,
  y **NUNCA entran en el precio de combo** (`useComboDetector` los excluye del agrupado). Ojo
  con el vocabulario: NO es perfumería "nicho" (Creed, MFK), que es otra cosa; el adjetivo
  describe la esencia. Cuando el carrito sugiere completar un combo y hay premium excluidos, el
  mensaje lo aclara (si no, el cliente reclama al pagar).
- **PRECIO DE VENTA PAREJO, COSTO DISTINTO** (decisión del dueño): todas las no premium se
  venden al mismo precio de lista aunque una esencia cueste el triple que otra. Se renuncia a
  la ganancia extra de la esencia barata por tener un precio reglamentario. Por eso **no hay
  que poner precio por fragancia**; lo que hace falta es VER el margen de cada una.

## Precios y descuentos (lo más delicado de la app)

1. **Descuento de producto vs categoría**: el % efectivo es `max(propio, categoría)` — se
   calcula en `mapPerfume` (backend). El de categoría es UN registro en `categorias.descuento`,
   nunca updateMany sobre perfumes.
2. **Combos = precio por mayoreo, SIEMPRE aplica**: el carrito detecta N perfumes sueltos de la
   misma categoría+presentación y cobra precio de combo si es más barato
   (`useComboDetector.ts`). No es una promo: es política de precios permanente.
3. **Cupones** — ver la sección siguiente.
4. **Los descuentos nunca se acumulan entre sí** salvo cupón sobre precio de combo.

## Cupones (anuncios tipo `descuento` + códigos únicos `CP-XXXXXX`)

- Una persona sostiene **UN solo cupón a la vez**; cada cupón es de **un solo uso en la vida**
  (código canjeado bloquea ese cupón, no las campañas futuras).
- Por compra se redime **un solo cupón** (el de mayor descuento en pesos).
- El cupón descuenta **sobre lo realmente pagado** (combo incluido); los mínimos se miden sobre
  precio de lista; los productos con descuento propio NO reciben cupón.
- Guardarraíles por campaña: `max_descuento` (tope en pesos por canje) y `max_canjes` (cupo
  total; agotado = deja de anunciarse y no emite más).
- Flujo: popup → carrito aplica solo → pedido WhatsApp lleva el código → admin lo verifica en
  Publicidad → lo enlaza a la venta → al pagarla queda canjeado.
- Patrón de 2 anuncios: gancho (imagen/mensaje, audiencia "no_registrados") + cupón real
  (descuento, audiencia "registrados").

### En el formulario de ventas

- **El `valor_venta` SIEMPRE se teclea ya con el descuento restado** (es la plata que entró de
  verdad); la casilla del código solo verifica y enlaza, nunca recalcula.
- Al validar el código aparece una **ayuda de cálculo** que propone el valor final (reusa
  `descuentoDeCupon` de `pedido/lineasPedido.ts`, con el tope `max_descuento` de la campaña) y
  un botón "Aplicar" — sugiere, no impone.
- **Guardarraíl anti doble descuento**: si se está EDITANDO una venta cuyo código no cambió
  (`codigoOriginal`), el valor guardado ya trae el descuento y en vez de la sugerencia sale un
  aviso ("no lo vuelvas a descontar"). Igual tras pulsar "Aplicar" (`cuponAplicado`), que se
  resetea si se vuelve a teclear el valor. Esto importa porque **todas las ventas históricas se
  registraron con el descuento ya aplicado a mano**.

### CUPÓN CANJEADO = AMARRADO A SU VENTA O A SU CRÉDITO

Antes bastaba con **borrar el texto del campo al editar** para que `liberarCodigoDeVenta` lo
devolviera a `activo` y esa persona pudiera usarlo otra vez. Ahora, **igual en ventas y en
créditos** (el dueño igualó los créditos el 2026-09-28; antes quitar el código de un crédito lo
liberaba):

- `exigirCuponIntacto` (`anuncio.service.ts`) rechaza editar una venta o un crédito cambiando o
  quitando un cupón ya canjeado. Una sola regla para los dos; vive en el servidor.
- `liberarCodigoDeVenta(ventaId, excepto, soloNoCanjeados)` — al **editar** se pasa `true`; al
  **borrar** la venta o el crédito no, porque ahí sí debe soltarse: la compra se deshizo.
- En los dos formularios el campo sale bloqueado con la explicación (`pedido/CuponAmarrado.tsx`).
- Pruebas: `credito.cupon.bd.test.ts` y el recorrido `cupon.e2e.test.ts`.

### Cupón sobre un crédito

- Al crear un crédito se puede canjear un código: el descuento se calcula en el form y se guarda
  la deuda ya neta. El cupón se consume **al instante** (canjeado, un solo uso), NO espera a que
  pague todo — a diferencia de una venta normal (`canjearCodigoEnCredito`).
- Solo **borrar el crédito** libera el cupón (ver arriba).

## Unidades por perfume en una venta

- `venta_perfume.cantidad` guarda cuántas unidades de ESA fragancia lleva la venta: un combo de
  3 puede ser 2× Eros + 1× Sauvage.
- `venta_perfume` tiene `id` propio, columna `ml` y única `(venta_id, perfume_id, ml)`: el mismo
  perfume puede ir en dos tallas dentro de la misma venta.
- En el formulario se elige el mismo perfume varias veces y el chip muestra `2× Nombre`.
- `agruparEnlaces(ids)` (perfumeMatcher) convierte una lista con repetidos en
  `{perfume_id, cantidad}`: **úsala SIEMPRE** antes de `perfumes: { create: ... }`.
- "Los más vendidos" reparte `cantidad_perfumes` de la venta proporcional a esas cantidades.
- La referencia visible se escribe con el mismo formato (`2× Eros, Sauvage`).

## Regalos dentro de una venta (`venta_perfume.regalo`)

- Cada línea guarda cuántas de sus unidades van **gratis**: `regalo` (default 0). Nunca puede ser
  mayor que `cantidad`, y el candado vive en el esquema del backend, no solo en el formulario:
  una llamada directa a la API se saltaría la pantalla.
- **Se cobran `cantidad - regalo` unidades y se descuentan del inventario TODAS.** Lo regalado
  sale de la bodega igual y pesa en el costo de mercancía de la venta. Antes se escribía en Notas
  y la ganancia del mes salía inflada exactamente en lo que costaban los regalos.
- Sirve igual para un accesorio y para una fragancia: una promoción tipo "el 4º gratis" cabe aquí
  sin nada nuevo (decidido con el dueño, 2026-08-18).
- Al agrupar líneas repetidas del mismo perfume y talla se suman `cantidad` y `regalo` **por
  separado**, o la fusión rompería el candado.
- **`perfumes.es_accesorio`** marca la ficha que NO es fragancia (perfumero, bolsa, tarjeta). Es
  ortogonal a `tipo_producto`: dice de qué clase es el producto, no cómo se abastece, y solo tiene
  sentido en un `comprado`. En Ventas tiene su propio buscador para no mezclarse entre las 212
  fragancias.
- **Créditos NO maneja regalos todavía**: su backend no los guarda, así que su formulario no pinta
  ni el campo "Regalo" ni el buscador de accesorios. Encenderlos ahí dejaría escribir un regalo
  que el servidor descarta en silencio.
- La referencia visible de la venta lo dice: `2× Perfumero Recargable [1 regalo]`.


### El empaque: por línea y talla, o el kit del combo (2026-10-04, decisiones del dueño)

Antes la bolsa y el perfumero se descontaban por debajo según la receta del tamaño, también en
los 1.1 (*"no tenerlo como actualmente que sí o sí hasta con los 1.1 les descuenta la bolsa de
organza y el perfumero"*). Ahora:

- **Catálogo → Empaque**: cada línea (contratipo, 1.1, decant, botella completa, producto) y
  talla dice qué accesorios lleva. Arrancó igual que las recetas: contratipo 30 y 100 ml = bolsa +
  perfumero, 75 ml = bolsa; el resto, nada.
- **Un combo manda** con su kit (`combo_contenido`, en su ficha) y reemplaza el empaque de los
  perfumes que lo arman. Cada combo lleva lo que el dueño quiera (bolsa y perfumero, solo
  perfumero…). Los 4 "+ Obsequio" arrancaron con 1 perfumero: el obsequio es el perfumero vacío.
- **Al vender** sale "Este pedido lleva: Bolsa ×2 · Perfumero ×2" marcado; desmarcado no va,
  marcado entra como regalo al guardar. Lo ya regalado a mano cuenta como puesto. Al corregir una
  venta viene desmarcado: su empaque se decidió al registrarla.
- **El personal** puede regalar el empaque que toca sin pedir permiso; regalar de más sigue siendo
  un descuento que espera al dueño (`controlPrecio.ts` + `empaque/regaloDeEmpaque.ts`).
- **La tienda** dice bajo la talla "Incluye bolsa organza y perfumero recargable 6 ml", y en el
  combo lo que trae su kit: sale del mismo dato que se regala, así que no puede prometer de más.
- Los accesorios no son perfumes: no cuentan en `cantidad_perfumes` ni arman combos.
- Cada combo puede traer accesorios por defecto: **solo accesorios** y cada uno una vez (lo valida
  el servidor).
- Se ofrece lo que exista en el catálogo de Ventas, **publicado o no**: un perfumero de regalo no
  tiene por qué venderse al público, y un accesorio recién creado nace oculto.
- Un accesorio que está en un kit **no se puede borrar** sin sacarlo antes (el mensaje dice de qué
  combos); borrar el combo se lleva su kit.

## Matcher de perfumes (`backend/src/utils/perfumeMatcher.ts`)

- Conservador: solo enlaza con candidato ÚNICO; ambigüedad = sin enlazar (fallo barato).
- Alias (`one`→`1`, `aqua`→`acqua`) y tolerancia a typos de 1 letra SOLO en palabras de 5+.
- Con separadores (`,;+/" y "`) se enlaza cada parte; el texto completo es plan B.
- `matchPerfumes` devuelve ids REPETIDOS a propósito ("Eros, Eros" = 2 unidades); no deduplicar:
  quien consume usa `agruparEnlaces`.
- Casos reales cubiertos: "One Million" solo enlaza si existe ese nombre exacto en el catálogo;
  si solo hay variantes (Elixir, Parfum) debe dar vacío, nunca elegir una.
- **Discrepancia conocida**: `matchPerfumes` con nombres que llevan coma. Encontrada por las
  pruebas escritas desde la regla, no desde el código.

## Sacar un perfume de la tienda (`perfumes.publicado`)

Son **DOS estados distintos y no hay que confundirlos** (el dueño lo separó él mismo):

- **`agotado`** — "no hay ahora mismo". SÍ se ve en la tienda, marcado, y el cliente puede
  pedir que le avisen cuando vuelva. Sigue haciendo trabajo de vitrina.
- **`publicado = false`** — desaparece del catálogo **como si no existiera**: listados,
  búsqueda, destacados, más vendidos, relacionados, favoritos, recomendador, su página (404) y
  el sitemap. No borra nada: datos, fotos e historial quedan intactos.

Reglas:

- **`SOLO_PUBLICADOS`** (exportado de `perfume.repository.ts`) es el filtro único; se aplica en
  TODAS las consultas públicas. **Al agregar un endpoint de catálogo, aplicarlo.**
- **El dashboard pide `?todos=1`** (mismo patrón que `GET /costeo/insumos?todos=1`), y el
  servidor **solo lo honra si eres admin** (`esAdminRequest`): sin esa comprobación cualquiera
  listaría lo que sacaste de la tienda agregando el parámetro a la URL.
- **TRAMPA DEL CACHÉ**: `todos` va DENTRO de la clave (`parfums:all:todos`, y en la clave de la
  página). Compartir clave serviría la lista del admin —con los ocultos— al siguiente visitante.
  Las dos empiezan por `parfums:`, así que `bustCatalogoCache()` limpia ambas.
- **Editar un perfume NO lo republica**: `publicado` solo se toca si viene en el cuerpo (mismo
  criterio que `descuento`/`agotado`).
- Un perfume creado desde una compra **nace `publicado = false`**: es una ficha sin precio, sin
  foto y sin categoría.
- **Las tallas en $0 no salen en la tienda** (opción B del dueño, 2026-10-02). Un original puede
  publicarse con solo la botella o un decant con precio; los demás tamaños se esconden solos hasta
  que tengan precio. Lo hace `mapPerfume` (vista de la tienda) filtrando la fila ANTES de mapear,
  así el "desde $X" y el agotado ya salen sin esas tallas; el panel usa `mapPerfumePanel` y las ve
  todas, porque ahí se les pone precio y se vende por WhatsApp. Lo único que bloquea
  `perfume.publicacion.ts` es publicar algo sin NINGÚN precio. Antes (2026-09-29, opción A) se
  exigían todas las tallas con precio, y un original no salía mientras faltara un decant.
  Despublicar nunca se bloquea.
- **Un decant de un original NO hereda el precio general** (2026-10-03). El precio general de un
  original es el de la botella; caía a toda talla sin precio propio ni de lista, y en vivo salían
  19 originales con el 3/5/10 ml a precio de botella ($270.000). Ahora solo la botella completa lo
  hereda; un decant sin precio queda en $0 y se esconde (regla de arriba). Vive en
  `heredaPrecioGeneral` (`utils/decants.ts`, copiado en `domain/entities/decants.ts` para la ficha).

## Las líneas de la tienda: Contratipo, 1.1 y Original (2026-09-29)

Cada tarjeta y cada ficha pública dicen a qué línea pertenece el producto, con su color: Original
en tinta sólida, 1.1 en iris, Contratipo en lila suave (el de esencia premium conserva su
distintivo). La línea (`linea` en la respuesta) la deduce el servidor en `lineaDe`
(`perfume.mapeo.ts`) de **cómo se consigue**, nunca del nombre de la categoría: `es_accesorio` →
accesorio, `solo_armado` → 1.1, `fraccionado` → original, `comprado` → producto (sin etiqueta: un
splash no se sabe si es original), el resto → contratipo.

En un original las tallas se nombran para el cliente "Decant 5 ml" y "Botella 100 ml", y el precio
de portada dice "decants desde": sin eso, un decant de $21.000 junto a un contratipo de $60.000
parece un error.

## Agotado AUTOMÁTICO: las tres categorías no se agotan igual

```
agotado (lo que ve la tienda) = agotado_manual  OR  motivo_agotado != null
```

**Cómo se consigue el producto cambia cuándo se puede vender** (decidido con el dueño el
2026-08-14; antes los 229 perfumes se trataban como contratipos):

| Categoría | Cómo se consigue | Disponible cuando… | `motivo_agotado` |
|---|---|---|---|
| **Contratipo** | se arma contra pedido | alcanza la esencia | `sin_esencia` |
| **1.1** (`solo_armado`) | se arma POR ADELANTADO | hay frascos armados | `sin_armados` |
| **Original** (`comprado`) | viene hecho | hay stock de su botella | `sin_producto` |

- **Y por encima de las tres: con frascos armados se vende, haya o no esencia.** Esa esencia ya
  se gastó el día que se armó el frasco. Sin esta regla los 1.1 recién producidos salían agotados.
- **Un 1.1 no se ofrece por tener el frasco**: el dueño tiene el *Envase Khamrah 1.1* comprado y
  sin armar, y ese perfume **no debe verse en la tienda** hasta producirlo. Es justo la
  diferencia con un contratipo.
- **La marca vive en el PERFUME (`perfumes.solo_armado`), no colgada del nombre de la categoría**:
  una categoría es un dato que el dueño edita, y el día que la renombre la regla dejaría de
  aplicarse **en silencio** (mismo criterio por el que la gama dejó de deducirse del nombre).
- **Un `comprado` sin insumo asignado NO se marca**: no hay nada que mirar, e inventar un
  "agotado" escondería de la tienda cosas que sí se tienen.
- **El `fraccionado` todavía no se juzga**: la botella se gasta por ml, no por unidades, y el
  corte exige la merma de fraccionamiento que el dueño aún no definió
  (ver [`pendientes.md`](pendientes.md)).
- Todo esto es **una sola función** —`motivoAgotado` en `perfume.mapeo.ts`— y devuelve el
  MOTIVO, no un booleano: así el dashboard puede explicar *qué* falta en vez de solo marcarlo.
- **Se juzga POR TALLA** (2026-08-29). Antes se sumaban los frascos de todas, y un 1.1 con un frasco
  de 50 ml enseñaba disponible también el de 100 ml, que al venderse no tenía nada que sacar. El
  perfume entero sigue disponible mientras **alguna** talla lo esté; la tienda tacha la talla
  agotada y no deja pedirla.
- **Y un 1.1 sin frascos NO se fabrica al venderlo desde el dashboard**: se registra la venta, el
  frasco queda en negativo, no se descuenta material y la pantalla lo avisa. Detalle en
  [`inventario-costeo.md`](inventario-costeo.md).

- **Se calcula en cada consulta, no se guarda** (mismo criterio que los sellos, el cupo y la
  gama): un valor guardado quedaría mintiendo en cuanto entre una compra de esencia, y
  obligaría al dueño a desmarcar a mano lo que ya puede vender. **La columna `agotado` no la
  escribe nunca el sistema.**
- **El corte es "no alcanza ni para UNO"** de la talla **más pequeña de ese perfume** — uno que
  solo se vende en 100 ml necesita 50 ml, no los 15 del 30 ml. Se descartaron un colchón de 3
  unidades (escondía 86 de 220) y cortar en cero (dejaba vender un 30 ml con 3 ml de esencia).
  Al encenderlo: **14 de 220**.
- **La receta viaja con el perfume** (`perfumeInclude` incluye `presentacion.formula`), y por
  eso `mapPerfume` sigue puro y síncrono. Cargarla aparte al estilo de `conRatings` obligaría a
  acordarse de aplicarla en cada consulta, y la que se olvidara mostraría disponible algo que no
  se puede armar.
- **NO hay interruptor para forzar "disponible"** (decisión del dueño): si el sistema se
  equivoca es porque el stock está mal, y ese número manda también en costos, pedido sugerido y
  campana. Se corrige el inventario y se arregla en los cuatro sitios.
- **Mover inventario tira el caché del catálogo** (`bustCatalogoCache` en ajustes, salidas,
  producciones y compras). Sin eso registras la llegada de una esencia y el perfume sigue
  diciendo "agotado" varios minutos: parece que no funcionó.
- `recomendacion.service` filtraba `agotado: false` **en SQL**, que solo ve la marca manual;
  ahora descarta además lo que no se puede entregar (`sinExistenciasParaUno`) tras mapear. El
  quiz recomendando lo que no hay es el caso más caro.
- **En el dashboard se distinguen los motivos** (`tabs/perfumes/EstadoPerfume.tsx`): el menú de
  acciones alterna la marca MANUAL y una insignia ámbar aparte dice cuál de los tres motivos es
  —*"Sin esencia"*, *"Sin armar"*, *"Sin unidades"*— con la explicación en su tooltip. La
  etiqueta la calcula `faltaParaVender`, que usan el badge y la columna "Estado" (así se puede
  ordenar y buscar por lo mismo que se ve).

## Devoluciones y garantías

- **Toda devolución cuelga de una VENTA** (`devoluciones.venta_id`). Sin ese enlace la plata
  devuelta no se puede descontar de ningún lado y los ingresos quedan inflados para siempre.
- **La plata devuelta sale de los ingresos**: `getVentaTotales` resta `monto_devuelto` de las
  devoluciones `resuelta` **por `fecha_resolucion`** (criterio de caja, igual que los abonos):
  una venta de marzo devuelta en julio afecta a julio, que es cuando salió el dinero.
  `total_dinero` resta el histórico completo. Expone además `devoluciones_mes`.
- **Guardarraíl**: no se puede devolver más de lo que costó la venta, contando las devoluciones
  anteriores de esa misma venta (`validarContraVenta`). Sin eso los ingresos podrían quedar en
  negativo.
- Zod exige coherencia: `resuelta` obliga a decir la `solucion`; solo hay `monto_devuelto` si la
  solución es `devolucion_dinero`.
- **Reloj del plazo legal**: la tarjeta avisa en ámbar a los 23 días hábiles y en rojo pasados
  los **30 hábiles** (Decreto 735/2013). Se cuentan HÁBILES (`diasHabilesDesde` en
  `devoluciones/etiquetas.ts`), no corridos: contar corridos daría una alarma prematura.
- **Garantías al costo real** (`devoluciones.costo_reposicion` + `costo_envio`): al marcar "le
  repuse el producto" se elige el tamaño y las unidades, y se valora al **costo de producción**,
  NUNCA al precio de venta — esa plata ya se cobró en la venta original y contarla otra vez
  duplicaría la pérdida. El costo se congela al guardar.
### Qué le hace al inventario una garantía resuelta (2026-08-30)

Hasta ese día: **nada**. Reponer un frasco lo sacaba de la repisa del dueño y no de su sistema, y
el que el cliente devolvía no volvía nunca a estar disponible.

**Se pregunta caso por caso, no se deduce del motivo** (decisión del dueño). Se evaluó una tabla
fija por motivo y la descartó con razón: un *"llegó equivocado"* puede volver abierto y un *"llegó
dañado"* puede ser solo la caja. El motivo dice por qué se quejó el cliente, no en qué estado
llegó el frasco. Por eso el formulario pregunta dos cosas: `producto_devuelto` y, si sí,
`revendible`.

| Situación | Inventario |
|---|---|
| Repusiste N frascos | **Salen N**, igual que una venta (de lo armado; si no hay y no es un 1.1, se fabrica de la receta) |
| Te lo devolvieron y sirve | **Entra**, a la talla que dice la línea de la venta original |
| Te lo devolvieron y no sirve | **Nada**: su costo ya se cargó el día de la venta |
| No te devolvieron nada | **Nada** |

- **Lo que vuelve entra al costo promedio de HOY**, no al del día de la venta: es un frasco
  idéntico a los que están en la repisa y valorarlo distinto partiría en dos el promedio de esa
  ficha.
- **Sin talla en la venta original no se puede devolver** (no se sabe a qué ficha entra): no
  bloquea el guardado, avisa. Igual que vender un 1.1 sin tenerlo armado, que lo deja en negativo.
- **Todo se mueve con tipo `garantia` y referencia a la devolución**, nunca con `venta`: revertir
  busca por tipo + referencia, y con los dos bajo el mismo tipo la venta 7 y la devolución 7 serían
  indistinguibles.
- **Cerrar, reabrir, corregir y borrar** deshacen y rehacen el efecto entero
  (`aplicarInventarioDevolucion` empieza revirtiendo), así que corregir de 1 a 2 frascos repuestos
  no cuenta el primero dos veces. Un caso puede **nacer resuelto** y también mueve inventario.
- Lo que no se pudo hacer viaja en `avisos` **fuera de `data`** y la pantalla lo enseña con
  `mostrarAvisos` (`application/avisosInventario.ts`), el mismo de ventas y créditos.

- Los textos (motivos, estados, soluciones, colores) viven en
  `domain/entities/devolucion.labels.ts` (NO en `pages/dashboard`, para que el portal público no
  arrastre código del dashboard). Hay **dos juegos de soluciones**: `SOLUCIONES` en voz del
  admin ("Le repuse el producto") y `etiquetaSolucionCliente` en voz del cliente ("Te repusimos
  el producto") — usar la que corresponda o el texto suena absurdo.

### Portal del cliente (`/mis-compras` → "Garantía de mis pedidos")

`components/devoluciones/MisPedidos.tsx`: el cliente ve sus compras PAGADAS y abre un reclamo
con motivo, texto y hasta 3 fotos.

- Nace `pendiente`, `origen: 'cliente'` y **con `monto_devuelto` en 0**: cuánto se devuelve lo
  decide el admin, nunca el cliente (el endpoint ni lo acepta).
- Solo sobre ventas con `venta.user_id === req.jwtUser.id`; si no, responde "No encontramos esa
  compra en tu cuenta" (mismo mensaje que si no existe: no se filtra qué ventas hay).
- **Un solo reclamo abierto por compra** (evita que se dupliquen a punta de clics).
- Si el reclamo se rechaza DESPUÉS de subir la foto, el router borra los archivos ya guardados.
- Las rutas de cliente van ANTES de `devolucionRouter.use(requireAdmin)` en el router.

### Base legal (investigado, NO improvisar) — `/legal#devoluciones`

- **Garantía legal** (Ley 1480/2011, arts. 7-8-11): cubre producto equivocado,
  dañado/derramado/incompleto, envase o atomizador defectuoso, no entregado. Solución:
  reposición o devolución del dinero. **Los costos de transporte de la garantía los asume el
  vendedor** (art. 11). Plazo legal máximo para hacerla efectiva: 30 días hábiles
  (Decreto 735/2013).
- **Término anunciado: 90 días** (`GARANTIA` en `config/negocio.ts`). El art. 8 deja que el
  vendedor ANUNCIE el término y solo a falta de anuncio son 12 meses. Se eligió 90 porque es **el
  mismo piso que la ley fija para productos usados** — número defendible, no inventado. Bajarlo a
  ~30 días se acerca a "limitar la responsabilidad legal", que el **art. 43 numerales 1 y 2
  declara ineficaz de pleno derecho**; el ahorro no compensa el riesgo.
- `avisoEntregaDias` (5 hábiles) es OTRO plazo: avisar que el pedido llegó mal para poder
  reclamarle a la transportadora — NO recorta la garantía por defecto de fábrica.
- **El retracto (art. 47) NO aplica a perfumes**: el numeral 7 exceptúa los "bienes de uso
  personal" y la SIC clasificó ahí los cosméticos (concepto rad. 12-27958). Por eso la página
  dice que no se aceptan devoluciones por cambio de opinión — y aclara que eso **no toca la
  garantía legal** (que es irrenunciable). No suavizar esto sin hablarlo con el dueño.
- Se menciona la reversión del pago (art. 51) y la SIC como autoridad.
- **Marcas e imágenes** (`/legal#marcas`): las fotos de producto son REFERENCIALES (sacadas de
  otras webs), las marcas son de sus titulares, muchos productos son contratipos, y el negocio
  no está afiliado. Datos personales: Ley 1581/2012, contacto por WhatsApp (NO se inventó
  NIT/dirección/razón social: agregar solo si el dueño los tiene).

## Motor de cupo (`creditoPerfil.service.ts`, solo admin)

- Recalcula SIEMPRE desde el historial (no se guarda). Factor sobre `users.cupo_base`, acotado
  0.5–2.0. Pago rápido (≥300k en 14 días) ×1.1; pago lento (>30 días sin abonar con saldo) ×0.9;
  veto a los 60 días sin mover.
- **Cupón vencido**: un crédito que usó cupón y sigue con saldo pasada su `fecha_limite` castiga
  el DOBLE (×0.8, evento `cupon_vencido`) y reemplaza al pago lento en ESE crédito (no se suman).
  Es "el factor tiempo en contra": descuento + plazo incumplido no salen gratis.

## Tarjeta de recompensas (fidelidad, "junta 5 sellos")

- **Los sellos NO se guardan**: se recalculan del historial (como el motor de cupo). Un sello =
  una venta con `user_id`, `pagada=true` y `valor_venta ≥ min_compra`. Editar o borrar ventas
  ajusta los sellos solos. Solo se guarda `sellos_consumidos` (por premios entregados) en
  `recompensa_usuario`.
- Config GLOBAL en `recompensa_config` (fila única): `sellos_objetivo`, `premio`, `min_compra`,
  `activo`. Cada cliente puede tener **override** propio (`objetivo_override`, `premio_override`,
  `min_compra_override`; null = usa la global).
- Al llenar la tarjeta el admin "entrega premio" (`sellos_consumidos += objetivo`,
  `premios_entregados++`) y la tarjeta se **reinicia** (programa repetible). El backend
  recalcula, nunca confía en el cliente. Lógica en `recompensa.repository.ts`.
- **Colores configurables** en `recompensa_config` (`color_fondo`, `color_lineas`,
  `color_texto`); son GLOBALES (no por cliente) y viajan en `calcularTarjeta().colores`.
- Portal: `/mis-recompensas`. La tarjeta es GRANDE (`max-w-2xl`) y escala su contenido con
  `cqw`+`em`.
- Admin: pestaña Recompensas = tabla (SmartTable) de clientes con progreso + botón "Configurar
  tarjeta" que abre un **modal con previsualización en vivo** (`RecompensaConfigModal.tsx`).
  `ColorField` vive en `dashboard/ui.tsx`.
- **Tarjeta 3D**: CSS puro (`TarjetaRecompensas3D.tsx`) para TODOS — se inclina, voltea y brilla
  con transform 3D, escala con `cqw`+`em` (contenedor con `container-type: inline-size`).
  Estética negro+dorado de la tarjeta física. (Se probó una capa premium con Three.js y se
  descartó: pesaba mucho para el público de gama baja y el render no igualaba los trazos de la
  CSS. **NO reintroducir Three.js sin buena razón.**)

## Reseñas de productos (compra verificada + moderación)

- Solo puede reseñar quien **compró ese perfume** en una venta con `user_id` y `pagada=true`
  (`resena.repository.ts` → `haComprado`). El portal `/mis-compras` lista los productos que la
  persona compró (`productosComprados`) y por cada uno un formulario (estrellas 1-5, comentario,
  **máx 3 fotos**).
- **Moderación primero**: la reseña nace `pendiente` y NO se ve en público hasta que el admin la
  aprueba (pestaña **Reseñas** → `ResenasTab.tsx`). Enum `ContenidoEstado`.
- **Promedio de estrellas**: NO se guarda, se recalcula con `groupBy` (`resumenRatings`).
  `mapPerfume` expone `rating_promedio` + `rating_total`; el helper `conRatings()` los inyecta en
  TODOS los endpoints de catálogo (una sola query por llamada cacheada). `@@unique([user_id,
  perfume_id])`: una reseña por persona y producto (el POST hace upsert). Router `/api/resenas`.
- Público: `components/resenas/` — resumen + distribución por estrellas + modal (`ResenasModal`)
  que filtra por estrellas y visor de fotos tipo carrusel (`VisorImagenes`, montado sobre el
  `Dialog` de shadcn para que el clic afuera cierre solo el visor y no el modal).

## Galería de ganadores (publicidad social gratis)

- Al **entregar un premio**, `entregarPremio` crea (en `$transaction`) un registro
  `RecompensaEntrega` (estado `pendiente`, premio congelado). Sobre él se suben las FOTOS: el
  propio cliente desde `/mis-recompensas` (`SubirFotosEntrega.tsx`, máx 3) o el admin desde la
  pestaña Recompensas (`EntregasModeracion.tsx`).
- **Moderación primero** igual que reseñas: si el cliente sube fotos vuelve a `pendiente`. La
  **galería pública** (`GaleriaGanadores.tsx`, `/api/recompensas/ganadores`, cacheado) muestra
  solo entregas `aprobada` con foto; sale en la Home (bajo destacados) y en el portal.

## Referidos

- `users.codigo_referido` + `referido_por` (self-relation). Portal `/invita` (link + amigos
  invitados y si compraron), registro con `?ref=CODIGO` (`RegisterPage` → `vincularReferido`).
- **Anti-trampa ("gente viva")**: `referido_por` es INMUTABLE y solo se fija AL REGISTRARSE →
  dos amigos con cuenta ya creada nunca pueden referirse entre sí (el recíproco es imposible);
  no se permite auto-referido (mismo id/correo); y el PREMIO NO es automático ni al registrarse:
  se gana solo cuando el amigo hace su **primera compra pagada** → crear cuentas falsas no da
  nada gratis. El admin premia manualmente viendo la lista (sin recompensa automática = sin
  exploit).

## Otros módulos del portal

- **Favoritos** (`favoritos`): corazón en cards y detalle (solo logueados). Contexto
  `ListasProvider`/`useListas` (carga ids una vez, toggle optimista). Página `/mis-favoritos`.
  Endpoints `/api/favoritos` (ids), `/detalle` (perfumes), `POST /:id` (toggle).
- **Avísame cuando vuelva** (`avisos_stock`): en el detalle de un perfume AGOTADO el cliente
  logueado pide aviso. NO hay correos automáticos: el admin ve la demanda con el contacto
  (pestaña **Reposiciones**, `AvisosTab`, botón WhatsApp por persona + "marcar avisados").
  `useListas` también trae los ids de avisos.
- **Sobre nosotros** (`sobre_nosotros_config`, fila única): página pública `/nosotros`
  configurable desde el dashboard. Endpoint público `/api/nosotros` (solo si `activo`).
- **Blog** (`posts`): público `/blog` + `/blog/:slug`; admin en pestaña **Blog** con editor de
  texto propio (`EditorHtml.tsx`, contentEditable + toolbar, sin dependencia pesada). El HTML
  **SIEMPRE se sanea en el backend** con `sanitize-html` (`blog.repository.ts` → `sanearHtml`):
  solo etiquetas de formato seguras, sin scripts/estilos/on*. Nunca se confía en el cliente.
  Estilos: `.blog-contenido` en `index.css`.
- **Contáctame**: la imagen de fondo se sube con `POST /api/contacto/fondo` (igual que el
  avatar); deja `fondo_tipo='imagen'` y borra del disco la imagen anterior. `saveConfig` también
  borra el fondo viejo si cambió.

## Personal: permisos, precio y solicitudes (2026-10-04, decisiones del dueño)

- Opción C: el dueño arma los roles con casillas; ADMIN (él) puede todo siempre.
- **Borrar** ventas o créditos: sin la casilla, el empleado solo lo PIDE; el dueño aprueba o rechaza.
- **Créditos**: ver cuánto debe cada cliente es una casilla aparte.
- **Descuentos** (precio menor, unidades de regalo o cupón): sin la casilla, el empleado puede
  sugerirlo; la venta **espera la aprobación del dueño** y no cuenta en nada mientras tanto. Si
  aprueba, se registra con el descuento; si rechaza, a precio normal.
- **El precio no se escribe a mano** sin esa casilla: lo calcula la app y el servidor lo recalcula.
- Para darle un rol a alguien, esa persona tiene que tener cuenta (registrarse en la página con su
  correo o con Google); una ficha sin correo no puede entrar.

## Precios sugeridos de los originales (2026-10-04, decisiones del dueño)

Diseño: `docs/superpowers/specs/2026-10-04-precios-originales-design.md`. Pestaña Catálogo →
Precios de originales (solo el dueño).

- **La ganancia la elige él cada vez** (*"habrá casos en que por ganarme al cliente me ganaré 10
  mil pesos en un producto"*): un selector en la pantalla, en **% del precio** o en **pesos por
  unidad**. Un original puede guardar su **meta propia** (`perfumes.meta_ganancia_*`), que manda
  sobre la general.
- **El % es margen sobre el precio de venta** (opción A): ganar 30 % → precio = costo ÷ 0,70. Con
  "30 % encima del costo" en realidad ganaría el 23 % de lo que cobra.
- **Redondeo al $1.000 más cercano.** Sin costo de compra no se sugiere nada.
- **Solo originales** (opción A): los contratipos comparten precio de lista en un 90 %; los
  originales cambian mucho de uno a otro.
- **El costo es el mismo que descuenta la venta**: líquido + 2 ml de merma + frasco del decant (el
  de la talla o el de la receta) + empaque de su línea; la botella completa, solo el líquido
  (`backend/src/precios/costoTalla.ts`).
- Aplicar escribe el precio propio de la talla. Un decant que estaba en $0 aparece solo en la
  tienda. Si el sugerido es más bajo que el precio de hoy, la pantalla dice "baja".
