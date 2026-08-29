# Diseño y UX (respetar SIEMPRE)

Estética, componentes compartidos y las decisiones de maquetación que el dueño ya corrigió.
Cambiar cualquiera de estas sin preguntarle es volver a un rechazo que ya ocurrió.

## Design system

- shadcn/Tailwind, paleta **marfil + iris** (`bg-card`, `text-primary`, `bg-brand-soft`,
  `text-ink`), tipografías **Fraunces** (display) / **Manrope**. **Solo modo claro.**
- Estética "sobria": cards minimalistas, sin exceso de info. Inputs/selects: `rounded-md
  border-input bg-card shadow-xs` + focus ring de 3px (`ring-ring/50`). Copiar clases de
  `ui/input.tsx` / `ui/select-simple.tsx` al crear controles.
- Notas olfativas con colores estilo Fragrantica: `domain/entities/aroma.colors.ts`
  (fallback determinístico por hash para aromas nuevos).
- Símbolos de género con selector de texto U+FE0E (`♂︎`) o iOS los vuelve emoji.
- Grillas de catálogo: `sm:grid-cols-[repeat(auto-fill,minmax(16rem,18rem))]` — las cards
  nunca se estiran más de 288px (mismo ancho del carrusel). Datos faltantes en cards: las
  filas se colapsan (no reservar espacio vacío); footer anclado con `mt-auto`.
- **El iris de marca `#524276` NO sirve como color de gráfico** (muy oscuro, croma bajo).
  Para barras: `#8661cc` y `#c78200`, validados con el script del design system.

## NINGÚN `<select>` de HTML en toda la aplicación

Regla ampliada el 2026-08-13; nació el 2026-08-09 al encontrarse las 216 esencias en un
select nativo: se recorren a ojo, la lista se despliega hasta el borde de la pantalla y no
se puede buscar. Los 58 selects que había eran nativos: cerrados se veían bien, pero al
abrirlos desplegaban la lista del SISTEMA OPERATIVO en medio de una pantalla marfil e iris.

- **6 opciones o más, o una lista que crece con el negocio** (esencias, perfumes, insumos,
  clientes) → `components/BuscadorSelect.tsx` (combobox con buscador DENTRO del panel, alto
  acotado; modo valor único con `value`, modo "agregar varios" sin `value`).
- **2 a 5 opciones fijas** (unidad, género, modo de IVA) → `ui/select-simple.tsx`
  (**`SelectSimple`**, antes `NativeSelect`). Ya **no** es un `<select>` del sistema por
  dentro: pinta el mismo panel de la aplicación y el buscador solo aparece a partir de 6
  opciones. Conserva la API del select (`<option>` y `e.target.value`), que es lo que
  permitió cambiar los 58 sitios sin tocarlos uno por uno. Se renombró a propósito: llamar
  "NativeSelect" a algo que ya no es nativo es una trampa para el siguiente que lo lea.
- Multi-select: control arriba, chips de lo elegido DEBAJO.
- **`cierranPanel`** (opcional en `BuscadorSelect`): ids que cierran el panel aunque esté en
  modo "agregar varios". Nació de un defecto real: al elegir "+ Crear insumo nuevo" la lista
  se quedaba abierta y tapaba el formulario que acababa de aparecer debajo. El modo "agregar"
  mantiene el panel abierto a propósito para encadenar elecciones, pero una opción que ABRE
  otra cosa no es una elección más.
- **`nota` y `atenuada`** (opcionales en cada opción de `BuscadorSelect`): letra pequeña a la
  derecha y opción en gris. Van **separadas del nombre** a propósito — pegadas al texto, el
  buscador las encontraría al filtrar (escribir "24" sacaría envases) y el campo cerrado se
  llevaría la nota dentro del valor elegido. Ver la regla de abajo, que es de donde salieron.
- **Un desplegable que va a CONSUMIR existencias dice cuántas quedan** (2026-08-25):
  `opcionesPorExistencias` (en `domain/entities/insumo.ts`) pone arriba lo que hay —con
  "quedan 24"— y manda al final, en gris y con "sin existencias", lo que está en cero o en
  negativo. **No los esconde**: registrar hoy un lote de la semana pasada, cuando sí había
  envase, es un caso legítimo, y esconderlos lo bloquearía. El aviso de que el stock quedará
  negativo lo sigue dando el panel ámbar del modal, al pie. Lo pide el dueño desde el
  2026-08-23; el detalle del porqué, en [`inventario-costeo.md`](inventario-costeo.md).
- Al revisar una pantalla, comprobarlo: es el fallo que más se repite y se cuela porque con
  3 datos de prueba el select nativo se ve bien.
