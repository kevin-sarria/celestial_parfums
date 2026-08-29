# Dónde quedamos y qué sigue

**Última sesión: 29 de agosto de 2026.** Todo compila, **371 pruebas en verde** (235 backend +
84 frontend + 52 recorridos, más 1 saltada a propósito) y el linter en cero.

## ✅ Producción está al día (2026-08-29, tarde)

**Todo lo de `main` está en vivo y verificado desde fuera**: se descargó el paquete que sirve el
servidor y contiene *Fusionar*, *Alertas de inventario* y *en prueba*. Las migraciones que faltaban
(`20260825120000_editar_producciones` y `20260829120000_alertas_inventario`) quedaron aplicadas con
`migrate deploy`.

Dos tropiezos del camino, ya documentados para que no se repitan (ver
[`gotchas.md`](gotchas.md)): el frontend se quedó **seis minutos viejo** porque su `npm run build`
no corrió —y la caché del navegador se llevó la culpa un rato—, y `migrate dev` en el servidor
ofreció borrar la base. Contra lo segundo hay ya un freno de mano en `npm run prisma:migrate`.

**Falta confirmar en pantalla**: que el aviso de *lotes por enlazar* aparece en Producciones con
sus 5 lotes, y usar *Fusionar* con los dos perfumeros (ids 9 y 11).

## 🔴 Plata sin costear: los créditos guardan la línea SIN TALLA

Encontrado el 2026-08-29 midiendo el respaldo. **Sin talla, el sistema no sabe qué receta descontar
y la venta queda con `costo_mercancia = 0`.**

| Crédito | Venta | Fecha | Valor | Qué pasó |
|---|---|---|---|---|
| 7 (David Sánchez) | 1281 | 23-ago | $140.000 | Althaïr + Khamrah 100ML, **las dos líneas sin talla**. El frasco 1.1 de Khamrah sigue figurando en inventario aunque se entregara |
| 8 (Santy Tabares) | 1289 | 26-ago | $90.000 | Mandarin Sky 100ML, sin talla, costo $0 |

De las 4 ventas de agosto con líneas sin talla, **3 son créditos**. `createCredito` solo pone la
talla si el formulario manda `lineas`; si no, la deduce del texto y la deja en null.
**PENDIENTE: investigar por qué el formulario no las manda** (pregunté y quedó sin responder).

## 🟠 El aviso de "lotes por enlazar" se esconde solo cuando falla

