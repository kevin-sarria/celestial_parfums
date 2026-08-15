# Inventario, costos y cotizaciones B2B

El módulo más grande y el que más plata mueve. Base del futuro POS.

## Costo promedio ponderado (el corazón de todo)

- **El precio de un insumo ya NO se teclea**: es el **costo promedio ponderado** que sale de
  las compras. `insumos_costo.precio` y `.stock` son una **PROYECCIÓN** del libro
  `movimientos_inventario`; la verdad auditable es el libro.
- Fórmula (`inventario.repository.ts` → `aplicarMovimiento`):
  `(stock × promedio + cantidad × costo) / (stock + cantidad)`. Una salida (producción,
  garantía, merma) se valora al promedio vigente y **NO** lo modifica.
- **Editar o borrar una compra revierte sus movimientos** (`revertirMovimientos`) y los vuelve
  a aplicar. Sin eso el stock se contaría dos veces. `recalcularPromedio` reconstruye todo
  desde el libro y es la red de seguridad si algo se descuadra.
- Verificado numéricamente: 200 ml a $380 + 500 ml a $420 = $408,57 promedio; salida de 150 ml
  no mueve el promedio.
- **Orden importante al arrancar**: sembrar primero el stock inicial y DESPUÉS registrar
  compras. Al revés, el promedio se calcula contra stock cero y la primera compra manda sola.
- **El stock se siembra con un movimiento de `ajuste`, nunca escribiendo la columna** (vale
  también para las pruebas): un valor puesto a mano desaparece en cuanto algo obliga a
  reconstruir.

### CASO DE BORDE ABIERTO — decisión pendiente con el dueño

`recalcularPromedio` solo escribe el precio `if (movs.length)`. Si al borrar la compra el
insumo se queda **sin ningún movimiento**, conserva el costo que fijó la compra borrada en vez
de volver al precio de partida. Se auto-corrige en la siguiente entrada, pero mientras tanto
muestra un costo que ya no corresponde (se observó con Esencia Clásica en 383,18 en vez de 380).
El caso general SÍ está resuelto; este no.

- Hay **dos pruebas** en `inventario.costoPromedio.bd.test.ts`: la del comportamiento correcto
  está en `it.skip` con la etiqueta `DISCREPANCIA` (esperado 380, real 420) y **otra que fija lo
  que hace HOY**, para que el día que se arregle el cambio salte a la vista.
- **NO se arregló, y no por pereza**: el precio de arranque **no se guarda en ninguna parte** —
  la primera compra lo sobreescribe—, así que "volver al de partida" no es una línea de código
  sino una columna nueva (`precio_inicial`) con su migración. La otra salida sería dejarlo en 0,
  pero eso hace ver márgenes inflados sin avisar.

## Compras (sobre `pagos_proveedor`)

- **La compra vive sobre `pagos_proveedor`** (que ya existía), no en una tabla paralela: se le
  agregaron `numero_factura`, `archivos` (JSON) y las líneas `compra_items`. Un pago sin líneas
  sigue siendo válido (los históricos no las tienen) y no mueve inventario.
- **El flete se reparte entre las líneas** (`costosConFlete`), proporcional al subtotal de cada
  una. El transporte ES parte de lo que costó el material: ignorarlo infla los márgenes de las
  cotizaciones. Se congela en `compra_items.costo_unitario_final`.
- **Unidades de compra** (`UnidadCompra`): **ml y gramos van 1 a 1** (así factura el sector); NO
  meter densidades para "arreglarlo", descuadraría contra la factura del proveedor. Los **litros
  SÍ multiplican ×1000** (`FACTOR_UNIDAD` / `aBase`): sin eso, teclear "20 L" de alcohol entraba
  como 20 ml y el costo por ml quedaba **mil veces inflado**. El inventario SIEMPRE guarda la
  unidad base (ml o piezas).
- **Crear insumo al vuelo** dentro de la compra (`DetalleCompra.tsx`): llega una esencia o un
  envase nuevo y se da de alta ahí mismo. Va **primero** en la lista del buscador (al final hay
  que hacer scroll y nadie ve que existe). **No pide precio**: lo fija esa misma compra.
- **Registrar llegada** vive en Inventario y enlaza a `/dashboard/pagos?nueva=1`, que abre el
  formulario solo.

### IVA de compras: se configura POR PROVEEDOR, nunca global

Los proveedores de este negocio facturan distinto y un porcentaje único es un error caro.

- `empresas.iva_modo` = `incluido` (el precio ya lo trae — así factura el distribuidor
  principal), `agregado` (dan el parcial y suman el IVA) o `sin_iva` (Temu, Amazon, persona
  natural). Aplicarle 19% a todos **contaría el impuesto dos veces** con el proveedor más
  grande, y como el costo promedio se arrastra, ese error no se deshace después.
- Se configura UNA vez por proveedor y cada factura puede corregirlo (`pagos_proveedor.
  iva_modo`). El modo y la tasa se **congelan** en el pago: cambiarle el modo al proveedor
  mañana no reescribe una compra de marzo.
- **La tasa NO va quemada**: vive en `negocio_config.iva_tasa` (cambia por ley) y el formulario
  la pide a `GET /pagos/config-iva`.
- `negocio_config.responsable_iva` decide si el IVA **es costo** (hoy `false`: el dueño no está
  constituido como empresa, así que el impuesto sale de su bolsillo) o si se descuenta ante la
  DIAN y entonces el costo es la base gravable. `costosConFlete(lineas, flete, iva)` lo aplica;
  **sin el 3er parámetro se comporta exactamente como antes**.
- El IVA **se reparte entre las líneas como el flete**, y el flete se prorratea sobre el valor
  CON impuesto (que es lo que de verdad pesa cada línea en la factura).
- Se guarda `base_gravable` e `iva_valor` **por línea**: sin el desglose no se puede declarar
  ni, más adelante, emitir factura electrónica.
- El formulario muestra **la cuenta antes de guardar** (`compras/IvaDeLaCompra.tsx`). Las
  constantes viven en `compras/iva.ts` — un archivo que exporta componente Y constantes rompe
  la recarga en caliente.