- **Excepción**: un `<select>` solo sirve si el dato guardado SIEMPRE está entre sus
  opciones. Para texto libre (`ventas.presentacion`) va `<input list=…>` + `<datalist>` —
  ver el bug en [`gotchas.md`](gotchas.md).

### Detalles del panel que no se pueden quitar

- **El panel se pinta en un PORTAL colgado del propio diálogo**, no del `<body>`. Dos fallos
  que solo se ven dentro de un modal:
  1. **Radix apaga los clics de todo lo que cuelga del `<body>`** mientras hay un diálogo
     abierto: el panel se VEÍA pero no respondía. Necesita `pointer-events` en auto y, sobre
     todo, colgar del diálogo.
  2. **Radix atrapa el foco.** Resolviendo el anfitrión DESPUÉS del primer render, el panel
     se remontaba y el buscador perdía el foco: las letras se iban al campo anterior. Un
     recorrido guardó el nombre del cliente como `"Cliente del recorridoVentas 1"` — ese es
     el síntoma. Ahora el anfitrión se resuelve **al abrir**.
- **El ancho Y EL ALTO los manda el CONTENEDOR, no el botón.** Los selects angostos (la talla
  de una línea de venta lleva su propia clase de ancho) quedaban con el botón encogido pero la
  caja y la lista midiendo el ancho completo. **Medido en el recorrido de la venta: el panel y
  el campo no pueden diferir más de 2 px.**
  - **El botón no puede fijar su propio alto** (2026-08-14). Tenía `h-9` mientras el
    contenedor recibía el `h-8` que le pasaba la pantalla: el botón de 36 px quedaba dentro de
    una caja de 32 px y **sobresalía 4 px**. Como el panel se coloca desde el borde inferior
    del CONTENEDOR, se abría pegado al campo — medido, **1 px de aire en vez de 4**. Ahora el
    botón va con `h-full` y el contenedor lleva el `h-9` por defecto, que el llamador puede
    pisar. Cubierto por `desplegable.e2e.test.ts`.
  - **La tipografía NO se hereda del contenedor**: el botón conserva su `text-base md:text-sm`
    del design system. Una clase suelta tipo `text-[12.5px]` en el llamador **no hace nada**
    (`md:text-sm` gana por variante), así que es código muerto: si el texto no cabe, se ensancha
    el campo, no se encoge la letra.
- **Escape cierra el DESPLEGABLE, no el formulario.** `stopPropagation` desde dentro del
  panel **llega tarde**: Radix escucha Escape en fase de CAPTURA, antes que cualquier hijo.
  Se resuelve en `Modal.tsx` con `onEscapeKeyDown` mirando si hay un `[role="listbox"]`
  abierto — que es donde Radix acepta que le digan que no actúe.

## Modales (`Modal.tsx`)

**Encabezado y pie ANCLADOS.** El `overflow-y-auto` estaba en el modal entero, así que al
bajar por un formulario largo se iban con el contenido el título, la X y los botones de
guardar: quedabas a media pantalla sin saber qué editabas ni cómo salir. **Un cambio arregló
los 25 modales del dashboard sin tocar ninguno.** Detalles que no se pueden quitar:

- `min-h-0` en el cuerpo (sin él un hijo flex se niega a encogerse y el scroll se va otra vez
  al modal entero),
- el `<form>` tiene que SER la columna (si no, el botón de guardar del pie queda fuera del
  formulario),
- `DialogContent` va **sin `overflow-hidden`**, porque el panel del desplegable cuelga del
  diálogo y tiene que poder salirse del borde.

## Avisos al usuario (toasts)

Se usa **sonner**, el toast oficial de shadcn (`components/ui/sonner.tsx` con el `<Toaster/>`
montado UNA vez en `App.tsx`). En cualquier vista: `import { toast } from 'sonner'` →
`toast.error(msg)` / `toast.success(msg)`. **No inventar un toast propio**: sonner ya
resuelve apilado, colapso, deslizar para descartar, accesibilidad y animaciones (se probó una
implementación casera y se descartó: apilaba avisos duplicados y en móvil se montaba sobre el
formulario).

- **`richColors` se QUITÓ y no hay que reactivarlo.** Lo rechazó el dueño: *"se ve feísimo
  […] no tiene nada que ver ese estilo con el resto de mi app"*. La causa es concreta:
  `richColors` pinta con **la paleta de sonner** —verde menta, rosa saturado— que no conoce
  el marfil ni el iris. En su lugar: **fondo marfil siempre**, tinta violácea, Manrope, y el
  **color solo en el icono y en una franja lateral de 4px** — iris para lo bueno, rojo para
  lo que falló, ámbar para lo que hay que mirar.
