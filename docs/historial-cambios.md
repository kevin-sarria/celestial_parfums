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

## Sesión del 2026-08-22: cae la parte pública y muere `cachedFetch`

La capa HTTP única (nacida el 2026-08-14, detalle en [`arquitectura.md`](arquitectura.md)) llegó
a la tienda. En un día pasó de **38 llamadas viejas repartidas en 26 archivos a 12 archivos**, y
de esos 12 dos ni siquiera son red: solo importan la constante `BASE_URL`.

- **El portal del cliente**, las **pantallas de contenido** (Blog, Sobre nosotros, reseñas
  públicas, galería de ganadores, Invita y gana) y **la tienda entera** (home, catálogo con
  búsqueda y filtros, ficha de perfume, combos, popups con sus cupones y el detector de combos
  del carrito).
- **`cachedFetch.ts` borrado.** Era `http.getCacheado` escrito por segunda vez: el mismo `Map` en
  memoria, la misma caducidad, la misma deduplicación. Y peor, porque **no miraba `res.ok`**: un
  500 llegaba a la pantalla disfrazado de dato bueno. La caducidad quedó en los 5 minutos de la
  casa.
- **`useCatalog` borrado entero** — 182 líneas y 6 llamadas del catálogo viejo del home,
  reemplazado hacía tiempo por `useDestacados` y `usePerfumes`, sin un solo import en toda la
  aplicación. Se comprobó antes de borrarlo; migrarlo habría sido mantener código muerto.
- **`usePerfumeDetail` y `useComboDetail` eran el mismo archivo dos veces.** Ahora son
  envoltorios de tres líneas sobre `useDetallePorSlug`.

**Lo que de verdad salió de levantar la tapa: estas pantallas mentían al fallar**, y en sitios
que venden. El blog prometía "pronto publicaremos contenido aquí" cuando lo que pasaba era que no
había cargado; la ficha decía "aún no hay reseñas publicadas" aunque el catálogo acabara de
contar que el perfume tiene opiniones —le quita ventas justo al mejor calificado—; y *Sobre
nosotros* y las entradas del blog **echaban al visitante a otra página** ante cualquier fallo de
red, que es indistinguible de "esto ya no existe". Ahora solo se redirige cuando el servidor
confirma que no hay nada, y un fallo se queda en su sitio y lo dice.

**Y un bug de negocio que no se buscaba: los anuncios se apagaban un día antes.** Se encontró
porque los popups no salían al verificar la migración en el navegador. `whereVigentes()` comparaba
una fecha de calendario contra un instante, así que una campaña "hasta el 22" moría a las 7 p.m.
del 21 hora Colombia. Los 4 anuncios del dueño llevaban más de un día apagados sin que nada
fallara. **El dueño decidió que "hasta el 22" incluye el 22 entero**, y la regla quedó en un solo
sitio (`utils/fechas.ts` → `hoyEnColombia()`) con 7 pruebas que fijan los bordes. Es la **cuarta
vez** que la familia de este error aparece — ver [`gotchas.md`](gotchas.md).

## Sesión del 2026-08-23: las etiquetas de los formularios

**El punto 8 de la lista, cerrado.** `Field` pintaba la etiqueta suelta y nada la ataba al campo.
Se arregló **sin tocar los 25 modales**: 159 de los 180 campos usan uno de cuatro controles
compartidos, así que el enlace se resolvió ahí y los 230 usos de `Field` no cambiaron ni una
línea. Medido en el modal de perfume: **3 etiquetas de 16 asociadas antes, 13 de 16 después**;
las 3 que quedan fuera son grupos (aromas, ocasiones, la tabla de presentaciones), donde la
etiqueta nombra un conjunto y no hay control al que apuntar — y ahí **no se inventa** un enlace
roto. El porqué del diseño (el control se anuncia hacia arriba, no al revés) está en
`campoEtiqueta.ts` y en [`diseno-ux.md`](diseno-ux.md).

**Lo que de verdad salió de esto: el arreglo empeoraba la accesibilidad de los desplegables.**
Se cayeron 7 recorridos a la vez y la causa no era la prueba: al enlazar la etiqueta, el botón
de `BuscadorSelect` pasó a llamarse "Esencia" y **dejó de decir su valor** ("Sin asignar"), que
es lo único que un lector de pantalla tenía de ese control. Ahora cita las dos cosas. Sin las
pruebas de navegador esto se entregaba como una mejora.