- Verificado: 17 casos de cálculo, y de punta a punta con la MISMA factura de $322.000 →
  proveedor `agregado` deja el insumo en **$383,18/ml** y `incluido` en **$322,00/ml**.

## Una esencia por fragancia

**UNA ESENCIA POR FRAGANCIA, no una "Esencia" genérica** (`perfumes.insumo_esencia_id`):
Eternity, Khamrah y Mandarin Sky cuestan distinto por ml (verificado: 1.233 / 1.850 / 617).
Promediarlas en un solo insumo daba un costo que no era el de ninguna y la esencia barata
comprada en volumen se comía el promedio → se cotizaría a pérdida. Cada esencia es su propio
`insumos_costo` con su stock.

- La fórmula del tamaño es solo la RECETA de proporciones; **la esencia sale del PERFUME**.
- Lo que destapó el enlace masivo: el costo del líquido de un 30 ml va de **$3.450 a $22.500**
  según la fragancia — y el precio de venta es parejo. Las 4 de $1.500/ml son justo las marcadas
  `esencia_premium`. Ahí es donde "Margen por fragancia" gana su sitio.
- **`cotizacion/MargenPorFragancia.tsx`** (dentro de Costos de producción): tabla ordenada de la
  que menos deja a la que más, con aviso ámbar bajo 35% y rojo si el costo supera al precio. Sin
  eso, una esencia que sube de precio deja de rendir y nadie se entera, porque el precio de venta
  no se mueve. `calcularDesgloseCosto` acepta un 4º parámetro opcional con el costo por ml de la
  esencia del perfume (prioridad: perfume → receta → por nombre).

### Enlace automático perfume → esencia

El dueño cargó **213 esencias individuales**, una por fragancia, llamadas `‹Fragancia› –
Esencia`. Enlazarlas a mano eran 212 visitas.

- `GET /parfums/esencia/sugerencias` **propone sin aplicar**; el modal muestra la lista y solo al
  confirmar se manda `PATCH /parfums/esencia/enlaces` con los pares.
- Reutiliza el **matcher de ventas** (`buildPerfumeIndex`/`matchPerfume`), conservador a
  propósito: ante dos candidatos no elige. Un enlace equivocado descontaría la esencia de otra
  fragancia y el costo saldría falso sin que nadie lo note.
- **Solo toca perfumes fabricados SIN esencia**, y el `updateMany` vuelve a exigir
  `insumo_esencia_id: null`: si alguien la asignó a mano, su decisión manda.
- Resultado real: **175 de 212 enlazados**, 37 a mano, **cero colisiones**.
- **`AsignarEsenciasModal.tsx`** asigna una esencia a VARIOS perfumes de una vez (`PATCH
  /parfums/esencia/masiva`). El backend **rechaza un insumo que no sea `materia_prima`** y
  `insumo_esencia_id: null` lo QUITA, que es cómo se deshace una asignación equivocada. El
  selector **ordena las esencias primero**: diluyente, sellador y feromonas también son materia
  prima, y abrir en "Diluyente" invitaba a asignar el insumo equivocado.

### Puesta al día: emparejar esencias con su perfume

`emparejarEsencias.repository.ts` + `inventario/EmparejarEsenciasModal.tsx`. El alta desde una
compra enlaza toda esencia NUEVA, pero no tocaba las **29 que ya estaban**.

- **PROPONE, NO APLICA.** Medido: acierta 16 de 29 sin duda, pero entre esas hay propuestas
  equivocadas (*Carolina Herrera Dama* apuntando a Good Girl por la marca; *Mercedes Club
  Night* contra *Club Black*). Un enlace errado descuenta la fragancia que no era y falsea el
  costo **en silencio**, que es peor que no tener enlace. Lo dudoso arranca en "dejar así".
- **La regla que de verdad desambigua: solo son candidatos los perfumes SIN esencia.** "Eros
  Caballero" parecía tener dos candidatos (*Eros* y *Eros Flame*), pero Eros Flame ya tiene la
  suya → queda uno. Esta regla resolvió más casos que el género.
- **El emparejador compara PALABRAS, no cadenas** (coeficiente de Dice sobre palabras, sin ruido
  tipo "by/de/eau/dama"). Los dos lados están escritos al revés: *"Hugo Boss Bottled – Esencia"*
  contra *"Boss Bottled By Hugo Boss"*. Buscar una cadena dentro de otra acertaba **7 de 29**;
  por palabras sube a **19**. Umbral 0.34 y ventaja de 0.15 sobre el segundo.
- **El género DESCARTA, nunca elige**: si esencia y perfume lo tienen y no coinciden, ese perfume
  no puede ser.
- **CONFLICTO: dos esencias que quieren el MISMO perfume.** Pasa de verdad. Se detecta en el
  servidor al proponer Y en el navegador al elegir; sin eso, aplicar ambas dejaría que la segunda
  pise a la primera.
- `enlazarOCrearPerfume` vive aquí (se movió de `costeo.repository`): la usan los dos caminos por
  los que una esencia consigue perfume.

### La esencia y su perfume nacen juntos, en la compra

Pedido del dueño: *"que quede todo enlazado desde donde entra la esencia en el primer contacto,
que es cuando llega el pedido, hasta los descuentos que se le hacen con cada venta"*.

- **Por qué en la compra y no en Inventario**: la llegada del material es el primer momento en
  que el negocio sabe que esa fragancia existe. Y ese trabajo cuesta plata: un perfume sin
  esencia enlazada **no descuenta nada al venderse y su costo entra en CERO**, así que la
  ganancia del mes sale inflada.
- **Un solo tecleo, dos nombres.** Se escribe el nombre de la FRAGANCIA y de ahí salen los dos:
  el material conserva el sufijo `– Esencia` (guion U+2013, como las otras 213) y el producto
  lleva el nombre limpio. `nombresDe()` en el front y `sinSufijoEsencia()` en el back; si el
  dueño ya escribe el sufijo, no se agrega dos veces. El formulario **muestra los dos nombres
  antes de guardar**.
- **La gama es lo que distingue una esencia** del diluyente o el sellador (los tres son materia
  prima). Con gama elegida aparece la casilla del perfume; sin ella, no.