- **Las clases van con `!`**: sonner trae sus colores en variables propias y sin la marca de
  prioridad gana la librería.
- **`!items-start` y `!text-left` no son cosmética**: sonner centra el contenido, y los
  mensajes del servidor son de varias líneas — centrados quedan ilegibles y el icono flota a
  media altura.
- **UNA sola caja, siempre.** La tarjeta (fondo, borde, redondeo y sombra) la pone el
  contenedor de sonner; un `toast.custom` aporta **solo su contenido**. Nada de
  `border`/`bg-card`/`shadow` en el div raíz de un toast propio, o queda una caja dentro de
  otra.
- **El aspa va DENTRO de la caja**, arriba a la derecha. Exige dos anulaciones, y las dos se
  cazaron midiendo, no mirando:
  1. **`!transform-none`** — sonner la desplaza con `transform: translate(-35%,-35%)` y las
     utilidades `translate-*` de Tailwind v4 NO lo anulan (escriben otra propiedad). Sin esto
     quedaba 8px fuera de sitio.
  2. **`!p-3.5 !pr-12`** — sonner impone `padding: 16px`; el `pr` no aplicaba y en los
     mensajes largos **el texto pasaba por debajo del aspa: 22px de solape**.
  Resultado verificado: 0-2px de desalineación con el texto, 15px a cada borde y 10px de aire
  entre el texto y el aspa.
- **Lección de método**: al estilar una librería con Tailwind, comprobar el valor COMPUTADO
  (`getComputedStyle`) en vez de confiar en que la clase se aplicó. Dos de tres ajustes de
  este toast no estaban haciendo nada.
- **Deduplicar los avisos repetibles**: `toast.error(msg, { id: msg })` — si el usuario pulsa
  el botón varias veces, el aviso se reemplaza en vez de apilarse (probado: 6 clics = 1 aviso).
- `window.alert()` queda deprecado en el dashboard: usar toast. `window.confirm()` sí sigue
  para confirmar borrados.

## Agregar al carrito NO abre el carrito

Lo pidió un cliente real: abrir y cerrar el panel en cada producto **cansa y corta el impulso
de seguir comprando**. Lo que hacía falta no era el carrito entero, sino la certeza de que la
acción funcionó.

- `addItem` (`CartProvider`) ya **no** hace `setIsOpen(true)`: llama a `avisarAgregado(item)`
  (`components/avisoAgregado.tsx`), un `toast.custom` con la foto del producto en 44px, el
  nombre (con `2×` si van varios) y talla · precio.
- **Sale abajo al CENTRO**, no en la esquina como el resto de avisos (`position` por toast):
  en la tienda esa esquina la ocupan los botones flotantes de carrito y WhatsApp, y el aviso
  les caía encima justo cuando el cliente quiere ver que el contador subió. En el dashboard
  no hay FABs, así que ahí se queda como estaba.
- Se deduplica con `id: 'carrito-agregado'`.
- **Trampa que esto destapó**: el recordatorio "Tu pedido te espera" (`CartFab`) funcionaba
  **de casualidad** — al agregar, el panel se abría y eso lo cancelaba. Sin panel, saltaba
  justo después de agregar. Ahora la marca de sesión vive en
  `application/carritoRecordatorio.ts` (`recordatorioPendiente` / `cerrarRecordatorio`),
  `addItem` la cierra, y el temporizador **la vuelve a mirar al disparar**, no solo al
  programarse. Verificado en los 3 casos.
- **Ojo con el linter de React** al tocar `CartFab`: `react-hooks/set-state-in-effect` analiza
  TODO el componente, así que agregarle un `useState` de más hace que marque efectos que antes
  no marcaba, sin que nada esté mal. Por eso el "ya tocó el carrito" se resolvió con la marca
  de sesión y no con estado nuevo.

## Acciones de una fila: la del día visible, el resto en `⋯` (2026-08-14)

Lo pidió el dueño mirando la tabla de perfumes: *"busca la manera de que esas opciones se
vean estéticamente mejor, como por ejemplo poner un símbolo de los tres puntos suspensivos y
de allí se despliegue un dropdown"*, y con una condición explícita: **nada de meter un
interruptor dentro del desplegable, que se vería mal**.

La fila llevaba un interruptor deslizante + dos badges que parecían botones + miniatura + dos
iconos: seis cosas por renglón × 212 filas. Es el **defecto 14** del catálogo
(`dashboard-interno-ux/references/defectos-comunes.md`) aplicado a una fila.