**Y de paso, 10 etiquetas sin tilde** que el dueño veía todos los días: "Descripcion",
"Categoria", "Genero", "Telefono", "Direccion", "Duracion", "Proyeccion", "Numero de factura o
remision", "Presentacion de los perfumes" y "Dia". Se comprobó en el navegador que se ven bien
(no era una decisión de encoding: el resto de etiquetas del dashboard sí llevan tilde).

Quedó **una prueba nueva** (`etiquetas.e2e.test.ts`, comprobada fallando sin el arreglo) y el
helper `campo()` de los recorridos pasó de seis líneas adivinando la forma del HTML a un
`getByLabel`. 260 pruebas en verde.

**Y el punto 6, también cerrado: los precios al mayoreo tienen pantalla propia.** *Tamaños y
fórmulas* guardaba dos cosas que se miran con cabezas distintas: la receta —de la que salen los
materiales que descuenta CADA venta— y lo que se le cobra a un mayorista según cuántas unidades
lleve, que solo se lee al cotizar. Juntas, se podía tocar un precio de mayoreo creyendo que se
editaba una receta. El dueño eligió pestaña propia en *Mayoreo B2B* (2026-08-23).

- **Sin migración y sin tocar un solo número.** `formulas_volumen` sigue guardando las tres
  cosas; lo que se separó es la PANTALLA, que era el problema real.
- Los **accesorios por defecto se quedan con la receta** a propósito: también se descuentan al
  vender, así que son operación, no mayoreo.
- La pantalla nueva **no crea tamaños**: sin ellos manda a *Tamaños y fórmulas* en vez de ofrecer
  un botón que no debería existir.
- `FormulasVolumenTab` bajó de **439 a 291 líneas** y el recorrido del mayoreo —que crea un rango,
  lo guarda y lo vuelve a leer del servidor— pasa contra la pantalla nueva sin cambiarle la
  comprobación: solo la dirección.

### Y un componente declarado dentro de otro, con su número

Buscando qué quedaba por codificar apareció lo que ninguna lista tenía anotado:
`EditorHtml.tsx` declaraba los **ocho botones de su barra DENTRO del editor**. Es la regla
inquebrantable que más caro sale —en un formulario se pierde el foco y lo que el usuario estaba
escribiendo—, y aquí no hacía falta romperla: el botón no usa nada del editor, solo sus props.

**Medido con un MutationObserver sobre la barra**: escribir 4 letras destruía y reconstruía
**32 botones** (los 8, en cada tecla). Después del arreglo, **0**. La prueba que se agregó
(`paginaPublica.e2e.test.ts`) NO demuestra el arreglo —también pasaba antes—: guarda lo
delicado, que es el `onMouseDown` + `preventDefault` sin el cual el botón le roba la selección
al texto y "Negrita" no aplica a nada. La barra no la tocaba ninguna prueba.

### El linter vuelve a servir: de 66 avisos a CERO

Un linter que nunca pasa deja de avisar — **el aviso 67, el que sí importa, se pierde entre los
otros 66**. Se revisaron uno por uno y salieron dos montones muy distintos:

- **26 arreglos de verdad**: los 8 botones del editor declarados dentro del editor, 3 ternarios
  usados como instrucción (`cond ? a() : b()`, que se lee como una condición y es un `if`
  disfrazado), 3 `any` —dos `catch (err: any)` que pasaron al idioma que ya usa el resto del
  proyecto (`err instanceof Error`) y uno que tapaba una respuesta anidada que el comentario de
  al lado YA explicaba—, y 13 directivas `eslint-disable` muertas.
- **40 de dos reglas que no encajan con este código**, apagadas enteras y explicadas en
  `eslint.config.js`: `set-state-in-effect` (las 26 coincidencias son la forma en que esta
  aplicación carga datos sobre su capa HTTP propia; obedecerla significaría meter una librería de
  datos y contradecir una decisión de agosto) y `only-export-components` (comodidad de recarga en
  caliente; las 14 son archivos que guardan un componente y su ayudante juntos **a propósito**).

**Al quitar las directivas muertas se borró de más**: en `PagosTab` había una que sí hacía su
trabajo y el linter la volvió a pedir en el acto. Se devolvió con su explicación. Es el argumento
a favor de dejar el linter en cero: **avisó al instante**.

**Y los 55 archivos con BOM**, quitados **en binario** —los 3 bytes y nada más—. Cualquier
lectura-y-reescritura de texto en Windows se lleva por delante las tildes o los saltos de línea, y
este proyecto ya se quemó ahí antes.

