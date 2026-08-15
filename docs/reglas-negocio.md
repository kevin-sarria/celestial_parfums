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

### CUPÓN CANJEADO = AMARRADO A SU VENTA

Antes bastaba con **borrar el texto del campo al editar** para que `liberarCodigoDeVenta` lo
devolviera a `activo` y esa persona pudiera usarlo otra vez. Ahora:

- `liberarCodigoDeVenta(ventaId, excepto, soloNoCanjeados)` — al **editar** se pasa `true`; al
  **borrar** la venta no, porque ahí sí debe soltarse.
- `updateVenta` **rechaza** el cambio con un mensaje claro. La regla vive en el servidor: la
  pantalla se puede saltar.
- En el formulario el campo sale `disabled` con la explicación.
- **Ojo: en CRÉDITOS sigue funcionando distinto a propósito** (quitar el código lo libera; es
  el único camino para devolver un cupón canjeado en crédito). Igualar las dos reglas es una
  decisión aparte que hay que hablar con el dueño.

## Créditos ↔ Ventas

- Crear un crédito genera su **venta enlazada pendiente** (`creditos.venta_id`), con los
  perfumes detectados del texto de artículos vía `perfumeMatcher`.
- El abono que salda la deuda marca la venta como pagada (y es simétrico: borrar un abono la
  reabre; borrar el crédito borra su venta).
- Estadística "Ingresos este mes" = ventas de contado del mes + abonos del mes. La venta
  enlazada a crédito NUNCA suma ahí (su plata entra por abonos; evita doble conteo).
- `creditos.fecha_limite` (`@db.Date`): acuerdo de pago, por defecto 1 mes desde `fecha`,
  editable. El crédito sale "Vencido" en la tabla si sigue con saldo pasada esa fecha.

### Crédito itemizado (productos reales, no texto libre)

- El formulario arma **líneas**: perfume del catálogo + su talla + cantidad. El precio sale de
  la lista de precios (cascada de `mapPerfume`); el descuento de la página se aplica por
  defecto pero cada línea tiene un check **"sin −X%"** para quitarlo (a crédito no siempre
  aplica lo del contado). La suma = "valor de los productos".
- **Interruptor "aplicar precio de combo"** (apagado por defecto): a crédito el mayoreo NO se
  aplica solo; si se enciende, reutiliza `detectarCombos` (mismo motor del carrito) y resta el
  ahorro. Los ítems con descuento propio o esencia premium no entran al combo.
- El form manda `perfume_ids` (repetidos por cantidad), `presentacion` (resumen "30ml, 60ml") y
  `articulos` (texto generado). El backend usa los ids directo (sin matcher); el importador de
  Excel sigue infiriéndolos del texto libre.
- **La deuda que se manda ya es el valor FINAL** (líneas − combo − cupón): el cálculo del cupón
  vive en el FRONT; el backend la guarda tal cual y solo consume el código. Así editar no
  aplica el descuento dos veces. Campo editable a mano.
- **Editar crédito** (`updateCredito`, PATCH `/creditos/:id`): conserva los abonos, recalcula
  pagada contra ellos, reconstruye las líneas desde `venta.perfumes` (talla best-effort) y
  re-enlaza el cupón como en ventas.

### Cupón sobre un crédito

- Al crear o editar un crédito se puede canjear un código: el descuento se calcula en el form y
  se guarda la deuda ya neta. El cupón se consume **al instante** (canjeado, un solo uso), NO
  espera a que pague todo — a diferencia de una venta normal (`canjearCodigoEnCredito`).
- Borrar el crédito (o quitar el código al editar) **libera** el cupón: revierte la compra. Es
  el único camino para "devolver" un cupón canjeado en crédito.

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
  duplicaría la pérdida. El costo se congela al guardar. **La reposición NO descuenta
  inventario**: el material ya salió cuando se registró la producción de ese frasco.
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