- **Las tablas tienen columnas de verdad, con su encabezado**: `Imagen | … | Estado |
  Acciones`. La foto y el estado eran un añadido colgado de la celda de acciones, sin
  encabezado, y la tabla terminaba en una cabecera vacía como si algo se hubiera cortado.
  - **El encabezado "Acciones" lo pone `SmartTable`**, no cada pestaña: un cambio en la pieza
    compartida y las **10 tablas** del dashboard quedan iguales.
  - `columnaImagen()` (en `columns.tsx`) es la columna de foto, compartida por Perfumes y
    Combos. Dibuja un recuadro punteado cuando NO hay foto: si la celda quedara vacía la
    columna se vería rota, y "sin foto" es justo lo que hay que cazar en el catálogo. Además
    se puede **filtrar por "con foto" / "sin foto"**.
  - La columna de estado se llama **Estado**, y al ser columna se puede **ordenar y filtrar**
    por ella — que es como se repasa "muéstrame lo que está fuera" en 212 filas.
- **`perfumes/EstadoPerfume.tsx`** — el estado, de solo lectura. **Solo se marca lo que NO
  está normal**: `Fuera de la tienda` (ámbar), `Agotado`, `Sin esencia`. Escribir "En la
  tienda · En stock" en las 212 filas no informa de nada y obliga a leer renglón por renglón;
  sin etiqueta = todo en orden, y el ojo cae solo en las excepciones.
- **`perfumes/AccionesPerfume.tsx`** — un `⋯` con **todas** las acciones de la fila: editar,
  sacar/devolver de la tienda, marcar agotado/disponible y eliminar. Cada una con su nota
  corta debajo, como en `MenuAcciones`.
- **REGLA, que sale de contar las tablas del dashboard**: con **2 acciones** por fila (editar
  y borrar) van los iconos sueltos — así están las otras 9 tablas y ahí está bien; con **3 o
  más**, todas al menú. Perfumes tiene cuatro.
- **Editar va DENTRO del menú, y de primero.** Se probó dejar el lápiz fuera razonando que es
  la acción más frecuente, y el dueño lo corrigió con razón: un menú que no contiene la acción
  principal deja de ser *"todo lo que le puedo hacer a esta fila"* y pasa a ser *"algunas
  cosas"*, que es lo peor de los dos mundos. Y en un catálogo de 212 perfumes, editar tampoco
  es una tarea de todos los días. **Una fila, una puerta.**
- **Ningún control de estado dentro del menú**: son opciones de menú normales que ejecutan la
  acción, no interruptores incrustados.
- **Sacar de la tienda sigue pidiendo confirmación** (decisión del dueño, sostenida ese día):
  es de cara al público y nada más lo grita. Marcar agotado no la pide — confirmar todo enseña
  a pulsar "sí" sin leer y la confirmación deja de proteger (defecto 8).

## Maquetación de una pestaña del dashboard

El dueño rechazó tener el título, los botones, las métricas, el buscador y la tabla dentro de
la misma tarjeta: *"se ve pésimo y nada similar a un dashboard serio"*. El orden correcto:

1. **`EncabezadoPagina`** — solo el título y su contador, fuera de la tarjeta.
2. **`FranjaMetricas`** + **`StatCard`** — rejilla (no `flex-wrap`, para que queden del mismo
   ancho) sobre el fondo de la página. `StatCard` va en **`bg-card`**: antes era
   `bg-background` DENTRO de una tarjeta blanca, o sea al revés, y parecía un hueco hundido.
   `StatCard` acepta `nota` para el matiz que no cabe en la etiqueta.
3. **`Section`** con la tabla **y nada más**.
4. **Los botones que actúan SOBRE la tabla** (crear, importar, exportar) van en la prop
   `acciones` de `SmartTable`, dentro de su barra y **al lado opuesto del buscador**. Sueltos
   junto al título se leen como acciones de toda la página y dejan una banda de botones sin
   caja. Esto lo corrigió el dueño explícitamente.

Aplicada en las 14 pestañas. La única excepción es **Tamaños y fórmulas**, que no tiene tabla
sino una rejilla de tarjetas: ahí sus botones van en el `EncabezadoPagina`. Los botones que
configuran TODA la pantalla (ej. los mínimos por gama en Pedido sugerido) también van ahí.