## Sesión del 2026-08-25: el alta de productos deja de ser un formulario para todo

Sale de dos cosas del dueño el mismo día: una captura del formulario del catálogo con la pregunta
de por qué seguía igual, y una barrera concreta — *"es una barrera grande"*, textual — tenía **5
frascos 1.1 armados y ninguna forma de registrarlos**. Diseño completo en
`docs/superpowers/specs/2026-08-25-alta-de-productos-por-tipo-design.md`. Sin migración: todo es
código.

**1. La carga inicial de frascos ya armados.** El único camino para que un frasco armado existiera
era producirlo, y producir descuenta la receta — pero esa esencia se gastó hace semanas y él, al
inventariar, contó solo el líquido suelto. Descontarla otra vez le habría dejado las esencias en
negativo por un gasto ya restado. **La barrera no era una regla, era un camino que faltaba.** El
motor ya sabía hacerlo (`movimientos_terminado` acepta `ajuste` desde el 2026-08-14); faltaban el
endpoint y la pantalla. Queda anotada como ajuste y **nunca** como producción: un lote que no
ocurrió no puede aparecer en Producciones ni sumar al costo del mes.

**2. El alta del 1.1 desde donde se arma.** Es el tercer hermano de un patrón que ya funcionaba
dos veces (crear el perfume de una esencia, crear el accesorio de un material) y hereda sus dos
reglas: nace fuera de la tienda, y **un nombre que ya existe no se toca — se avisa cuál es**. Eso
último se comprueba con tildes y mayúsculas distintas, que es como acabarían naciendo "Bon Bon
1.1" y "bon bón 1.1" con el stock partido en dos fichas.

**3. Cuatro puertas en vez de un formulario de ~16 campos.** La pregunta que decide qué campos
aplican vivía en la casilla once, así que dar de alta una bolsa de organza obligaba a pasar por su
duración y su proyección. **Medido con una prueba que cuenta las casillas en pantalla, no a ojo**:
un accesorio pide 5 y una fragancia 8. Los cuatro tipos se **deducen** de los datos que ya
existían (`tipo_producto`, `solo_armado`, `es_accesorio`) en vez de guardarse en una columna
nueva: una copia se desincronizaría el día que el producto se edite por el Excel o por el alta
desde el lote, y entonces la ficha mostraría los campos equivocados.

**Y el defecto de los envases en cero**, que el dueño había encontrado dos días antes: 7 de sus 12
envases están en cero y todos aparecían mezclados con los demás, como si hubiera. Ahora lo que hay
va arriba con "quedan 24" y lo que está en cero cae al final, en gris y diciéndolo. **No se
esconden**: registrar hoy un lote de la semana pasada es legítimo. La regla vive en una sola
función pura (`opcionesPorExistencias`) que usan las dos pantallas que consumen envases, y el
desplegable ganó dos campos opcionales (`nota`, `atenuada`) **separados del nombre**, para que el
buscador no filtre por ellos ni se cuelen dentro del valor elegido.

## Sesión del 2026-08-29: la fusión de materiales duplicados

**El despliegue.** El dueño desplegó todo lo acumulado desde el 2026-08-23: regalos, alta de
productos por tipo, catálogo en dos pestañas, editar lotes, el enlazador que crea la ficha 1.1,
envases en cero, anuncios, backend sin `any`, mayoreo aparte y etiquetas.

**La auditoría de los 1.1.** Con el código y sus datos delante salieron cinco huecos, dos con
plata encima: vender un 1.1 sin frascos armados lo fabrica de material, y una ficha 1.1 recién
creada puede nacer con el precio del perfume corriente. Aprobó arreglar tres; están en
`pendientes.md` sin empezar.

**Alertas de inventario y materiales "en prueba".** Dos quejas suyas que resultaron ser la misma
pieza: el pedido sugerido le pedía reponer una esencia que trajo para probar, y quería un aviso
grande y configurable. La decisión que las une: **el mínimo de la familia y el umbral del aviso son
el mismo número**. Pantalla propia, cascada de mínimos con tres escalones (material → gama →
familia) y el aviso arriba de cualquier pestaña, en franja o en ventana según él elija. Trae
migración.