- **ENLAZAR ANTES DE CREAR, y no es un detalle.** Medido sobre los datos reales: de los **25
  perfumes fabricados sin esencia**, **19 ya tienen su esencia cargada con otro nombre** ("Eros
  by Versace" ↔ "Eros Caballero – Esencia"), así que un importador ingenuo habría metido 19
  duplicados. `enlazarOCrearPerfume` compara nombres normalizados y responde `creado` |
  `enlazado` | `ya_tenia`; **si el perfume ya tenía esencia NO se le cambia**. El mensaje del
  toast lo redacta el SERVIDOR, que es el único que sabe cuál de los tres casos ocurrió.
- **Un insumo repetido se RECHAZA** (`crearInsumo`), comparando sin tildes ni mayúsculas. Un
  material duplicado parte el stock en dos registros y ninguno dice cuánto hay. El mensaje manda
  a buscarlo en la lista, y distingue el caso "existe pero está apagado".
- El router llama `bustCatalogoCache()` **solo si hubo perfume**.

## Gama de la esencia (`gamas_esencia` + `insumos_costo.gama_id`)

**La gama es la CALIDAD de la esencia pura**, no del perfume. Es puramente calidad y precio:
*Clásicas* = imitan a las de diseñador, tan conocidas que salen baratas. *Árabes* = las de
tendencia, precio intermedio. *Premium* = lo mejor del laboratorio, esencia casi pura — y puede
imitar a una árabe, una de diseñador o una de nicho.

- **Por qué hace falta**: cuando el perfume se conoce se costea con SU esencia. Pero la
  **cotización general** al mayoreo dice "50 de 30 ml" sin decir qué fragancias, y ahí no hay
  esencia que usar.
- **El patrón de precios es real, medido sobre las 216 esencias**: no hay 216 precios distintos
  sino **7**, en tres escalones — 230 (43) y 280 (18) = clásicas; 350 (91), 380 (33), 450 (3) y
  480 (24) = árabes; 1.500 (4) = premium. Promedios: **245 / 379 / 1.500**.
- **NO se guarda ningún promedio**: `GET /costeo/gamas` lo recalcula del inventario en cada
  llamada. Cuenta solo esencias activas y con precio: una apagada o en cero arrastraría el
  promedio y mostraría márgenes falsos.
- **Es una TABLA, no una lista fija en el código.** Lo corrigió el dueño: quiere poder agregar
  "nicho", "nicho premium" y las que vengan **sin migración ni versión nueva**.
  `insumos_costo.gama_id` es FK con ON DELETE SET NULL: borrar una gama NO borra sus esencias,
  solo las deja sin clasificar (y el mensaje dice cuántas quedaron así). Endpoints:
  `GET /costeo/gamas/todas`, `POST`, `PATCH /:id`, `DELETE /:id`.
- **Se administran en Clasificaciones → Gamas de esencia** (`tabs/GamasTab.tsx`, reusa
  `LookupTab`). El nombre muestra cuántas esencias cuelgan de cada una: es lo que evita borrar
  la que tiene 151 creyendo que estaba vacía.
- Una gama **sin esencias no se lista** en `/costeo/gamas`: costearía a cero.
- En Inventario hay **columna Gama filtrable**: es la forma de repasar "muéstrame las árabes" y
  cazar las que quedaron sin clasificar, que el costeo por gama ignora en silencio.
- **La gama del PERFUME se HEREDA de su esencia** (`mapPerfume` → `gama`, `gama_id`,
  `insumo_esencia_stock`). Deducirla es mejor que guardarla: reclasificar una esencia mueve sus
  perfumes solos. Reparto real: **Árabe 137, Clásica 46, Premium 4, sin esencia 25**.
- **La receta ya NO elige esencia** (lo corrigió el dueño): `formulas_volumen` guarda las
  PROPORCIONES y los materiales generales (diluyente, sellador, feromonas, envase), que son
  iguales para todas las fragancias.

### Un material es esencia por su GAMA, no por su nombre

`domain/entities/insumo.ts` → `esEsencia()`, con prueba. El selector "¿con qué esencia se hace?"
filtraba por la palabra "esencia" DENTRO del nombre (regla anterior a que existieran las gamas).
Era un **círculo cerrado**: el modal del material tampoco enseñaba la casilla de gama a quien no
tuviera esa palabra, así que tampoco se podía clasificar. Medido: **5 esencias inservibles de
227**. Al cambiar el criterio no se pierde ninguna. **La regla vive en UN sitio, no duplicada.**
La casilla de gama aparece hoy en el modal de **cualquier materia prima**.

## Género de la esencia (`insumos_costo.genero`)

Caso concreto del dueño: *"pueden haber 2 perfumes llamados 212 VIP pero uno es de caballero y
el otro de dama"*.

- **Por qué no basta el nombre**: de **216 esencias activas solo 27 lo dicen** (21 dama, 6
  caballero). Un dato que está el 12% de las veces no sirve para decidir; un campo propio sí. La
  migración lo **siembra desde el nombre** y deja el resto en NULL — no se inventa lo que no se
  sabe.
- **OJO, medido: el género NO resuelve las ambigüedades de hoy.** Se probó contra los 5 casos
  ambiguos y resolvió **cero**, porque la confusión real es entre VARIANTES de la misma línea, no
  entre géneros (*Eros* vs *Eros Flame*, los dos caballero).
- **Dónde sí gana su sitio**: (1) descarta candidatos del género equivocado — "360 Dama" contra
  *360 Men* y *360 Red*: la respuesta correcta es "ninguno, es fragancia nueva"; (2) el perfume
  que nace de una compra sale ya clasificado; (3) el día que existan de verdad "212 VIP Dama" y
  "212 VIP Caballero", será el desempate.
- **Se pone en TRES sitios, y olvidar uno lo deja inservible**: (1) el alta desde una compra,
  (2) la ficha del material en Inventario y (3) la **hoja de Excel** (las DOS: insumos y conteo).
- El importador acepta sinónimos (`hombre`/`masculino` = caballero, `mujer`/`femenino` = dama),
  ignora mayúsculas y tildes, **una columna vacía NO borra** lo que ya había (solo `ninguna` lo
  quita) y **avisa** si el valor no vale en vez de tragárselo — mismo criterio que la gama.
- `leerGama` y `leerGenero` son helpers compartidos por los dos importadores.

## Pantalla de Inventario

**UNA sola pantalla de materiales.** Había DOS pestañas enseñando los mismos registros de
`insumos_costo` desde ángulos distintos — "Insumos y precios" (qué existe y cuánto cuesta) e
"Inventario" (cuánto tengo). El dueño preguntó *"¿el inventario no es lo mismo que eso de
materiales e insumos?"*: sí lo era. **"Insumos y precios" se eliminó** del menú y del código;
Inventario absorbió dar de alta y editar (`inventario/MaterialModal.tsx`).

- Razón de fondo: esa pestaña nació con el módulo B2B, cuando el precio de cada insumo **se
  tecleaba**. Desde que existen las compras, el precio ES el costo promedio y se calcula solo.
- El precio solo se pide **al crear**, como punto de partida; editando ya no aparece, porque
  tecleárselo encima falsearía el promedio.
- Muestra existencias, costo promedio y valor por insumo, más el valor total de la bodega.
- El botón **Ajustar** es un conteo físico ("tengo X") — con él se siembra el stock inicial; el
  costo solo pesa si el ajuste SUMA material.
- `resumenInventario` devuelve también los apagados (al final y marcados) para poder
  reencenderlos, pero **los totales cuentan solo activos**.

### Jubilar un insumo: APAGAR, no borrar

`insumos_costo.activo`. Apagado = desaparece de los buscadores de compras y producción y de la
pantalla de Inventario, **sin tocar su historial**. `GET /costeo/insumos` devuelve solo activos;
la pantalla que los administra pide `?todos=1` (si no, no habría cómo reencenderlos).

- **Borrar sigue existiendo y es lo correcto para lo que nunca se usó.** `eliminarInsumo`
  comprueba ANTES las 7 relaciones (movimientos, compras, recetas, accesorios, perfumes, tallas)
  y responde **qué** lo retiene y qué hacer en su lugar. Dejar que reventara la llave foránea
  daba "foreign key constraint fails", que no le sirve a nadie.

### Salidas y desperdicio

- **Salidas sin venta** (`POST /inventario/salidas`): `muestra` (rolones del mostrario, minis de
  regalo) es **costo de marketing**, `merma` (derrame, frasco roto) es **pérdida**. Van separadas
  a propósito: mezclarlas oculta cuánto cuesta dar a probar. El resumen del mes las muestra
  aparte (`salidasDelMes`).
- **El desperdicio pequeño del día a día NO se anota uno por uno** (los 1,6-3 g que se van de más
  al servir): lo absorbe el **conteo físico**. La diferencia entre el stock teórico y el real ES
  el desperdicio, y queda registrada como `ajuste`. Pedirle al dueño que anote cada gramo
  garantiza que deje de usar el módulo en una semana.

### Producción

`POST /inventario/producciones`: "armé N de 30 ml" descuenta esencia, diluyente, sellador,
feromonas, envase y accesorios por defecto. **El frontend calcula qué se consume** con el mismo
motor puro de las cotizaciones y lo manda; el backend valida y aplica (no se reimplementa la
fórmula en dos lenguajes). El modal avisa si no alcanza el stock. Borrar un lote devuelve los
insumos. El historial vive en la pestaña **Producciones**.

- **El envase varía dentro del mismo tamaño** (normal vs luxury): se elige al producir, con el
  de la fórmula por defecto.

### La hoja de conteo CREA los materiales que no existan

Antes rechazaba la fila con "no existe el insumo", lo que obligaba a darlo de alta a mano — justo
lo que la hoja venía a evitar.

- Si el nombre no existe, **se crea**. Para eso la hoja lleva una columna `tipo`
  (`materia_prima`/`envase`/`accesorio`), obligatoria SOLO para los nuevos.
- **Los nombres se comparan normalizados** (sin tildes, sin mayúsculas, sin espacios de más):
  `esencia clásica` encuentra `Esencia Clasica` y NO duplica.
- El `costo_unitario` de la fila es el precio de arranque del material nuevo.
- La hoja lleva también gama y género, así que se puede contar y clasificar en la misma pasada; y
  clasificar una existente **no mueve su stock**.

## La venta consume inventario

`consumirPorVenta` descuenta esencia (la DEL PERFUME), diluyente, sellador, feromonas, envase y
accesorios según la receta de la talla × unidades, y congela el costo en `ventas.costo_mercancia`.
`getVentaTotales` expone `costo_mercancia_mes` y **`ganancia_mes`** = ingresos − devoluciones −
costo. Editar o borrar una venta revierte el consumo (`revertirVenta`).

- `recetaDe` se bifurca por `perfumes.tipo_producto`:
  - **fabricado** → usa la receta de la talla.
  - **comprado** → descuenta UNA unidad del insumo que ES el producto (`insumo_producto_id`), y
    **NO exige talla**: una gorra no tiene ml.
  - **fraccionado** → descuenta los ml del decant de la botella origen (`ml_utiles`) + su envase.
- **GOTCHA que costó un ciclo**: `consumirPorVenta` saltaba toda línea sin `ml`, así que los
  comprados nunca descontaban. Solo los fabricados y fraccionados necesitan talla.
- **Lo que se define en `perfume_presentacion` (`envase_insumo_id`, `accesorios`) MANDA** sobre
  el envase/accesorios de la receta del tamaño, que pasan a ser el valor por defecto. La receta
  queda como lo que es: las PROPORCIONES.
- **Un perfume fabricado sin esencia no descuenta NADA al venderse** (se salta la línea entera) y
  su costo entra en cero → la ganancia del mes sale inflada. Por eso importa el enlace.
- **El consumo NO es retroactivo, por diseño**: las ventas históricas sin talla por línea no
  mueven inventario.

### Recetas confirmadas por el dueño

El diluyente es SIEMPRE el resto y **nunca se guarda** (`ml_total − esencia − sellador −
feromonas`, así no se desincroniza si se edita el volumen). Todas llevan esencia al 50%:

| Talla | Esencia | Sellador | Feromonas | Diluyente |
|---|---|---|---|---|
| 30 ml | 15 | 0,40 | 0,30 | 14,30 |
| 50 ml | 25 | 0,50 | 0,30 | 24,20 |
| 75 ml | 37,5 | 0,80 | 0,30 | 36,40 |
| 100 ml | 50 | 0,80 | 0,30 | 48,90 |
| 6 ml (lleno) | 3 | 0,20 | 0,15 | 2,65 |

El 75 ml usa el mismo sellador y feromonas que el 100 ml (no escalados).

- **6 ml** = el perfumero recargable. **SON DOS PRODUCTOS DISTINTOS**: el vacío es
  comprado/reventa (sin fórmula) y el lleno es fabricado.
- **200 y 250 ml** = splash COMPRADOS ya hechos, sin fórmula. El "200/250ML" del catálogo era un
  apaño: la talla debe ser el número real y "splash" va como categoría/tipo, no como talla.
- **Diluyente ≠ alcohol a secas**: es alcohol de papa con exaltante, ya balanceado. Por eso el
  insumo se llama "Diluyente" en todo el módulo y tiene costo propio. **No renombrarlo.**
- `presentaciones.ml` (número) + `formula_volumen_id` enlazan catálogo ↔ receta **POR NÚMERO**,
  no por texto. Las que NO son talla ("200/250ML", "Combo Personalizado") quedan con ml NULL a
  propósito y no se costean.
- **Una talla nueva nace sabiendo sus ml** (2026-08-14). Antes se guardaba solo el nombre: un
  "90 ML" quedaba con `ml = NULL` y cada venta suya entraba con **costo cero**. Ahora
  `createPresentacion` / `updatePresentacion` deducen el número con `mlDelNombre`
  (`utils/tallas.ts`) y enganchan la receta de ese tamaño si existe.
  - Es **el mismo corte de la migración** `20260801140000_tallas_en_ml` (`^[0-9]+ *[mM][lL]`), y
    tiene que seguir siéndolo: dos formas de leer el mismo nombre darían dos números distintos.
  - **Renombrar a algo sin número NO borra el ml que ya tenía.** Pasar "30ml" a "Frasco chico"
    dejaría de costear esa talla en silencio; si el dueño quiere cambiar el tamaño, lo escribe.
  - **La lista de Presentaciones muestra el número bajo cada nombre**, y dice *"Sin tamaño: el
    sistema no la costea"* en las que no lo tienen. Sin eso, el fallo solo se descubre meses
    después en un informe de ganancias.

## Producto terminado: los frascos que ya están armados (2026-08-14)

`inventario.terminado.ts` + migración `20260814120000_producto_terminado`.

**El problema que resolvió**: producir descontaba los materiales y vender los descontaba OTRA
VEZ. Un frasco armado por adelantado gastaba su esencia dos veces → costo del mes inflado,
ganancia falsa y esencia en negativo. Y ese stock manda también en el agotado automático, el
pedido sugerido y la campana, así que los cuatro empezaban a mentir a la vez. Salió a la luz
porque el dueño armó **9 frascos** en producción (4 de ellos "1.1") y no podía venderlos.

> **La regla**: al vender salen PRIMERO los frascos armados; si no hay o no alcanzan, se
> consumen los materiales por el resto. Y el costo de lo que sale armado es **el del día que
> se armó** (congelado), no el que tendría la receta hoy — esa plata ya se gastó.

- **Mismo patrón que los materiales**: `movimientos_terminado` es el libro y
  `perfume_presentacion.stock` / `.costo_promedio` son su PROYECCIÓN. Nunca se escriben a mano.
- **Tabla aparte de `movimientos_inventario`** porque allí `insumo_id` es obligatorio y lo dan
  por hecho todas las consultas que ya existen.
- **Entrar**: `registrarProduccion` suma la cantidad con el costo unitario del lote. La talla
  sale de `presentaciones.formula_volumen_id` (por número, no por nombre). **Sin `perfume_id`
  no suma frascos**: no se puede adivinar de qué fragancia son.
- **Salir**: `consumirPorVenta` llama a `sacarDeTerminado` antes de tocar la receta, y solo
  fabrica `cantidad − armados`. **Nunca deja el terminado en negativo**: lo que no hay, no sale
  de ahí.
- **Deshacer devuelve las DOS partes**: `revertirVenta` y `eliminarProduccion` revierten
  materiales y frascos. Revertir solo una dejaría el descuadre al revés.
- **El promedio del terminado se pondera** igual que el de una compra: armar 5 baratos y 1 caro
  no puede dejar el costo del caro.
- Cubierto por **7 pruebas** en `inventario.terminado.bd.test.ts`, escritas desde la regla:
  armar sube y baja materiales, vender no toca la esencia, vender más de lo armado fabrica solo
  el resto, sin nada armado se comporta igual que antes, y las dos reversiones.
- **Verificado contra la copia real de producción del 2026-08-14**: la migración se aplicó y los
  conteos quedaron idénticos (229 perfumes, 270 ventas, 465 líneas, 579 combinaciones, 336
  movimientos). No toca ni una fila: todo nace en 0.

### Dónde se ven (Inventario)

- **Métrica "Frascos armados"**: cuántos hay y cuánta plata representan al costo con que se
  armaron. Va **aparte** del "Valor del inventario" a propósito: son dos cifras que el dueño lee
  distinto (material que puedo usar / producto listo para vender), y fundirlas cambiaría en
  silencio un número que él ya venía siguiendo. Sin ninguna de las dos, **armar un lote parecía
  hacer desaparecer inventario**: la plata salía de los materiales y no entraba en ningún lado.
- **Tabla "Frascos ya armados"** (perfume · talla · frascos · costo c/u · valor), encima de los
  materiales porque es lo que se puede vender hoy mismo, y porque debajo de 226 renglones no lo
  vería nadie. **Se esconde sola cuando no hay nada armado**, igual que el resto de la pantalla.
- **Los negativos se muestran en rojo, no se esconden.** Aparecen si se vendió algo que no estaba
  armado o si se borró un lote ya vendido: es el criterio acordado (dejar pasar y avisar), y
  esconderlos sería avisar a nadie.
- **Borrar un lote deshace las DOS cosas** (devuelve material y quita frascos), y Producciones
  ahora lo dice antes de confirmar. No hay "editar lote" a propósito: mover frascos entre fichas
  a mano es justo donde se descuadran los costos — se borra y se vuelve a registrar.

### Y cambia cuándo se puede vender (2026-08-14)

Los frascos armados no solo cambian **qué se descuenta**: cambian **cuándo el catálogo dice que
hay**. La regla completa —contratipo por esencia, 1.1 por frascos armados, original por stock de
su botella— vive en [`reglas-negocio.md`](reglas-negocio.md#agotado-automático-las-tres-categorías-no-se-agotan-igual).
Lo que toca a este documento:

- **`perfumeInclude` trae ahora también `insumo_producto`** y el `stock` de cada talla, para que
  la regla se aplique sola en todas las consultas del catálogo.
- **Guardar la ficha de un perfume ya no borra sus frascos armados.** `editPerfume` rehacía la
  tabla de tallas entera en cada guardado; desde que esa fila lleva inventario, eso era plata
  desapareciendo en silencio (ver [`gotchas.md`](gotchas.md)).
- Cubierto por 11 pruebas de aritmética (`perfume.disponibilidad.test.ts`), 6 contra base
  (`perfume.disponibilidad.bd.test.ts`, que es la única que nota si alguien recorta
  `perfumeInclude`), 3 de edición (`perfume.edicion.bd.test.ts`) y un recorrido en navegador.

### Qué es un "1.1" (y por qué no necesitó nada nuevo)

**La receta es IDÉNTICA a la del perfume normal. Lo único que cambia es el frasco**, que trae
envase y caja de esa fragancia y cuesta muchísimo más. Medido sobre los 5 lotes reales: todos
gastan 50 ml de esencia, 48,9 de diluyente, 0,8 de sellador y 0,3 de feromonas por unidad; el
envase va de **$5.000 el normal a $33.535–$81.133 el del 1.1** (entre el 60% y el 79% del costo).

- **No necesita fórmula propia**: reutiliza la de 100 ml.
- **El envase se asigna en `perfume_presentacion.envase_insumo_id`**, que existe justo para eso.
- **Va en la categoría `1.1`** (ya existía y estaba vacía). Como la lista de precios es
  categoría × talla, ahí se le pone su precio a todos de una vez. **En `Contratipo` heredarían
  los $70.000 y dos de ellos se venderían a pérdida.**
- Precios acordados: **$120.000** de lista para la categoría y **$150.000 propio** en Bon Bon y
  Yum Yum. Márgenes reales: 55% / 45% / 41% / 45% / 31% (Yum Yum es el más ajustado).

## Pedido sugerido (`reposicion`)

Pantalla **solo informativa**: qué material hay que reponer y cuánto pedir. No mueve stock ni
registra nada. `reposicion.repository.ts` + `tabs/ReposicionTab.tsx`.

- **El punto de pedido se configura POR GAMA**, y esa es la razón de ser de todo esto. El mínimo
  por insumo existía desde antes, pero **solo 1 de 226 materiales lo tenía puesto**: ponerlo a
  mano en 219 esencias no lo hace nadie. Con el mínimo en la gama se configura una vez para las
  151 árabes.
- **Semántica de `insumos_costo.stock_minimo`, que CAMBIÓ**: `NULL` = hereda el de su gama
  (valor por defecto); `0` = sin alerta a propósito; `> 0` = su propio mínimo, que MANDA sobre
  el de la gama. La migración convirtió a NULL los ceros existentes, porque antes significaban
  "no configurado", no "no avisar".
- **Cuánto pedir**: con consumo medido, lo que cubra `DIAS_COBERTURA` (60); sin él, volver al
  doble del mínimo. El número dice de dónde sale ("por lo que gastas" / "para el colchón").
- **`ajuste` NO cuenta como consumo.** Es el conteo físico, y ahí caben el stock inicial y el
  desperdicio del día a día. Proyectar eso como demanda haría pedir de más justo el primer mes.
  Sí cuentan `venta`, `produccion`, `muestra`, `merma` y `garantia`.
- **Se dice cuando NO hay datos**: sin salidas registradas sale un aviso ámbar explicando que la
  cantidad viene del mínimo, no del consumo. Prometer precisión que no existe es peor que no dar
  el número.
- **Esencias e implementos van en tablas separadas**: se le piden a proveedores distintos.
- **Copiar al portapapeles** en el formato que pidió el dueño (`Eternity - 100 ml`), un renglón
  por material, listo para pegar en WhatsApp. **Se le quita el sufijo "– Esencia"**: existe para
  no confundir el material con el perfume DENTRO del sistema, y fuera estorba.

### Ajustar la lista antes de mandarla (`reposicion/useAjustesPedido.ts`)

- **Los ajustes viven en `localStorage`, no en la base** (decisión hablada con el dueño). Esta
  pantalla se recalcula del inventario en cada visita; guardarlos en el servidor la convertiría
  en un documento de *orden de compra* con su ciclo de vida, que es otro módulo. En el navegador
  sobreviven a cerrar la pestaña, que era lo que hacía falta.
- **Quitar ≠ resolver**: el material sigue bajo mínimo, sigue contando en la campana y en la
  alerta. Solo no entra en este pedido. Los quitados se listan al pie como chips para devolverlos
  de un clic — **nada se cae en silencio**.
- **Las cajas de arriba cuentan el pedido REAL**, no la lista cruda, y la nota lo dice ("De 55
  que tocaron su mínimo", "Con tus ajustes").
- **Los ajustes se PODAN contra la lista de hoy**: un material que ya se repuso no debe revivir
  su ajuste viejo si vuelve a bajar en tres meses.
- Siempre hay **"Volver a lo sugerido"** cuando hay ajustes.
- Verificado en navegador: 40→999 movió el total de $577.300 a $845.820; quitar uno dejó 54 de
  55; tras recargar seguían ahí; el texto copiado usó lo ajustado.

### Guardar los mínimos

- **`PATCH /inventario/minimos-gama` guarda las cuatro gamas Y DEVUELVE la lista recalculada.**
  Antes era un PATCH por gama más otra llamada para recargar: cinco viajes para un formulario de
  cuatro campos, y si una fallaba la pantalla quedaba a medio guardar (ahora va en transacción).
  - **Devolver la reposición en la misma respuesta no es un lujo de rendimiento**: cambiar un
    mínimo cambia la pantalla entera y ese cálculo necesita el consumo de 90 días, que solo tiene
    el servidor.
  - **Es PATCH, no PUT**: el CORS de esta app no permite PUT.
  - Verificado contando peticiones: **1 sola** al guardar, el modal se cierra y la lista pasó de
    55 a 91 materiales **sin recargar la página**.
- `PATCH /inventario/minimo/:id` cambia el mínimo **sin tocar existencias**. Antes solo se podía
  desde el modal de Ajustar, que es un conteo físico y deja movimiento: corregir un mínimo no es
  contar y no debe ensuciar el libro con algo que no ocurrió.

> **PATRÓN A SEGUIR — no vuelvas a pedir lo que el servidor ya te devolvió.** En el dashboard hay
> ~62 sitios que llaman a `load()`/`cargar()` después de guardar: una petición extra y un
> parpadeo de "Cargando…" cada vez. (Ojo: **nunca se recarga la PÁGINA** — no hay un solo
> `location.reload()` en el proyecto —, se vuelven a pedir los datos.) Cuando una mutación cambia
> poco, basta actualizar el estado con la respuesta; cuando cambia toda la pantalla, que el
> endpoint **devuelva el estado nuevo**. Y no hace falta redux: aquí el problema no es compartir
> estado entre pantallas sino evitar un viaje de más.

## Cotizaciones mayoristas B2B (módulo interno, 100% solo admin)

Sirve para cotizarle a quien quiere **revender**. Vive en el dashboard, sección **Mayoreo B2B**.

- **DOS TIPOS de cotización** (`cotizaciones.tipo`):
  - `detallada`: los productos concretos que se lleva el cliente (con total).
  - `general`: **lista de precios por cantidad, SIN decir qué fragancias** — para que el cliente
    vea cuánto le sale según el volumen y arme su pedido. No tiene total; la lista se congela en
    `cotizaciones.lista_precios` (JSON) al guardar. El PDF y el mensaje de WhatsApp cambian según
    el tipo.
- **NADA de costos va quemado en código**: el admin teclea sus insumos y sus tamaños. Zod rechaza
  fórmulas cuya suma supere el total.
- **Si falta un insumo, se avisa**: una materia prima no registrada cuenta $0 y la ganancia
  saldría inflada. Igual, **sin precio de venta NO se muestra "utilidad negativa"** (comparar
  costo contra cero no significa nada): se dice "falta ponerle precio". Un número alarmante sin
  explicación solo confunde.
- **Costo de producción por presentación** (`CostosProduccionTab.tsx` +
  `cotizacion/CostoDeProduccion.tsx`): cada tamaño muestra "producir uno te cuesta $X" con el
  desglose insumo por insumo y **la ganancia de cada rango de precio**. Sale del mismo motor
  puro, así que al subir el precio de una materia prima TODO se recalcula solo.
- **Motor de costeo desacoplado**: `frontend/src/application/costeoCotizacion.ts`, funciones
  PURAS (`calcularDesgloseCosto`, `sugerirPrecio`, `rentabilidadLinea/Total`). No hacen fetch ni
  tocan estado. Las materias primas se ubican por NOMBRE normalizado (contiene
  "esencia"/"diluyente"/"sellador"/"feromonas"); si falta una, cuenta 0 y no revienta.
- **Cada línea se costea con SU fragancia**: `LineasCotizacion` pasa
  `perfume.insumo_esencia_precio` como 4º parámetro. Verificado: mismo tamaño, 1 Million
  (Khamrah 1.800/ml) cuesta 5.488 y 1 Million Lucky (Mandarin Sky 617/ml) cuesta 1.939 — casi el
  triple. En 500 unidades son 1,7 millones de diferencia que antes no se veían. Si el perfume no
  tiene esencia asignada sale un aviso ámbar en la línea.
- **Accesorios: NADA estático** (el dueño lo pidió explícito — *"qué tal que mañana no sea el
  perfumero sino una tarjeta personalizada"*). Son `insumos_costo` de tipo `accesorio` y su
  columna `alcance` decide dónde pesan:
  - `unidad` (perfumero, bolsa de organza, tarjeta): cuesta por CADA perfume. Cada tamaño guarda
    los suyos por defecto en `formula_accesorios` (`PATCH /costeo/formulas/:id/accesorios`); al
    agregar una línea vienen ya marcados y se pueden ajustar para ese cliente. La marca es
    **optimista** y se revierte sola con un toast si el guardado falla.
  - `pedido` (caja de envío, un obsequio único): se cobra UNA vez por cotización completa. Vive en
    `cotizaciones.extras_pedido` (JSON) y NO entra en el costo unitario.
  - La impresora y demás equipo NO se costean aquí: amortizar activos fijos en el costo unitario
    da un número que no sirve para fijar precios.
- **El cliente sí ve lo que incluye**: el PDF lista los accesorios bajo cada producto y cierra con
  un bloque **"Tu pedido incluye"**. Solo nombres, nunca precios de costo.
- **Escalas de precio** (`escalas_precio`, por tamaño): el rango se evalúa **por línea** (cada
  producto según SU cantidad), no por el total. `cantidad_max` null = "100+". Ante rangos
  solapados gana el de mínimo más alto. Se pueden editar (`PATCH /costeo/escalas/:id`).
- **Las cifras se congelan** en la cotización (`cotizacion_items.desglose_costo` y
  `accesorios_seleccionados` en JSON): si mañana sube la esencia, una cotización vieja NO cambia
  su rentabilidad histórica. El frontend calcula y manda; el backend valida con Zod y guarda tal
  cual (nunca recalcula la fórmula).
- **REGLA DE ORO**: el desglose de costo, la utilidad y el margen son SOLO del admin.
  `utils/cotizacionPdf.ts` jamás los imprime — el cliente ve producto, cantidad, precio unitario,
  subtotal, descuento y total. Verificado en pruebas.
- PDF con jsPDF crudo, calcado de `catalogoPdf.ts`: marfil+iris, marca de agua, encabezado con
  número (`COT-AAAA-0001`, consecutivo por año) y vigencia, cliente, tabla, resumen, bloque "¿Por
  qué elegir…", condiciones comerciales y avisos legales. `{{vigencia}}` se reemplaza por los días
  reales. Usa Helvetica: el "menos" tipográfico `−` (U+2212) NO existe ahí — usar guion normal.
- Textos configurables en `cotizacion_config` (fila única). `plantillas_cotizacion` existe en el
  modelo para la Fase 2.
- Los datos del cliente van en **texto libre**: un prospecto mayorista no es un `User` del sitio
  ni una `Empresa` (que en este proyecto son PROVEEDORES).

### Margen por gama en la cotización general

`cotizacion/MargenPorGama.tsx`, visible solo cuando la cotización es `general`. Antes se cotizaba
a ciegas: el panel de rentabilidad se ocultaba entero (`tipo === 'general' ? 'hidden'`).

- Muestra, por tamaño: lo que cuesta armar UNA unidad con cada gama y el **margen en cada rango
  de precio** (ámbar bajo 35%, rojo si es negativo).
- **"¿Cómo crees que va a repartir el pedido?"**: se escriben las unidades por gama y sale el
  costo del pedido completo, el **promedio por perfume** y la ganancia al precio del rango que
  aplique según el TOTAL de unidades.
- **NUNCA viaja al PDF**. El payload de una general manda `items: []` y solo `lista_precios`.
- Si falla `GET /costeo/gamas` el formulario sigue sirviendo: se pierde el panel, no la
  posibilidad de cotizar.

> **RIESGO ACEPTADO A CONCIENCIA POR EL DUEÑO — no volver a levantarlo como hallazgo.** Con la
> lista de precios actual, un 30 ml de esencia **premium cuesta $28.106 y se cobra entre $18.000
> y $15.000** (margen de **−56% a −87%**). Las clásicas dejan 38-48% y las árabes 25-37%, y son
> las que subsidian. Verificado con datos reales: 30 clásicas + 15 árabes + 5 premium = $588.260
> de costo contra $750.000 facturados → 21,6% de margen. **Decidido el 2026-08-11: la lista se
> queda como está.** Solo hay que avisarle si (a) sube el precio de la esencia premium, o (b)
> llega un mayorista que pida casi puro premium — ahí el subsidio deja de alcanzar.

**Pendiente (paso 3, acordado con el dueño):** separar la pantalla — la RECETA se queda en
*Tamaños y fórmulas* (la usa toda la app para descontar inventario) y los rangos de precio
mayorista se van a *Mayoreo*. Hoy `formulas_volumen` mezcla las tres cosas.

## El PDF del catálogo se segmenta antes de generarlo

`ExportarCatalogoModal.tsx` + `utils/catalogoFiltros.ts`. Antes salían los 212 con todo y sin
opción; ahora se elige QUÉ va y QUÉ información lleva.

- **"Los árabes" NO es la categoría**: los 212 perfumes están en "Contratipo" y las otras dos
  categorías están vacías. La única separación posible es por gama. Verificado antes de construir.
- **La gama NO se imprime junto a cada producto**: verla al lado de la fragancia le dice al
  cliente cuál es "la barata". Cuando el catálogo va agrupado se dice UNA vez, como título de
  sección.
- **Nunca dejar caer perfumes en silencio**: el modal dice cuántos entran Y cuántos quedan fuera
  con su motivo ("se quedan afuera 25 porque no tienen esencia asignada"). Es la lección del PDF
  que salía con 100 de 212 sin que nadie lo notara. Los 25 sin esencia tienen **casilla propia
  con su número**.
- **"Solo los que puedo armar hoy"** se mide contra la talla MÁS PEQUEÑA de ESE perfume
  (`esenciaParaUno`): con 3 ml de esencia no sale un frasco de 30 ml, que necesita 15. El corte
  "stock > 0" prometería lo que no se puede hacer. Los `comprado`/`fraccionado` no se juzgan con
  esta regla. Medido: de los 137 árabes, **7 no alcanzan ni para uno**.
- **El filtrado vive en `catalogoFiltros.ts`, en funciones PURAS**, y lo usan el contador en vivo
  del modal y el generador. Si cada uno filtrara por su cuenta, el número prometido ("vas a
  exportar 137") y el documento se separarían.
- `generarCatalogoPdf` ya **no consulta nada**: recibe la lista ya elegida. Solo baja las fotos si
  van impresas — con 40 en vez de 212 la espera pasa de minutos a segundos.
- Sin precio se imprime un texto configurable (**"Precios por WhatsApp"**). Verificado: en ese
  modo **no se escapa ni una cifra**.
- La portada DICE el segmento ("Premium, Clásica") y el archivo también. Sin eso, mandar una parte
  con un documento titulado "Catálogo" le hace creer al cliente que eso es todo lo que se vende.
- La última selección se recuerda en `localStorage`.

## Inventario fase 2 — lo que queda por decidir

Lo demás de esta fase ya está construido (ver [`historial-cambios.md`](historial-cambios.md)).
Sigue vigente y **no se cambia sin volver a preguntarle al dueño**:

1. **Arma CONTRA PEDIDO, no por lotes.** Por eso NO se lleva stock de "producto terminado" como
   concepto central: **la VENTA es la que consume los insumos**. Regla para que nunca se cuente
   doble: al vender, si hay producto terminado armado se descuenta ESE primero; si no hay, se
   consumen los insumos. La `Produccion` manual queda para lo que arme adelantado.
2. **Si no alcanza el stock: deja pasar y AVISA.** La venta ya ocurrió en la vida real y
   bloquearla no la deshace, solo impide registrarla. El stock queda en negativo con alerta
   visible. Nunca en silencio: el descuadre crecería sin que nadie se entere.
3. **Perfume sin insumos configurados: NO descuenta y se lista aparte.** Obligar a configurarlos
   antes de vender frenaría el mostrador, y usar una esencia genérica descuadraría ese insumo.
4. **Originales: falta decidir con el dueño cuántos ml se pierden al trasvasar** (merma de
   fraccionamiento).
5. **Merchandising con inventario** (gorras y demás): ya cubierto por `tipo_producto = comprado`.
6. **Punto delicado pendiente**: `PerfumePresentacion` usa `presentaciones` (catálogo público) y
   el costeo usa `formulas_volumen`. Ya se enlazan por número (`presentaciones.formula_volumen_id`),
   pero conviene revisarlo antes de apoyar más lógica encima.