**OJO — "no hay barra" casi nunca es una razón válida, es un síntoma.** A Inventario se le
documentó esa misma excepción y era falsa: no tenía barra porque su tabla estaba escrita a
mano en vez de usar `SmartTable`. En cuanto se convirtió, apareció la barra y la excepción se
cayó sola. **Antes de escribir una tabla a mano, comprobar que `SmartTable` no sirva** — si no
se usa, la pantalla pierde de golpe buscador, orden, filtros, columna #, paginación y vista de
celular, y se nota a simple vista que no pertenece al mismo dashboard.

## UNA PANTALLA, UNA TABLA

Al convertir Inventario quedaron dos tablas apiladas —insumos arriba, lotes de producción
abajo— y el dueño lo rechazó: *"se ve como trabajo de practicante, no como diseño de un
dashboard profesional"*. El historial de lotes salió a su **pestaña propia `producciones`**.

- Criterio: Inventario responde **"qué tengo"**, Producciones responde **"qué armé"**. Son
  preguntas distintas y no comparten pantalla.
- Se eligió pestaña y no modal porque en este dashboard **todo es una pestaña**: un modal
  sería la excepción rara, y los lotes son historial contable que merece URL propia.
- El botón para registrar un lote **sigue en Inventario** (es donde está el material), y su
  aviso de éxito dice "Lo ves en Producciones" para que nadie lo busque donde ya no está.
- **Regla general**: si una pantalla necesita una segunda tabla, casi siempre son dos
  pantallas. Antes de apilarlas, preguntarse qué pregunta responde cada una.

## Agrupar botones: `ExportMenu` y `MenuAcciones`

- **`ExportMenu`** (`components/ExportMenu.tsx`) agrupa varias descargas de Excel y el
  importar en UN solo botón desplegable. Nació en Inventario, que tenía 3 exportaciones + 1
  importación + 3 acciones de negocio: siete botones no caben en una barra. La lógica de
  descarga vive en `useExportEntity` y la comparte con `ExportButton`. Regla: **bajar Excel es
  MANTENIMIENTO, no la tarea del día** — cabe detrás de un clic; lo que no puede esconderse
  son las acciones reales (registrar llegada, producción, salida).
- **`MenuAcciones`** (`components/MenuAcciones.tsx`) es el hermano genérico: agrupa acciones
  emparentadas bajo un botón desplegable. Nació porque la barra de Inventario llegó a **seis
  botones del mismo peso**. Quedó en cuatro: `[Excel ▾] [Materiales ▾] [Registrar uso ▾]
  [Registrar llegada]`, con **una sola acción destacada**.
  - Cuál se destaca **se elige mirando los datos, no por intuición**: hay 61 compras
    registradas contra 0 producciones, así que la del día a día es registrar la llegada.
  - El agrupado es **por la pregunta que responde cada acción**: *Materiales* = dar de alta y
    clasificar; *Registrar uso* = material que salió (armar perfumes, muestra o daño).
  - **Los nombres van en el idioma del negocio.** El menú NO se llama "Movimientos": esa
    palabra es del sistema y el departamento de Diseño la rechaza explícitamente.
  - Cada opción lleva su nota corta ("Descuenta la receta del tamaño"), que es lo que evita
    tener que explicar el botón.
  - **Al agregar una acción a Inventario, entra en el menú que le corresponda; no se suma
    otro botón a la barra.**
- **La configuración se esconde tras un botón y se guarda de una sola vez.** Los mínimos por
  gama estaban desplegados como una franja con cuatro casillas y cuatro botones "ok"; ahora
  son un modal. Es configuración: se toca una vez y luego se consulta la lista cien veces.

## Arranque guiado (primeros pasos de un módulo)

Nació de una observación del dueño: *"el flujo lo siento muy rígido e ineficiente; una persona
que no entiende de tecnología poco entendería cómo hacer las cosas"*. Skill de método:
**`arranque-guiado`**.

- **`PrimerosPasos.tsx`** (arriba en Inventario): lista de 4 pasos que **se esconde sola**
  cuando están hechos. `GET /inventario/primeros-pasos` devuelve los 4 contadores.
- **El progreso se deduce de los DATOS, nunca de una bandera** `onboarding_completado`: esa
  mentiría al primer Excel importado, y quien ya trabaja no debe ver la caja jamás. Verificado
  insertando un movimiento a mano en la base: el paso se marcó solo.
- **Solo hay UN orden obligatorio**: contar el stock ANTES de la primera compra (con stock 0
  el promedio se fija al precio de esa compra). El paso 3 **avisa en ámbar, NO bloquea**:
  imponer orden donde no hace falta es la rigidez que el dueño rechazó.
- **El paso 4 se mide contra los FABRICADOS, no contra los 212 perfumes**: un splash comprado
  o una gorra no llevan esencia, así que contra el total nunca se completaría.