**El deploy a medias.** Se descubrió midiendo su respaldo: el `git pull` del 29 entró sin
`migrate deploy`, y el código nuevo pedía dos columnas que no existían. No falló la función nueva
—falló la pestaña Producciones entera—, y por eso llevaba días sin poder crear una ficha 1.1
creyendo que la función estaba mal hecha. La lección quedó escrita en el runbook de
`deploy-migraciones.md`, con el comando de un minuto que lo detecta.

**Fusionar dos registros del mismo material.** Construido entero (pruebas de base, recorrido en
navegador, pantalla). Lo que lo hizo posible fue un hecho del inventario que no estaba escrito en
ningún sitio: **`stock` es una columna guardada, no una suma del libro**, así que re-apuntar 400
movimientos viejos no descuenta 400 unidades. Ese era exactamente el miedo del dueño, y era
infundado — pero nadie lo sabía hasta mirarlo.

Tres cosas que aparecieron al construirlo, y que se quedan:

- **La lista de dónde cuelga un insumo estaba escondida dentro del borrado.** Salió a
  `insumo.usos.ts` y ahora la comparten el borrado (para bloquear) y la fusión (para mudar).
- **Un octavo sitio que el borrado no miraba**: los accesorios guardados dentro del JSON de cada
  talla, que la venta lee **viva**. Una fusión que no lo reescribiera dejaría ahí un id borrado y
  la siguiente venta de esa talla reventaría en la caja.
- **Las ~400 ventas con perfumero no existen como movimientos**: el consumo por venta no es
  retroactivo, así que el libro solo tenía 15 salidas. La fusión no puede inventar historia que
  nunca se escribió.

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

## Editar lotes, enlazar los 1.1 y publicarlos (2026-08-25)

Tres pedidos del dueño en la misma frase, construidos en este orden (diseño en
`superpowers/specs/2026-08-25-editar-lotes-y-enlazar-1.1-design.md`, plan en
`superpowers/plans/2026-08-25-editar-lotes-y-enlazar-1.1.md`):

1. **El costo promedio del terminado se reconstruye del libro.** No estaba pedido: es el cimiento.
   Revertir un lote restaba las unidades y dejaba el costo del lote borrado mintiendo, invisible
   mientras borrar era raro y rutina desde que el lote se puede editar.
2. **El rastro de las ediciones**, como frase ya redactada y no como ids.
3. **`editarProduccion`**: deshacer y rehacer en una transacción, con `aplicarLote` compartida con
   el alta. Trae la migración `20260825120000_editar_producciones` (`costo_manual`, `historial`).
   De paso, las producciones salieron a `inventario.producciones.ts` (el repositorio de inventario
   se iba a 599 líneas).
4. **`PATCH /inventario/producciones/:id`** y **el lápiz en Producciones**, con el costo pisable y
   el aviso de los frascos ya vendidos.
5. **La ficha 1.1 hereda del perfume corriente** (copia, no enlace) y se publica sin cambiar de
   pantalla.
6. **El enlazador**: dos reglas comprobables, sin motor propio.

**Qué se descartó por el camino**, con su razón:

- *Editar solo la ficha del lote* (lo mínimo para arreglar el Khamrah): el dueño pidió poder
  ajustar también material, cantidad y costo.
- *Correcciones contables encima, sin borrar movimientos*: correcto para una contabilidad
  auditada, ruido para una operación de una persona.
- *Enlace vivo entre el 1.1 y su corriente*: obligaría a decidir cuál manda el día que se separen.
- *Detectar los 1.1 por el nombre*: un "Set 1.1" bastaría para que la lista mintiera.

## Sesión del 2026-08-29: fusionar materiales, alertas y la lógica de los 1.1

Tres bloques en el mismo día, los tres salidos de que el dueño usara el sistema con sus datos.

1. **Fusionar dos registros del mismo material** (`superpowers/specs/2026-08-29-fusionar-materiales-design.md`).
   Tenía dos fichas del mismo perfumero, las dos con historia, ninguna borrable. Lo que lo desbloqueó
   fue un hecho del diseño ya existente: `insumos_costo.stock` es una **columna guardada**, no una
   suma del libro, así que re-etiquetar movimientos viejos **no los vuelve a ejecutar**.
2. **Alertas por familia y materiales "en prueba"** (`superpowers/specs/2026-08-29-alertas-y-en-prueba-design.md`).
   La decisión que las une: el mínimo del pedido sugerido y el umbral del aviso **son el mismo
   número**; guardarlo dos veces garantiza que un día digan cosas distintas.