`LotesPorEnlazar.tsx` traga el error a propósito (*"es información de apoyo: si no carga, la
pantalla principal sigue sirviendo"*) y devuelve `null`. Suena razonable, pero es lo que hizo
**invisible durante días** el deploy a medias del 29: el endpoint respondía error por la columna
que faltaba, y el dueño no veía ni el aviso ni una explicación — solo una pantalla normal sin
botón, y concluyó que la función de los 1.1 estaba mal hecha.

**La regla que hay que aplicar aquí**: una sección puede esconderse cuando **no hay nada que
mostrar**, nunca cuando **no pudo preguntarlo**. Son dos estados distintos y hoy se pintan igual.
Falta distinguirlos: si la consulta falla, un renglón discreto que diga que no se pudo cargar, con
"Reintentar".

Revisar de paso si hay más secciones con el mismo `catch` mudo (`FrascosArmados`, `PrimerosPasos`,
`AvisoEsenciasSinPerfume`, `AvisoAlertas` — este último lo escribí igual el 2026-08-29, así que
entra en la misma corrección).

## Lo siguiente, ya decidido y sin empezar: los 3 arreglos de los 1.1

Salieron de auditar la lógica 1.1 entera el 2026-08-29, con el código y sus datos delante.
**Aprobados por él ese mismo día**; no se ha escrito ni una línea todavía.

1. **Vender un 1.1 sin frascos armados lo FABRICA.** 🔴 `consumirPorVenta` nunca pregunta si la
   ficha es 1.1: si no hay frasco armado, descuenta esencia + envase 1.1 como si lo hubiera
   armado. La tienda lo esconde (sale "Sin armar"), pero **una venta cargada a mano en el
   dashboard no lo revisa**. **Decisión suya:** dejar pasar la venta y avisar — no se fabrica, el
   frasco queda en −1 y la respuesta dice *"vendiste 1 sin frascos armados"*. Es la misma regla
   que ya rige el inventario de materiales.
2. **El 1.1 recién creado puede nacer con el precio del corriente.** 🔴 La ficha nace sin precio
   propio; si la categoría "1.1" no existe o no tiene precio para esa talla, cae al precio
   heredado del perfume normal **sin avisar**. Es el susto de Khamrah por la puerta de al lado.
   **Arreglo:** el enlazador busca el precio de la lista de los 1.1 para esa talla y lo enseña en
   el mismo modal donde se corrige el nombre; si esa lista no existe, enseña el heredado marcado
   en rojo. **Regla nueva aprobada:** si acepta el precio de la lista, la ficha **no** guarda
   precio propio (así subir la lista los sube a todos); solo si escribe otro queda amarrado.
3. **Disponible por una talla, se vende por otra.** 🟠 "Hay armados" suma TODAS las tallas, pero el
   descuento busca la talla exacta: un frasco de 50 ml hace que el de 100 ml se vea disponible.
   **Arreglo:** cada talla dice cuántos frascos tiene ella.

**Fuera de esos tres, encontrados en la misma auditoría y NO aprobados todavía:**

- **Una devolución no devuelve el frasco al stock** (`devolucion.repository.ts` no toca
  inventario). Aplica a todo el catálogo, no solo a los 1.1; por eso quedó fuera.
- **La pestaña Productos no dice cuántas unidades quedan** (la columna Stock de la Ola 2).

## El estado de los datos de producción (medido contra el respaldo del 2026-08-29)

> **Medido contra el respaldo del 2026-08-29:** hay **0 fichas 1.1**, el frasco de Khamrah sigue
> colgado de la ficha corriente y los otros 4 lotes siguen sin frascos. No era que el dueño no
> quisiera: **el enlazador estaba muerto en producción por una migración que no se aplicó**. Ya está
> aplicada (29 de agosto, tarde), así que esto se arregla con un botón por lote. **Sin hacer
> todavía.**

### 1. Un frasco 1.1 de Khamrah está colgado de la ficha del perfume NORMAL

**Es lo único con riesgo de plata hoy mismo.** El lote 6 (21 de agosto, 1 unidad, $74.580) se
registró **después** del despliegue del producto terminado, así que **sí entró al sistema**: hay 1
frasco armado en `perfume_presentacion` del perfume 529, *Khamrah By Lattafa* — la ficha del
corriente. Pero el envase que consumió es el **"Envase Khamrah 1.1 100ml"** ($48.680): es un 1.1.

Consecuencia: **si alguien compra un Khamrah 100 ml corriente, el sistema le entrega ese frasco**
—descuenta el armado, que es lo correcto— **y lo cobra al precio del corriente**. Se vende un
frasco de $74.580 de costo a precio de fragancia normal.

Mientras no exista la ficha 1.1 de Khamrah: **o no se vende Khamrah 100 ml, o se le pone su ficha
propia y se rehace ese lote** (borrar y volver a registrar apuntando a la ficha 1.1).

### 2. Los otros 5 lotes siguen sin entrar al sistema

Los 5 lotes del 11 al 14 de agosto (212 VIP Black, Mandarin Sky, Bon Bon, Yum Yum, Asad) se
registraron ANTES de que existiera la tabla, así que para el sistema esos frascos no existen y
venderlos volvería a descontar la receta. **Aquí no hay riesgo de cobrar de menos**, solo de
descontar material dos veces.

Se arregla con el **runbook** de abajo (~20 minutos en el dashboard), con **una excepción nueva**:
el lote del **212 VIP Black no se rehace, se convierte** — esos 500 ml están macerando, no son 5
frascos. Ver [`la maceración`](superpowers/specs/2026-08-24-maceracion-y-envasado-design.md).

### 3. Lo que el respaldo dice del catálogo

- **229 perfumes** (eran 222 el 14 de agosto), **todos `fabricado`**: ni una ficha 1.1, ni un
  accesorio con ficha. La pestaña Productos nace vacía también en producción, con su caja de
  primeros pasos — tal como se diseñó.
- **7 de los 12 envases están en CERO**: los 5 envases 1.1, la botella mini de 5 ml y el envase de
  75 ml. Más de la mitad del desplegable son opciones muertas; es exactamente el problema que
  arregla el diseño de la maceración.
- **El Perfumero Recargable está en −25 unidades**, no en −5.000 como decía la nota vieja (esa
  cifra estaba mal y queda corregida aquí). 20 de esos 25 salieron de los 5 lotes viejos, que
  consumieron un perfumero por unidad.

### 4. Los regalos YA están desplegados

La migración `20260820120000_regalos_y_extras` figura aplicada en producción el **2026-08-23**, así
que el punto 1 de la lista de arriba ya está en vivo. **Falta confirmar con el dueño** qué más
entró en ese despliegue: los puntos 2 al 7 son solo código y no dejan rastro en la base.

## En qué estado quedó el producto terminado

Diseño completo en
[`superpowers/specs/2026-08-14-producto-terminado-design.md`](superpowers/specs/2026-08-14-producto-terminado-design.md),
y lo ya construido está documentado en [`inventario-costeo.md`](inventario-costeo.md).

**HECHO y verificado:**
- Migración `20260814120000_producto_terminado` (tabla `movimientos_terminado`,
  `perfume_presentacion.stock`/`.costo_promedio`, `perfumes.solo_armado`).
- `inventario.terminado.ts`: producir suma frascos, vender saca primero de lo armado, las dos
  reversiones. 7 pruebas en `inventario.terminado.bd.test.ts`.
- **Las tres reglas de disponibilidad** (`motivoAgotado` en `perfume.mapeo.ts`): el 1.1 se
  agota sin frascos armados, un armado se vende aunque no haya esencia, y un `comprado` se agota
  si no queda su botella. Con su casilla en el formulario, su etiqueta en la tabla ("Sin armar",
  "Sin unidades") y el motivo explicado en el tooltip. 11 + 6 pruebas y un recorrido en navegador.
- **Arreglado de paso**: guardar la ficha de un perfume **borraba sus frascos armados**
  (`editPerfume` rehacía la tabla de tallas entera). Ahora se sincroniza, y quitar una talla con
  frascos armados se rechaza con un mensaje. 3 pruebas en `perfume.edicion.bd.test.ts`.
- **Una talla nueva nace sabiendo sus ml** (`mlDelNombre` en `utils/tallas.ts`): "90 ML" queda
  con `ml = 90` y enganchado a la receta de ese tamaño si existe. La lista de Presentaciones
  muestra el número bajo cada nombre. **Ya se pueden cargar los originales.** 4 + 6 pruebas y un
  recorrido en navegador.
- **`perfume.repository.ts` se partió** (iba en 912 líneas): la capa de lectura —`perfumeInclude`,
  cascada de precios, agotado y `mapPerfume`— salió a `perfume.mapeo.ts` (246). El repositorio
  quedó en 679 y solo consulta y escribe.
- **Los frascos armados se ven en Inventario**: métrica *"Frascos armados"* (cuántos y cuánta
  plata) y tabla *"Frascos ya armados"* con perfume, talla, cantidad y costo congelado. Se
  esconde sola cuando no hay nada armado. 3 pruebas y un recorrido en navegador que arma un lote
  desde el modal y lo ve aparecer.

**FALTA — y esto ya NO es código, es data entry que solo puede hacer el dueño**
(son sus fotos, sus nombres y su tienda en vivo; desde aquí no se toca producción).

### Runbook: meter los 9 frascos al sistema (después de desplegar)

**El orden importa: primero se despliega el código nuevo con su migración, y DESPUÉS se rehacen
los lotes.** Al revés no sirve de nada: es el código nuevo el que apunta los frascos en el libro
del terminado.

Además, los 4 lotes de 1.1 apuntan hoy al perfume ORIGINAL, así que hay que aprovechar y pasarlos
a sus fichas nuevas: si no, vender el "Bon Bon" corriente descontaría el frasco 1.1, que cuesta
el doble.

1. **Lista de precios**: Precios → categoría `1.1` × talla `100ML` = **$120.000**.
2. **Una ficha por cada uno** (Perfumes → *+ Nuevo perfume*): Asad, Mandarin Sky, Bon Bon,
   Yum Yum y Khamrah. En cada una:
   - Categoría **1.1** y su foto real.
   - Marcar **"Solo se vende si ya está armado (los 1.1)"**.
   - Su **esencia** (la misma del perfume normal: la receta es idéntica).
   - Talla **100ML**, y en el desplegable de esa fila elegir **su envase 1.1**.
   - Solo en **Bon Bon y Yum Yum**: precio propio **$150.000** en esa talla.
3. **Rehacer los 5 lotes** (no hay "editar lote", y a propósito: mover frascos entre fichas a
   mano es justo donde se descuadran los costos). Para cada uno:
   - Producciones → **borrar** el lote (devuelve el material al inventario).
   - Inventario → **Registrar uso → Armé perfumes** → elegir la ficha correcta, el tamaño, el
     envase que usaste y la misma cantidad. La fecha puede ser la original.
   - Los 4 de 1.1 van a su **ficha 1.1 nueva** con su **envase 1.1**; el de **212 VIP Black
     (5 unidades) vuelve a su misma ficha** con el envase normal — pero **hay que rehacerlo
     igual**, o sus 5 frascos no entran al sistema.
   - Comprobar en Inventario → *Frascos ya armados* que aparecen los 9 con su costo
     (212 VIP Black $24.188 · Asad $54.436 · Mandarin Sky $66.344 · Bon Bon $81.829 ·
     Yum Yum $103.135).

**Ojo**: al borrar y volver a registrar, el costo se recalcula con el promedio de HOY. Como los
lotes son de ayer y no ha entrado material nuevo, debería dar lo mismo; si algún número se aleja
mucho de la tabla de arriba, avisar antes de seguir.

## Estado del entorno local (importante para retomar)

- **`celestial_prod_20260829`**: copia real del servidor del **2026-08-29**, la más reciente
  (`Downloads/backup-celestial-2026-08-29.sql`). Es contra la que se mide de ahora en adelante.
  **Ojo: se le aplicó a mano la migración `20260825120000_editar_producciones`** para comprobar que
  arreglaba el enlazador, así que ya NO refleja el estado exacto del servidor en ese punto.
- **Las dos bases de trabajo (`perfumes_db` y `perfumes_test`) tienen aplicada a mano
  `20260829120000_alertas_inventario`** y registrada en `_prisma_migrations`, como manda el gotcha
  del MySQL de XAMPP.

- **`celestial_prod_20260825`**: copia real del servidor del **2026-08-24** (el dueño la bajó ese
  día; el archivo se llama `backup-celestial-2026-08-25.sql` y está en `Downloads`). Es la base
  contra la que se mide de ahora en adelante. Carga limpia: 50 tablas, sin el `\-` del sandbox
  —el exportador ya lo quita desde el 2026-08-17— y con `--default-character-set=utf8mb4`.
- **`celestial_prod_20260814`**: la copia anterior, del 2026-08-14. Se queda porque es contra la
  que se probaron las migraciones ya desplegadas. El respaldo original sigue en
  `Downloads/backup-celestial-2026-08-14.sql.gz`; para recargarla:
  `gunzip -c backup.sql.gz | tail -n +2 > limpio.sql` y cargarla con
  `mysql.exe --default-character-set=utf8mb4`.
- **`perfumes_db` (la del dueño)**: sus 222 perfumes intactos, y **ya tiene la migración de
  producto terminado** (2026-08-14, tarde). Hubo que aplicársela: sin ella **todo el backend
  respondía 400**, porque el código lee `stock` y `solo_armado` en cada consulta del catálogo.
  Verificado después: `/api/parfums` responde 200 con los 221 publicados. Detalle del susto en
  [`gotchas.md`](gotchas.md).
- **`perfumes_test`**: igual, la migración se aplicó **a mano** y se registró a mano en
  `_prisma_migrations`, porque `prisma migrate deploy` revienta el MariaDB local (ver
  [`gotchas.md`](gotchas.md)). Si se agrega otra migración habrá que repetir ese truco **en las
  dos bases locales**. **En el servidor (MariaDB 10.11) `migrate deploy` funciona normal.**
- **Las tres bases están al día**: `perfumes_db`, `perfumes_test` y `celestial_prod_20260814`
  tienen exactamente las mismas migraciones aplicadas (comprobado).
- **Todo subido a git** en `main` (14 y 15 de agosto): el producto terminado con su migración, los
  9 documentos de `docs/` y la mudanza del frontend a la capa HTTP única.
- **Ya desplegado en el servidor de producción** (confirmado por el dueño, 2026-08-17). Con esto
  el código nuevo y la migración de producto terminado ya están en vivo — queda pendiente el
  runbook de abajo para meter los 9 frascos armados al sistema.

## ✅ El refactor del frontend (capa HTTP única) — TERMINADO

**No queda nada.** `client.ts`, `useGuardedFetch` y `cachedFetch.ts` están borrados y **toda la
aplicación habla por `http` + `urls`**: dashboard, portal del cliente, pantallas de contenido,
tienda, login/registro y el PDF del catálogo. Lo hecho y su porqué están en
[`historial-cambios.md`](historial-cambios.md) y las decisiones en
[`arquitectura.md`](arquitectura.md).

Lo único que hay que **no deshacer** al tocar autenticación: la marca `sesionOpcional`. Sin ella,
el interceptor lee cualquier 401 como sesión vencida — y entonces un visitante anónimo sale
rebotado al login, y escribir mal la contraseña te expulsa en vez de avisarte. Está explicada con
su tabla en [`arquitectura.md`](arquitectura.md).

**Aviso para quien siga**: las pantallas públicas no tienen prueba automática. La suite de
frontend es toda de cálculo puro (no hay `@testing-library`, ni entorno jsdom montado), así que
estas pantallas se verifican **en el navegador**, y con el backend tumbado a propósito para ver el
camino del error. Montar pruebas de componentes es una decisión del dueño que sigue sin tomarse.

## 🧪 La maceración: el sistema no sabe que producir son DOS momentos

**Encontrado el 2026-08-23, con el dueño mirando sus datos en vivo.** No entra en las 3 olas de
Productos y Accesorios — decisión suya, va después.

Hoy `producir` = consumir esencia + diluyente + **un envase por unidad** y dejar N frascos
armados de UNA talla fija. En perfumería de verdad son dos momentos separados por semanas, y el
dueño ya está trabajando así:

| El sistema cree | La realidad (lote de 212 VIP Black, 11/8) |
|---|---|
| 5 frascos de 100 ml listos | ~500 ml en un frasco de 1 litro **macerando** |
| Se gastaron 5 envases de 100 ml | Los 5 envases siguen **vacíos en la repisa** |

No fue un error del dueño: **hizo lo único que el sistema le dejaba hacer.** Textual: *"hice una
cosa rara"*.

**Modelo propuesto — dos pasos:**

1. **Macerar**: consume esencia + diluyente, **no consume envases**, y produce X ml de granel de
   esa fragancia con su fecha de inicio y su fecha estimada de listo. El granel lleva costo por ml.
2. **Envasar**: toma ml del granel + N envases de la talla que sea → N frascos armados. Se puede
   hacer en varias tandas y **en tallas distintas** (3 × 30 ml + 2 × 50 ml + 3 × 100 ml del mismo
   granel). El costo del frasco = ml × costo del granel + envase + accesorios.

**Por qué importa cada vez más**: el dueño va a pasar de una maceración suelta a **macerar las 10
referencias más vendidas** (dicho el 2026-08-23). Con 10 graneles en curso, aproximar cada uno como
"N frascos de 100 ml" deja el inventario y los costos inservibles.

**Qué NO hacer mientras tanto**: borrar el lote del 212 VIP Black. Devolvería la esencia al
inventario, y esa esencia sí se gastó — está en el frasco de 1 litro. Si se quiere cuadrar el
conteo físico, ajustar **+5 el Envase 100 ml** y dejar el lote quieto. Al construir la maceración,
ese lote se migra.

## ✅ El alta de productos y los envases en cero — HECHO (2026-08-25)

Las tres partes del diseño
([`superpowers/specs/2026-08-25-alta-de-productos-por-tipo-design.md`](superpowers/specs/2026-08-25-alta-de-productos-por-tipo-design.md))
están construidas y verificadas en pantalla; son los puntos **9 y 10** de la lista de arriba, a la
espera del próximo deploy. Con la carga inicial, **el dueño ya puede meter sus frascos 1.1 al
sistema sin descontar esencia**, que era la barrera.

**Ojo con el runbook de los 9 frascos: ahora hay dos caminos y NO son intercambiables.** Antes de
que el dueño lo corra, hay que decidir cuál va en cada lote, porque equivocarse descuadra el
material:

- **Los 5 lotes del 11 al 14 de agosto** (212 VIP Black, Mandarin Sky, Bon Bon, Yum Yum, Asad) se
  registraron ANTES de que existiera la tabla del terminado: **el material ya se descontó** y lo
  único que falta son los frascos. Ese es exactamente el caso de la **carga inicial** — se suman
  los frascos a su ficha 1.1 y no se toca el lote viejo. Borrarlos y rehacerlos también cuadra,
  pero da más vueltas.
- **El lote 6 de Khamrah (21 de agosto)** SÍ entró al sistema, y entró en la ficha del perfume
  corriente. Ahí la carga inicial **no sirve**: el frasco ya existe, solo que colgado del sitio
  equivocado. Ese se borra y se vuelve a registrar apuntando a la ficha 1.1, como decía el
  runbook.
- **El 212 VIP Black sigue siendo la excepción** de siempre: esos 500 ml están macerando, no son
  5 frascos. No se rehace ni se carga hasta que exista la maceración.

De paso quedó cerrado el defecto de los envases en cero que él encontró el 2026-08-23.

## ✅ Editar lotes, enlazar los 1.1 y publicarlos — HECHO y EN VIVO (2026-08-25)

Construido, verificado en pantalla y desplegado el **2026-08-29 por la tarde**, con su migración
(`20260825120000_editar_producciones`). El porqué de cada decisión está en
[`inventario-costeo.md`](inventario-costeo.md#corregir-un-lote-de-producción-2026-08-25) y en
[`diseno-ux.md`](diseno-ux.md).

**Lo que cambia para el dueño:**

- **El lápiz en Producciones corrige un lote entero** —material, cantidad, ficha, envase, fecha y
  costo— sin borrarlo. El costo se recalcula solo y se puede escribir a mano (queda marcado ✎), y
  cada corrección deja su línea en la fila.
- **El aviso "lotes por enlazar"** le CREA a cada lote su ficha 1.1 —copiada del perfume
  corriente, foto incluida, apagada y en Productos— y le mete los frascos, con un botón. El
  nombre se propone y se puede corregir antes de crear. Desaparece cuando no queda ninguno.
- **Un 1.1 se crea heredando la ficha de su perfume corriente** y se publica sin cambiar de
  pantalla; sin foto avisa y deja seguir.
- **Arreglado de paso**: borrar un lote dejaba el costo promedio del frasco mintiendo.

**Esto reemplaza casi todo el runbook de los 9 frascos**: lo que eran ~20 minutos de borrar y
volver a registrar es ahora un botón por lote, y ni siquiera hace falta crear las fichas 1.1 a
mano. El **212 VIP Black ya no sale en el aviso**: su lote usó el envase normal —esos 500 ml están
macerando, no son 5 frascos— y el aviso solo marca lo armado con envase propio.

Diseño completo en
[`superpowers/specs/2026-08-25-editar-lotes-y-enlazar-1.1-design.md`](superpowers/specs/2026-08-25-editar-lotes-y-enlazar-1.1-design.md).
Sale de tres pedidos suyos en la misma frase: editar producciones para ajustar valores, un
enlazador para los 1.1 que quedaron colgados de la ficha equivocada, y poder sacarlos rápido al
catálogo público, y el plan tarea por tarea en
[`superpowers/plans/2026-08-25-editar-lotes-y-enlazar-1.1.md`](superpowers/plans/2026-08-25-editar-lotes-y-enlazar-1.1.md).

## Sigue de Productos y Accesorios: Ola 2 y Ola 3

La Ola 1 (punto 8 de la lista de arriba) partió el CATÁLOGO del dashboard en dos pestañas.
Quedan dos olas más, decididas de antemano y fuera de esta (diseño completo en
`docs/superpowers/specs/2026-08-23-productos-y-accesorios-design.md`):

- **Ola 2 — Producciones y la ficha completa.**
  - ~~**Alta del 1.1 desde el lote**~~ **HECHA el 2026-08-25** (punto 9 de la lista de arriba),
    junto con su recorrido y la reescritura del de disponibilidad.
    - **La deuda de la casilla "Solo se vende si ya está armado" quedó cerrada, pero al revés
      de como decía este plan.** La idea era puerta ÚNICA (un 1.1 solo nace del lote) para no
      acabar con "Bon Bon 1.1" y "Bon bon 1.1" como dos fichas. El dueño decidió el 2026-08-25
      que sean **varias puertas**, y lo que impide los duplicados es otra cosa: un nombre
      parecido —con tildes o mayúsculas distintas— **avisa cuál ya existe y no crea nada**, en
      el servidor, así que da igual por dónde se entre. La casilla ya no existe: el tipo se
      elige al empezar y `solo_armado` sale de ahí (`tipoDeProducto.ts`). El porqué del cambio
      de criterio está en el diseño del 2026-08-25, sección *"Tres puertas, no una"*.
  - **Columna STOCK** en la tabla de Productos: no entró en la Ola 1 a propósito — el listado no
    trae hoy las unidades armadas ni el stock del insumo enlazado, y traerlas es una consulta más
    en el camino caliente del catálogo. Va junto a Producciones, que es donde el dueño mira las
    unidades de verdad.
  - ~~Completar el resto de la ficha por familia~~ **HECHO el 2026-08-25**: el cuerpo del modal
    ya es el de cada tipo, también al EDITAR (el tipo se deduce de los datos que la ficha ya
    tiene, no de una columna nueva que se podría desincronizar). Queda solo repasar los textos
    de ayuda que aún hablan de "esencia" y "receta" en pantallas de fuera del alta.
- **Ola 3 — La tienda pública.** Hoy `/perfumes` sigue mostrando fragancias Y accesorios
  juntos (la tienda no se tocó en la Ola 1 — ver el gotcha del dashboard-vs-tienda en
  `arquitectura.md`). Falta:
  - Ruta `/accesorios` aparte.
  - Sacar los accesorios de `/perfumes`, para que el catálogo de fragancias vuelva a ser solo
    fragancias.

**No entra en ninguna de las tres**: la maceración (ver más abajo, decisión del dueño del
2026-08-23: va después de las tres olas).

## El resto de la lista (después del producto terminado)

1. **Ola 2 de los regalos: el kit del combo** — configurar en Combos qué accesorios trae por
   defecto y sugerirlos al detectar el combo, para no escribirlos a mano en cada venta. Diseño
   listo en `docs/superpowers/specs/2026-08-18-regalos-y-extras-design.md`. **Primero hay que
   desplegar la Ola 1 y dejar que el dueño la use unos días.**
2. **DECISIÓN DEL DUEÑO — el caso de borde del costo promedio.** Al borrar la ÚNICA compra de un
   material, su costo se queda en el de la compra borrada en vez de volver al de partida. Está
   medido y con dos pruebas puestas (una `it.skip` con la etiqueta `DISCREPANCIA` y otra que fija
   lo que hace hoy). **No se arregló porque el precio de arranque no se guarda en ninguna parte**:
   exige una columna nueva (`precio_inicial`) con su migración. Detalle en
   [`inventario-costeo.md`](inventario-costeo.md).
3. **Rellenar la talla de 4 líneas de venta** que sí se pueden deducir: las ventas **1269**
   ("30ML") y **1272** ("50ML") lo dicen sin ambigüedad en el texto de la venta. Las otras 8
   (ventas 1179, 1180, 1181, 1249 y 1219) son ambiguas de verdad — solo el dueño sabe si fue el de
   200 o el de 250 ml, y la 1219 es un "Combo Personalizado" con dos tallas en una línea.
   **Rellenarlas NO recupera el descuento de inventario** (el consumo no es retroactivo, por
   diseño): sirve para que el histórico quede completo.
4. **3 esencias sin género** (eran 189). Se llenan desde el Excel *Lista de materiales*.
5. **La gama "Diseñador" tiene mínimo configurado y CERO esencias**: o se le cuelgan esencias o se
   borra.
6. **Separar "200/250ML" en dos tallas reales** y sembrar su stock inicial. Ya se puede hacer
   desde Clasificaciones sin tocar la base: crear "200 ML" y "250 ML" nace con su número, y su
   receta se engancha sola **en cualquiera de los dos órdenes** (talla primero o receta primero,
   desde el 2026-08-23). Ojo: las recetas de 200 y 250 ml todavía NO existen, así que hay que
   crearlas en *Tamaños y fórmulas* o esas ventas no descontarán material.

## Deuda técnica encontrada el 2026-08-23 (no estaba en ninguna lista)

Salió de revisar el código en vez de la lista, cuando el dueño preguntó *"¿qué más falta por
codificar?"*. **Nada de esto rompe nada hoy**; está aquí para que no se vuelva a perder.

1. ~~El backend usa `any`.~~ **HECHO (2026-08-23): 215 → CERO**, pruebas y código de pruebas
   incluidos. `any` apaga el chequeo de tipos justo donde debería avisar. Se atacó por tandas, y
   el método fue siempre el mismo: **cambio mecánico → que el compilador diga dónde duele**.
   - **Tanda 1**: los **90 `catch (error: any)`**. TypeScript entrega `unknown` en un `catch`
     —lo correcto: cualquiera puede lanzar cualquier cosa— y `mensajeSeguro` ya lo aceptaba. El
     compilador señaló los 14 que sí tocaban el error; esos se arreglaron de verdad, con
     `textoDeError` y `codigoPrisma` en `utils/errorSeguro.ts`.
   - **Tanda 2**: el importador de Excel. Las funciones que convierten una celda pasaron a
     `unknown` con dos nombres propios, `Celda` y `FilaExcel`. De paso, una celda de fecha vacía
     daba **el 1 de enero de 1970**; ahora da fecha inválida y el importador la reporta.
   - **Tanda 3**: el resto. Tres patrones y **cuatro fallos reales** que el `any` tapaba:
     - **`req.query as any` × 22**: los tres ayudantes de paginación pedían `string` donde Express
       entrega valores desconocidos. Se arregló la firma (`ConsultaUrl`) y los 22 casts murieron.
     - **Los enums de Prisma** (`tipo`, `unidad`, `alcance`, `audiencia`, `estado`, `motivo`):
       ahí el `as any` **apagaba una validación de verdad**. Ahora se comprueban con `aEnum` en
       `utils/enums.ts`, y **las listas de valores válidos salen del enum**, no de una copia a
       mano: los motivos de devolución estaban escritos en tres sitios.
     - **Los mapeadores `(x: any) => ({…})`**: la forma de cada fila se la pide a Prisma
       (`Prisma.XGetPayload<{ include: typeof INCLUDE }>`), así que un `d.venta.persoan` deja de
       compilar. De paso, cada `include` repetido pasó a una constante única.
   - **Lo que apareció al quitarlos** (todo arreglado y con la suite en verde):
     1. **Marcar una cotización como "enviada" la devolvía sin sus ítems** (`marcarEstado` no
        traía el `include`, y el mapeador rellenaba con `[]`): en pantalla se veía como si se
        hubieran borrado los productos.
     2. **Créditos y ventas podían responder 500** al releer con `findUnique` una fila recién
        guardada: si ya no estaba, el mapeador reventaba con "Cannot read properties of null".
        Ahora hay un `releerCredito`/`releerVenta` que responde "ya no existe".
     3. **Tres columnas `Json` se leían con `as string[]`**, que no comprueba nada: las
        condiciones comerciales de una cotización reventaban el `...spread` si la columna no
        guardaba un objeto, y un `accesorios` con basura viajaba a la pantalla como id.
     4. **`CreateVentaDTO` estaba desactualizado** (no declaraba `lineas`, por donde entran hoy
        los productos y los regalos). Ahora ES el tipo del esquema de Zod, no una copia a mano.

2. ~~El linter del frontend no pasa.~~ **HECHO (2026-08-23): `npm run lint` da CERO.** De los 66
   avisos, 26 eran arreglos de verdad y 40 eran dos reglas que no encajan con este código, que se
   apagaron **enteras y explicadas** en `eslint.config.js` (el porqué vive ahí, no aquí). El
   criterio: 40 comentarios sueltos por los archivos no es una decisión, es ruido.
3. ~~55 archivos empiezan con BOM.~~ **HECHO (2026-08-23)**: cero. Se quitaron **en binario**
   —los 3 bytes y nada más—, que es la única forma segura en este proyecto: cualquier lectura y
   reescritura de texto se lleva por delante las tildes o los saltos de línea.
4. ~~`window.prompt` en `EditorHtml`.~~ **HECHO (2026-08-23)**: la URL se pide en una casilla
   dentro de la propia barra del editor. `window.confirm` **sí** sigue aprobado (ver
   [`diseno-ux.md`](diseno-ux.md)); el `prompt` era el único que no se había hablado.
5. ~~`presentaciones` y `formulas_volumen` se enlazan por el número de ml.~~ **REVISADO Y
   CERRADO (2026-08-23).** La relación de verdad ya existía y el número de ml solo la siembra; lo
   que faltaba era mantenerla cuando la receta nace DESPUÉS de la talla —quedaba en null para
   siempre y esas ventas entraban con costo cero—, y decidir qué pasa al cambiarle los ml a una
   receta ya enganchada (se rechaza; decisión del dueño). Detalle y porqué en
   [`inventario-costeo.md`](inventario-costeo.md). En producción no había ninguna talla suelta.

## La regla de las ~500 líneas: CUMPLIDA (2026-08-23)

Ningún archivo del proyecto pasa de 500 líneas, con **una excepción escrita y razonada**.

| Archivo | Antes | Ahora | Qué salió |
|---|---|---|---|
| `backend/repositories/perfume.repository.ts` | 713 | **463** | `clasificacion.repository.ts`, `precio.repository.ts` y el emparejado de esencias |
| `backend/repositories/inventario.repository.ts` | 683 | **452** | `inventario.compras.ts` (unidades, IVA y flete: cálculo puro), `inventario.consumoVenta.ts` y `utils/redondeo.ts` |
| `frontend/tabs/RedesTab.tsx` | 665 | **486** | la fila de un link, el modal de crear/editar y su formulario de configuración |
| `frontend/tabs/PerfumesTab.tsx` | 547 | **468** | los checkboxes de relaciones y el bloque de tallas |
| `frontend/components/table/SmartTable.tsx` | 538 | **484** | el paginador; y `SortIcon` subió a nivel de módulo |
| `frontend/dashboard/types.ts` | 517 | **20** | los 37 tipos, repartidos por área en `types/` |
| `frontend/compras/DetalleCompra.tsx` | 513 | **281** | el alta de un insumo sin salir de la factura, con su estado |

**La excepción: `backend/schemas/import.spec.ts` (667).** No es lógica, es la TABLA que describe qué
columnas acepta cada importación, un bloque por entidad. Ya tiene una sola responsabilidad, y
partirla en seis archivos solo haría más difícil lo único que se hace con ella —agregar una entidad
nueva— sin quitar ningún riesgo: en una tabla de datos no se pierde una regla, que es de lo que la
regla de las 500 líneas protege.

**Cómo se verificó cada pantalla** (no basta con que compile): captura antes y después, y las de
`RedesTab`, `PerfumesTab`, `SmartTable` (tres tablas distintas) y el modal de perfume salieron
**idénticas píxel a píxel**. En `DetalleCompra` ese método NO sirve —dos capturas del mismo código
también difieren, por el cursor que parpadea en el campo con foco—, así que se verificó recorriendo
el flujo entero: crear un insumo desde la factura y verlo quedar como línea.

## Decisiones pendientes con el dueño


- **Igualar la regla del cupón en créditos y ventas.** Hoy en ventas un cupón canjeado queda
  amarrado a su venta, y en créditos quitar el código lo libera. Es a propósito (es el único camino
  para devolver un cupón en crédito), pero igualarlas es una decisión suya.
- **Merma de fraccionamiento**: cuántos ml se pierden al trasvasar una botella original a decants.
  Mientras no se sepa, **un decant nunca se agota solo**: su botella se gasta por ml y no hay
  corte confiable para decir "ya no da para otro". Las otras tres categorías sí se agotan solas.
- **`precio_inicial`** para el caso de borde del costo promedio (punto 2 de arriba).

## No volver a levantar como hallazgo

**Que los premium al mayoreo se vendan por debajo del costo (−56% a −87%).** Es un **riesgo
aceptado a conciencia** por el dueño el 2026-08-11. Solo se le avisa si sube el precio de la
esencia premium o si llega un mayorista que pida casi puro premium.

## Antes de medir nada contra los datos

**Pídele el respaldo de producción al dueño.** La base local se atrasa rápido — el 2026-08-11 iba
una semana por detrás y reportó como rotos cuatro pendientes que él ya había cerrado.