- El mismo patrón se usa en la banda de "emparejar esencias": **se esconde sola** cuando no
  queda ninguna, y va como banda ámbar, NO como botón de la barra (esa fila ya está llena y
  esta es una tarea que se termina).

## Formularios: etiquetas y ancho

- **Una fila de encabezado NO es una etiqueta** (defecto 12 de la skill
  `dashboard-interno-ux`). Las líneas de la compra tenían las etiquetas una sola vez arriba,
  tipo tabla; el dueño preguntó *"¿cómo sé qué se pone en qué input?"* — con razón: el modal
  mide 540 px, así que la columna del nombre se aplastaba a **59 px** y por debajo de 640 px
  de ventana el encabezado desaparecía dejando tres casillas mudas. Ahora **cada casilla lleva
  su etiqueta encima**.
- **Maquetar dentro de un modal o una tarjeta se hace con `@container`, NO con los `sm:` de
  siempre.** Los prefijos `sm:`/`md:` miden la **ventana**, y aquí eso miente: el modal mide
  540 px aunque la pantalla tenga 1400, así que "pantalla ancha" no significa "hay espacio".
  Medido: tarjeta de 443 px → 3 columnas de 134; de 277 px y de 187 px → una sola columna.
  `sm:` solo sirve para lo que ocupa el ancho de la página.