3. **Los tres arreglos de los 1.1** (`superpowers/specs/2026-08-29-logica-1.1-design.md`), tras
   auditar esa lógica entera a petición suya:
   - Vender un 1.1 sin frascos armados **lo fabricaba** (descontaba esencia + envase). Ahora se
     registra, queda en negativo y se avisa. De paso, los avisos del inventario —que existían y
     **no los leía nadie**— salen por fin en pantalla, en ventas y en créditos.
   - El 1.1 recién creado podía **heredar en silencio** el precio del corriente. Ahora el precio se
     ve antes de crear, en rojo si no hay lista, y aceptar el de la lista **no** guarda precio propio.
   - La disponibilidad pasó a mirarse **por talla**: sumarlas hacía que un frasco de 50 ml pusiera
     disponible el de 100 ml.

**Lo que se aprendió del despliegue de ese día**, y que quedó en `gotchas.md`: `migrate dev` en el
servidor ofrece borrar la base (ahora hay freno de mano), y el frontend puede quedarse viejo sin que
nada falle —se detecta midiendo la fecha del `index.html` que sirve el servidor, no recargando el
navegador—.

## Sesión del 2026-08-30: la maceración

La pieza más grande que quedaba pendiente, y la que el dueño necesitaba antes de pasar de una
maceración suelta a **macerar las 10 referencias más vendidas**: con diez graneles en curso,
aproximar cada uno como "N frascos de 100 ml" deja el inventario y los costos inservibles.

Se construyó tal cual el diseño del 2026-08-24, con dos correcciones que aparecieron al hacerlo:

1. **El envasado no tiene motor propio.** Reutiliza `registrarProduccion` porque un envasado ES un
   lote, solo que con `maceracion_id`; con tanda, `aplicarLote` no cobra materiales de líquido y en
   su lugar suma `ml de la talla × costo_ml`. Copiar el motor habría dejado dos versiones de la
   misma regla, y la de envasar se habría quedado atrás a la primera.
2. **Al convertir un lote viejo, la tanda vale solo el líquido.** Los envases y accesorios vuelven a
   la repisa y su plata se va con ellos; dejarla dentro del granel los haría pagar **dos veces** al
   envasar de verdad. Lo cazó una prueba, no una revisión a ojo.

De paso: `TipoMovimiento` dejó de ser una lista escrita a mano y sale del enum de Prisma (al agregar
`maceracion` al esquema, la copia se habría quedado atrás), y la búsqueda de diluyente/sellador/
feromonas por nombre —que estaba duplicada entre la venta y la maceración— salió a
`materialesGenerales.ts`.

## Sesión del 2026-08-30: la garantía que no movía nada

De la auditoría de los 1.1 quedaba un agujero que aplicaba a todo el catálogo: **resolver una
devolución no tocaba el inventario**. Reponer un frasco lo sacaba de la repisa del dueño y no de su
sistema, y el que el cliente devolvía no volvía nunca a estar disponible. En un negocio de 10
frascos por referencia, eso es la diferencia entre poder vender y prometer lo que ya no existe.

**La decisión de diseño fue del dueño y fue la buena.** Se le ofrecieron tres caminos y se le
recomendó el de deducirlo del motivo con una tabla fija (menos preguntas). Eligió el otro:
preguntar caso por caso. Tenía razón — un *"llegó equivocado"* puede volver abierto y un *"llegó
dañado"* puede ser solo la caja. El motivo dice por qué se quejó el cliente, no en qué estado
llegó el frasco, y adivinarlo habría metido frascos rotos al stock vendible.

Tres cosas que aparecieron al construirlo:

1. **El tipo de movimiento no podía ser `venta`.** Revertir busca por `(tipo, referencia_id)`: con
   los dos bajo el mismo tipo, la venta 7 y la devolución 7 serían el mismo movimiento y deshacer
   una borraría la otra. Se reusó `garantia`, que ya existía en el enum.
2. **Un caso puede nacer resuelto.** El formulario deja registrar *"se lo repuse ayer y lo anoto
   hoy"*, y `crearDevolucion` no aplicaba inventario: solo lo hacía el cambio de estado. Se
   arregló metiendo la creación en su transacción, con su prueba.
3. **Lo que vuelve entra al costo promedio de hoy**, no al del día de la venta: es un frasco
   idéntico a los de la repisa y valorarlo distinto partiría en dos el promedio de esa ficha.

De paso, `mostrarAvisos` se movió de `pages/dashboard/pedido/` a `application/`: ya no es cosa del
pedido, lo usan ventas, créditos y ahora las garantías.