- **Confirmar el resultado en palabras evita datos basura.** El editor de rangos de precio se
  redacta como una FRASE ("Si el cliente lleva desde [10] u hasta [19] u, le cobras $[19000]
  por cada uno") con vista previa y alerta si el "desde" es ≥ 1000. Nació de un caso real: el
  dueño metió el precio donde iba la cantidad. Igual la cuenta del IVA y los dos nombres al
  crear una esencia: **ver el resultado antes de guardar es lo que impide el error**.
- **La etiqueta se enlaza SOLA con su control, y no hay que hacer nada en la pantalla**
  (2026-08-23). `Field` pintaba un `<label>` suelto sin `htmlFor`: hacer clic en "Nombre" no
  llevaba el cursor a su casilla y un lector de pantalla decía "cuadro de edición" sin decir de
  qué. Medido en el modal de perfume: **3 etiquetas de 16 asociadas antes, 13 de 16 después**.
  El mecanismo está en `components/ui/campoEtiqueta.ts` y va **de abajo hacia arriba** —el
  control se anuncia, la etiqueta no manda—, por dos razones: los 230 usos de `Field` no cambian
  ni una línea, y **nunca queda un `htmlFor` apuntando al vacío** en los campos que envuelven un
  grupo (aromas, ocasiones, la tabla de presentaciones), donde no existe control al que apuntar.
  Si un campo lleva dos controles, se queda con la etiqueta el primero.
- **Un desplegable NO puede dejar que la etiqueta le robe el nombre.** El nombre de un `<button>`
  sale de su texto —el valor elegido—, y una etiqueta enlazada lo pisa: el lector diría "Esencia,
  botón" sin decir nunca qué hay elegido. `BuscadorSelect` cita las dos cosas
  (`aria-labelledby="<etiqueta> <botón>"`) y se anuncia "Esencia, Sin asignar". **Se descubrió
  porque 7 recorridos se cayeron**: buscaban el botón por su valor y ya no lo encontraban. La
  prueba que se rompe es la que avisa de que un cambio "de accesibilidad" empeoró la
  accesibilidad.
- **La URL de un enlace se pide DENTRO de la pantalla** (2026-08-23). Era un `window.prompt`:
  una ventana gris del sistema operativo en medio de un diseño marfil e iris, y encima congela la
  página entera mientras está abierta. Ahora es una casilla en la propia barra del editor, con
  Enter para aceptar y Escape para salir. **Lo delicado**: al escribir en la casilla el foco sale
  del área editable y el navegador **pierde la selección**, así que hay que guardar el rango al
  abrir y devolverlo antes de crear el enlace — si no, el botón no hace nada y no dice por qué.
  Y una URL sin `https://` se guarda como enlace relativo a la tienda: se completa sola.
- El campo de dinero va **sin flechitas**: en un precio no sirven y en el celular tapaban un
  dígito.
- **Confirmar antes de una acción de cara al público** (`PublicarSwitch.tsx`): un clic sin
  querer en una tabla de 212 filas saca un producto de la venta sin que nada lo grite. El
  texto explica la consecuencia y ofrece la alternativa correcta.

## Verificación visual (obligatoria)

**Ninguna pantalla se entrega sin abrirla en un navegador y mirarla.** El procedimiento está
en `dashboard-interno-ux/references/verificacion-visual.md` y el script en
`dashboard-interno-ux/scripts/revisar-pantalla.mjs` (login, medición en píxeles y capturas en
escritorio y celular). Lo que aporta y no se puede improvisar: **medir en vez de opinar** —
"quedó más compacto" no se verifica, "pasó de 55 renglones a 41 píxeles" sí.

**Cerrado el 2026-08-23**: `Field` pintaba un `<label>` suelto y el navegador no lo relacionaba
con su campo, así que `getByLabel` no servía en los recorridos. Ya se enlaza solo (ver
*Formularios: etiquetas y ancho*, más arriba) y el ayudante `campo()` es hoy un `getByLabel`.

## El alta de un producto pregunta PRIMERO qué es (2026-08-25)

El formulario del catálogo era uno solo para las tres familias, con ~16 campos, y la pregunta que
decide cuáles aplican —*¿cómo consigues este producto?*— estaba en la **casilla once**: para dar de
alta una bolsa de organza había que pasar por su duración y su proyección. Lo señaló el dueño con
una captura: *"en base a cómo se consigue el producto, desde esa pregunta fundamental es el tipo de
modal que se debe renderizar"*.

Ahora el alta abre con **cuatro puertas** —fragancia, 1.1, comprado, decants— y cada una muestra
solo sus campos. **Medido con `altaPorTipo.e2e.test.ts`: un accesorio pide 5 casillas y una
fragancia 8.**

- **Los tipos se deducen de los datos** (`tipoDeProducto.ts`), nunca de una bandera aparte: son
  combinaciones de `tipo_producto`, `solo_armado` y `es_accesorio`, que ya existían. Una columna
  nueva se desincronizaría el día que el producto se edite por otra vía (el Excel, el alta desde el
  lote).
- **Al EDITAR no se vuelve a preguntar**: la ficha ya lo dice, y preguntarlo sería un clic de más en
  la tarea que más se repite. El tipo se muestra arriba, con un "Cambiar" que solo aparece al crear.
- **El 1.1 dejó de ser una casilla escondida** al final del formulario y pasó a ser una puerta. Ahí
  vive la pregunta que el dueño añadió: *¿lo preparas tú o lo compras hecho?* — los dos son 1.1;
  cambia de dónde sale su costo.
- **Los decants tienen su propia puerta** aunque no estaban en el diseño inicial: sin ella, el tipo
  `fraccionado` habría quedado inalcanzable desde la pantalla.


## Publicar lo recién creado no vive dentro del formulario que lo creó (2026-08-25)

En el alta de un 1.1 desde el lote, el botón *Publicar en la tienda* está **fuera** del formulario
de alta, en su propio componente (`PublicarRecienCreado.tsx`), bajo el buscador de fragancia.

Se probó dentro y en pantalla se vio por qué no funciona: *"Crear y seguir"* cierra el formulario y
devuelve al lote, así que el botón se iba con él y encender el producto volvía a obligar al viaje a
*Productos* — justo el viaje que el dueño no hace, y la razón de que tuviera 229 perfumes y cero
fichas 1.1.

Al lado va **"Después"**, porque el caso normal es crear varios en una tanda y encenderlos cuando
tengan foto.

**Publicar sin foto avisa, no bloquea** (decisión del dueño, 2026-08-25): se dice que en la tienda
se verá una tarjeta sin imagen y se publica igual si él confirma. Un producto recién creado nunca
tiene foto, así que el aviso sale siempre la primera vez.

## Los bordes de 1 píxel NO llevan transparencia (2026-08-25)

En las etiquetas de las columnas *Estado* el borde iba al 50% (`border-amber-400/50`,
`border-primary/30`). En la pantalla del dueño el filo se veía **verde**, y se arreglaba solo al
pasar el mouse por la fila.

**Por qué**: un borde de 1 píxel sobre una pastilla curva no cae justo en la rejilla de píxeles;
el navegador lo compensa mezclando subpíxeles de colores, y con transparencia el efecto se dispara
—el verde es el complementario del ámbar—. El hover repinta la fila y por eso ahí se veía limpio.

**Por qué no salió en las capturas**: el navegador sin ventana (el de los recorridos y las
capturas de verificación) no usa antialiasing por subpíxeles. Esto solo se ve en una pantalla real:
es un caso donde la captura automática NO sustituye a mirarlo.

**La regla**: los bordes de las etiquetas van en color OPACO (`border-amber-300`,
`border-border`…), nunca con `/30` o `/50`. El resto del dashboard —Blog, Cotizaciones,
Entregas— ya lo hacía así; eran las columnas de Estado las que se habían salido del patrón.

## El cajón (Sheet) abre en 200 ms, no en 500 (2026-08-25)

El dueño dijo que la app se sentía **"ultra lenta al abrir el drawer"**, en cualquier pantalla y
también en producción. Medido con los recorridos, cinco vueltas por pantalla:

| | Antes | Después |
|---|---|---|
| Del clic a que termina de deslizarse | **531 ms** | ~230 ms |
| Trabajo bloqueando el hilo | **0 ms** | 0 ms |

**Los 0 ms son la clave del diagnóstico**: no había nada pesado calculándose —esa causa ya se
había arreglado el 2026-08-14 moviendo el estado a `MenuLateral`— sino la animación, que venía en
`duration-500` desde que se instaló el componente de shadcn. Nunca la tocó nadie; se notó ahora
porque el resto de la aplicación responde al instante y medio segundo destaca.

Queda en **200 ms al abrir y 150 al cerrar**, y lo vigila `e2e/menuLateral.e2e.test.ts`, que mide
las dos cosas: que la animación no se alargue y que no vuelva a haber trabajo bloqueando (los dos
fallos se sienten igual y se arreglan distinto).

Afecta a los tres cajones de la casa: el menú del dashboard, **el carrito de la tienda** y los
filtros del catálogo en móvil — los tres abrían en medio segundo.

## Una acción destructiva enseña la cuenta medida, no una promesa (2026-08-29)

El modal de **fusionar materiales** (Inventario → icono *Fusionar* de cada fila) no se puede
deshacer, así que antes de confirmar enseña **tres cosas, en este orden**:

1. **Qué se va a mover, contado por el servidor**: *"Se muda a su nombre: 3 movimientos · 2
   recetas"*. No es una estimación del frontend — lo trae un `GET` que cuenta lo mismo que después
   se mueve. Y solo se listan los renglones con número: enseñar ocho ceros no informa, distrae.
2. **En verde, la respuesta a lo que el dueño preguntó**, con su número delante: *"Tus existencias
   no se mueven: «X» sigue con 30"*. El aviso verde no es decoración; es la duda concreta que
   trajo (*"que no me descuente lo que esté antes"*) contestada donde va a tomar la decisión.
3. **En ámbar, lo que no tiene vuelta**: qué se borra, y cuál es la alternativa menos drástica
   (apagarlo con el interruptor).

**La regla que queda**: cuando una pantalla vaya a hacer algo irreversible, lo que enseña antes
tiene que ser **medido contra los datos de verdad**, no redactado. Un texto que dice "se moverán
tus registros" no deja decidir; "3 movimientos, 2 recetas, 1 perfume" sí.

De paso, las acciones de fila de Inventario salieron a `inventario/AccionesMaterial.tsx`
(escritorio y móvil): `InventarioTab.tsx` estaba justo en 500 líneas y había que meterle un botón
más.

## El aviso de inventario del dashboard (2026-08-29)

Pedido así por el dueño: *"una súper alerta que salga en medio de todo, solo visible para el
dashboard, así como la parte que tengo de anuncios para los clientes"*. Se resolvió como una
**pantalla de configuración** (Alertas de inventario) más un aviso que él decide cómo se ve.

Las reglas que quedan, y su porqué:

- **El aviso va arriba de todo y en CUALQUIER pestaña.** Si solo saliera en Inventario, avisaría
  justo a quien ya está mirando el inventario.
- **Él elige la forma por familia**: franja discreta o ventana en medio. No se decide desde el
  código qué merece interrumpirlo.
- **Solo UNA ventana a la vez**, aunque dos familias pidan ventana. Dos modales encadenados al
  entrar convierten el aviso en un trámite que se cierra sin leer.
- **Se cierra por el día, y vuelve antes si cambia la lista que lo disparó.** Se guarda una firma
  con los ids de los materiales: si cambian, es otra alerta. Una alerta que se calla mientras se
  acaban tres cosas más es igual a no tener alerta.
- **La pantalla de configuración enseña lo que cada regla marca AHORA**, traído del servidor.
  Teclear un mínimo sin ver a cuántos materiales alcanza es adivinar; con la vista previa, el
  número se ajusta en la misma pantalla.

Y una que aplica a todo el dashboard: **cuando dos pantallas configuran lo mismo, cada una nombra a
la otra.** Los mínimos por gama siguen en *Pedido sugerido → ¿Cuándo te aviso?* y mandan sobre los
de familia; la pantalla de Alertas lo dice en su cabecera, o el dueño los buscaría ahí.
