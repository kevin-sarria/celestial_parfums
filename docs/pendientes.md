# Dónde quedamos y qué sigue

## 🆕 2026-09-29: perfumes originales

**Hecho** (sin desplegar; **lleva migración**, `20260929120000_perfumes_originales`). Decisiones del
dueño: opción A (una ficha por original, decants de 3/5/10 ml y la botella completa del mismo
stock), precios los pone él talla por talla, nacen ocultos hasta que les ponga la info, y copiar
la ficha del contratipo si ya lo vendía (`inventario-costeo.md`, *Originales: cómo entran*).

| Qué | Estado |
|---|---|
| Comprar un original nuevo desde la factura ("Perfume original (botella)"), en botellas | hecho |
| Su ficha nace sola con decants + botella, copiando la del contratipo | hecho |
| Tarjetas y ficha pública con etiqueta Original / 1.1 / Contratipo, tallas "Decant 5 ml" / "Botella 100 ml" | hecho |
| Costo de cada talla al lado del precio en la ficha | hecho |
| Tallas en $0: la tienda las esconde y el perfume se publica igual con las que tengan precio (opción B del dueño, 2026-10-02; antes bloqueaba publicar) | hecho |
| Al agregar un producto a una venta o crédito sale "Agregado: X" o "X: ahora van 2" (en el celular la lista queda fuera de la pantalla) | hecho |
| Descripciones con formato (negrita, cursiva, listas) en perfumes, combos y Contáctame, con el editor del blog (opción B del dueño). Lo escrito antes con `**` sale en negrita solo (`diseno-ux.md`) | hecho |
| Revisión de la app (2026-10-02). Primera tanda hecha: "Presentaciones y precio" rediseñada; el cliente sabe que entró (saludo, iniciales, Mi cuenta, franja en la portada, vuelve a donde estaba). Arreglado de paso: "Hola undefined undefined" en el menú | hecho |
| Segunda tanda: buscador general del panel (Ctrl+K), meta del mes en Inicio, beneficios de crear cuenta en login/registro. **Lleva migración** (`20261002120000_meta_mensual`), la aplica el despliegue automático | hecho |
| Tercera tanda: historial de cambios (Ajustes → Historial de cambios, **lleva migración** `20261003120000_registro_cambios`) | hecho |
| Empleados con permisos, primera parte (opción C): roles con casillas, Ventas/Créditos/Clientes/Catálogo, costos escondidos, precio recalculado en el servidor, solicitudes de borrado y descuento. **Lleva migración** `20261004120000_roles_permisos` | hecho |
| Segunda parte de permisos: inventario, producción, compras, reportes, página web (hoy solo del dueño) | cuando contrate a alguien para eso |
| Plan de TikTok orgánico entregado (5 tipos de video, ritmo de 4/semana, cuidado legal con "inspirado en") | hecho |
| Desplegado el 2026-10-02 (con el despliegue automático) | hecho |
| Dueño: registrar las compras de los 15 originales, ponerles precio y publicarlos | pendiente |
| Panel partido por pestañas (`pestanas.ts`): el archivo del panel pasó de 560 kB a 41 kB | hecho |
| "¿Qué es?" se salía del recuadro en el alta de material (lo vio el dueño): `FieldRow` ya no deja desbordar | hecho |
| Las 11 ventas de 1.1 costeadas con bolsa y perfumero: el mismo aviso de Producciones las muestra y "Corregir" les baja el costo (`ventasDe11Costo.ts`). Medido en el respaldo del 22-sep con los lotes ya corregidos: **11 ventas, $23.250**, y corregir dos veces no hace nada | hecho |
| Dueño: ir a Producciones y pulsar **Corregir** en el aviso de las ventas de 1.1 (ya desplegado) | pendiente |
| Despliegue automático con GitHub Actions (opción B: cada push a main, con pruebas y respaldo) | **funcionando** desde el 2026-10-02 (servidor instalado, secretos puestos, primer despliegue `8a863a7` en verde). En el servidor ya no se edita ni se hace commit |
| 2026-09-30: el crédito ya refresca la tienda y borrarlo devuelve la mercancía (`gotchas.md`). Respaldo del día cargado en local como `celestial_prod_20260930` | hecho |
| Decants de originales al precio de la botella (en vivo eran 19): un decant ya no hereda el precio general; sin precio propio se esconde (2026-10-03, `reglas-negocio.md`) | hecho y desplegado |
| La vendedora no encontraba el panel desde la tienda ("Mi panel"); `catalogo.ver` abre Perfumes/Productos/Combos para mirar; "Limpiar todo" revivía la búsqueda en 7 tablas (2026-10-03) | hecho y desplegado |
| Alertas: los frascos de los 1.1 tienen su propia familia ("Frascos de una fragancia", opción A del dueño, 2026-10-03). **Lleva migración** `20261005120000_frascos_fragancia` | hecho |
| Alertas opción C: el mínimo sale de la velocidad de venta (avisar cuando lo que hay alcanza para menos de X semanas), en vez de un número fijo | pendiente (el dueño la eligió para después de A) |
| Precios sugeridos de decants (opción B del dueño: margen mínimo, sugerido por talla y botón para ponerlo a todos los que no tienen precio), en su propio apartado | pendiente: va dentro del rediseño del núcleo de producto |
| Rediseño del núcleo, proyecto 1: **empaque por línea, talla y combo** (Catálogo → Empaque; "Este pedido lleva" en la venta; la tienda dice qué incluye). **Lleva migración** `20261006120000_empaque_por_linea` | hecho |
| Dueño: revisar Catálogo → Empaque y el kit de sus 4 combos (arrancaron con 1 perfumero) | pendiente |
| Rediseño, proyecto 2: apartado de precios sugeridos · proyecto 3: panel por línea · proyecto 4: alertas por velocidad | pendiente, en ese orden |

## 🆕 2026-09-28: historial de pagos, Inicio, y la hoja de ruta del dashboard

**Hecho** (sin desplegar; **lleva migración**, `20260928120000_abonos_dia_colombia`):

| Qué | Estado |
|---|---|
| Historial de pagos del crédito con fecha y hora, en tu panel y en "Mi crédito" del cliente (`diseno-ux.md`) | hecho |
| Los abonos de después de las 7 p.m. quedaban con el día siguiente; corregido, y la migración arregla los 2 que lo sufrieron (`gotchas.md`) | hecho |

**Hoja de ruta que salió de revisar todo el panel** (datos de jun–sep 2026: el 79 % de lo vendido es
contratipo de 30 ml, 10 unidades de 1.1, 0 originales; 60 de 150 clientes repiten):

| # | Qué | Estado / decisión del dueño |
|---|---|---|
| 1 | **Pantalla de Inicio**: ventas del mes contra el mes anterior a la misma fecha, cuánto te deben, vencidos, qué atender, últimas ventas, qué 1.1 armar, esencias que se acaban (`arquitectura.md`) | **hecho**, sin desplegar |
| 2 | Reporte por línea: contratipo / 1.1 / original, con unidades, ventas y ganancia de cada una (`arquitectura.md`) | **hecho**, sin desplegar |
| 3 | Ganancia por fragancia (no solo las más vendidas), en el mismo reporte | **hecho**, sin desplegar |
| 4 | Lista de recompra con el ritmo de cada cliente y el punto medio para los de una compra (`arquitectura.md`, *Recompra*). Para mejorarla: guardar el teléfono de los clientes (hoy ninguno lo tiene) y enlazar las ventas a su cuenta | **hecho**, sin desplegar |
| 5 | Originales y decants (flujo botella → decants, proveedor y factura por botella) | **hecho** el 2026-09-29 (ver arriba) |
| 6 | Mayoreo: no se quita; lo usará cuando el negocio crezca. En la reorganización puede ir a "Ajustes" | decidido |
| 7 | Menú en el orden del día: Inicio, Ventas y créditos, Producción e inventario, Catálogo, Reportes, Página web, Ajustes, Mayoreo (`arquitectura.md`). Las 5 clasificaciones son una sola entrada con pestañas arriba | **hecho**, sin desplegar |
| — | Nota del dueño: el negocio está estancado porque no sabe cómo publicitar bien. Candidato a trabajo de marketing aparte | anotado |

## 📋 Lo que falta (lista corta, al cierre del 2026-09-28)

**Del dueño:**

| # | Qué | Estado |
|---|---|---|
| 1 | Desplegar lo del 28-sep en adelante | hecho el 2026-10-02; desde entonces se despliega solo con cada push |
| 2 | nginx: 404 en `/assets/` y sin caché la portada y `sw.js`. Comandos con respaldo y prueba en `deploy-migraciones.md` | pendiente (lo aplica él) |
| 3 | Mirar en el iPhone el calendario, el historial de pagos e Inicio | él lo hace |
| 4 | Guardar el teléfono de los clientes y enlazar las ventas a su cuenta: Recompra abre WhatsApp directo | él lo hace |
| 5 | Talla de 4 ventas de agosto sin costo ($365.000): 1269, 1272, 1281, 1289 | él lo hace |
| 6 | Publicar los accesorios que quiera vender en la tienda: `/accesorios` y su entrada en el menú aparecen solos en cuanto hay uno | cuando quiera |

Ya hechos por él el 2026-09-28: el **Corregir** de accesorios en Producciones, las fichas 1.1
(en producción), el 212 VIP Black a maceración, y las esencias sin género / gama Diseñador / tallas
200-250.

**Código que sigue:**

| # | Qué |
|---|---|
| 8 | Marketing: el dueño dice que el negocio está estancado porque no sabe cómo publicitar. Candidato a la skill `catalogo-recompra` + plan de publicidad |

Hechos el 2026-09-28: kit del combo, `/accesorios` (Ola 3), clasificaciones en una entrada, y las
tres decisiones del dueño: cupón igual en créditos y ventas, merma de 2 ml por decant, y sin
`precio_inicial` (`reglas-negocio.md`, `inventario-costeo.md`).

**Entorno local:** `celestial_prod_20260922` es la copia más reciente de producción (22-sep).
`perfumes_db` tiene aplicadas todas las migraciones hasta `20260928140000_kit_del_combo`.

## ✅ El abono doble — ARREGLADO (2026-09-27), sin desplegar

Pasó en producción el 2026-09-05 (abono de $50.000 de Nidia Bravo registrado dos veces; el dueño ya
corrigió ese registro a mano en la base). Tres defensas, cada una por su puerta:

1. **La pantalla** (`AbonoModal.tsx`, salió de `CreditosTab`): el Enter es el del formulario y una
   ref corta cualquier envío mientras hay uno en camino. Antes el Enter iba en crudo y cada
   pulsación —y la repetición de la tecla sostenida— mandaba otro abono.
2. **El servidor** (`addAbono`): rechaza con 409 un abono con el mismo monto al mismo crédito dentro
   de **1 minuto**, con candado `FOR UPDATE` sobre el crédito para que dos peticiones simultáneas no
   pasen las dos. El dueño dio el visto bueno a esta segunda defensa el 2026-09-27.
3. **Borrar un abono equivocado** desde el mismo modal (antes solo en la base). De paso, la ruta de
   borrar ya exige que el abono sea DE ESE crédito.

Sin migración: el deploy es `git pull` + build de los dos lados. Pruebas:
`credito.abono.bd.test.ts` (7, incluido el doble clic simultáneo) y `e2e/abono.e2e.test.ts` (4 Enter
seguidos → 1 abono; borrarlo actualiza la pantalla sin recargar).

**De paso**: `venta.totales.bd.test.ts` fallaba desde el 1 de septiembre porque sus ventas tenían
fecha fija de agosto y mide el mes en curso. Ahora usa la fecha de hoy.

**Última sesión: 27 de septiembre de 2026.** Backend **309 pruebas en verde** (+1 saltada a
propósito), frontend 84, **57 recorridos**, linter en cero. **Nada de esto está en git todavía.**
Lo hecho ese día, además del abono:

- **Modal de ventas en el iPhone** (ver `diseno-ux.md`, *El iPhone: 16 px…*). Falta que el dueño
  confirme en su teléfono cómo quedó el campo de fecha (el WebKit de Windows no lo reproduce).
- **Tablas con encabezado y pie fijos y scroll interno**, y el desplegable de "Filas" ya no corta
  los números (`diseno-ux.md`, *Tablas: un recuadro…*).
- **Frascos armados en su propia pestaña**, aparte de los materiales de Inventario.
- **Reporte de ventas por rango de fechas** con vendido, deuda, costo, ganancia, invertido y
  pérdidas, mes a mes (`arquitectura.md`, *Reportes*). Medido contra el respaldo del 22 de
  septiembre (cargado en la base local `celestial_prod_20260922`): enero–septiembre, $13,87 M
  vendidos pagados, $650.000 en deuda, ganancia medible solo sobre $2,3 M (el resto sin costo).

Sin migración en nada de esto: el deploy es `git pull` + build de los dos lados.

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

## 🟠 Plata sin costear: 4 ventas de agosto sin talla (causa YA corregida)

**La causa está encontrada y arreglada; lo que queda es corregir los registros.**

**Por qué pasó**: hasta el 2026-08-24, `createCredito` armaba su venta **a mano** con
`tx.venta.create` y **solo `perfume_ids`** — ids pelados, sin talla. El formulario SÍ mandaba
`lineas` con su `ml`; el crédito las ignoraba. Sin talla el sistema no sabe qué receta descontar, y
la venta queda con `costo_mercancia = 0`.

Lo arregló el commit `020f55c` (2026-08-24), que hizo que Créditos y Ventas entren por el mismo
`escribirVentaConConsumo`, **y llegó a producción el 2026-08-29**. Cubierto por
`credito.inventario.bd.test.ts` (7 pruebas): *"descuenta la receta de la talla que dice la línea"*.

**Lo que quedó tocado** (medido contra el respaldo del 29):

| Venta | Fecha | Quién | Valor | Qué hacer |
|---|---|---|---|---|
| 1269 | 05-ago | Maria Valentina | $56.250 | Venta normal. El texto dice "30ML": editarla y elegir esa talla |
| 1272 | 08-ago | Luisa Ovalle (crédito 6) | $78.750 | 3 líneas sin talla: Cloud, Coconut Passion y Yum Yum |
| 1281 | 23-ago | David Sánchez (crédito 7) | $140.000 | Althaïr 100ML + **Khamrah 1.1**. Antes hay que crear la ficha 1.1 desde el aviso de lotes |
| 1289 | 26-ago | Santy Tabares (crédito 8) | $90.000 | Mandarin Sky 100ML |

**$365.000 sin costo.** Se arregla abriendo cada uno, eligiendo la talla y guardando: al guardar, el
sistema devuelve lo de antes y descuenta lo de ahora. **Ojo**: ese material sale del inventario
**hoy**, al costo promedio de hoy — es lo correcto (salió de la bodega de verdad), pero las esencias
van a bajar de golpe cuando lo haga.

**El orden importa en el crédito 7**: primero crear la ficha *Khamrah 1.1* desde el aviso de lotes
por enlazar; si no, no está en el buscador y volvería a quedar apuntando al Khamrah corriente.

## ✅ Un 1.1 ya no se cobra bolsa ni perfumero — HECHO (2026-09-27), sin desplegar

Pedido del dueño el 2026-08-30. El dueño eligió la **opción A** (se configura por talla en la ficha) y
**corregir lo ya armado**. Detalle y porqué en [`inventario-costeo.md`](inventario-costeo.md).

- En la ficha, por cada talla: **Accesorios: Los del tamaño / Ninguno / Elegir…**. Un 1.1 nace en
  "Ninguno".
- Venta, envasado y lote usan la MISMA regla (`accesoriosDeFicha.ts`); antes eran tres.
- **Lleva migración** (`20260927120000_accesorios_11_ninguno`, solo datos): el deploy es con
  `npx prisma migrate deploy`.
- **Después de desplegar, el dueño pulsa "Corregir" en el aviso de Producciones.** Medido en el
  respaldo del 22-sep: 27 lotes 1.1, 27 bolsas + 27 perfumeros, **$54.300** de sobrecosto (la nota
  vieja decía 4 lotes y solo contaba la bolsa). En una copia del respaldo: las bolsas pasaron de 11
  a 38 y el lote 32 de $54.077 a $51.677.
- Las 11 ventas de esos frascos: el dueño decidió corregirlas (2026-09-29, opción B). Ver abajo.
- Pruebas: `accesoriosDeFicha.bd.test.ts` (7). Una vez, en un recorrido temporal, el aviso no
  apareció en Producciones; no se pudo reproducir en tres corridas más. Si pasa, recargar la página.

## 🟡 El aviso del build: el paquete del dashboard pasó de 500 kB (2026-08-30)

El dueño lo vio al desplegar. **No es un error**: el build termina en `✓ built` y la tienda queda
bien. Es un aviso de Vite y dice esto, medido:

| Archivo | Tamaño | Comprimido (lo que de verdad viaja) |
|---|---|---|
| `DashboardPage` | **509 kB** | 129 kB |
| `jspdf` (el PDF del catálogo) | 399 kB | 129 kB |
| `html2canvas` | 199 kB | 46 kB |

**A quién le afecta**: solo al dueño, y solo la primera vez que abre el dashboard en un navegador
nuevo (después queda en caché). La TIENDA no lo carga — el dashboard va en su propio archivo desde
que se separó, y por eso este número creció sin tocar la velocidad de los clientes.

Lo que hay que hacer cuando se atienda: partir el dashboard por pestañas con `import()` perezoso,
empezando por las que casi no se abren (Reportes, Cotizaciones, Contenido). No urge; se anota para
que no crezca en silencio.

## ✅ Las secciones mudas y la columna Stock — HECHAS (2026-08-30)

**El `catch` mudo, cerrado en los seis sitios.** La regla —*una sección puede callarse cuando no
hay nada que mostrar, nunca cuando no pudo preguntarlo*— dejó de estar escrita solo en la
documentación y ahora la obliga una pieza compartida:
`useConsultaDeApoyo` + `<NoSePudoCargar>`. Si la consulta falla sale un renglón discreto con
*Reintentar* en vez de desaparecer. Cubre `LotesPorEnlazar`, `MacerandoAhora`, `AvisoAlertas`,
`PrimerosPasos`, `PrimerosPasosProductos` y `AvisoEsenciasSinPerfume`.

*(`FrascosArmados` no necesitaba arreglo: sus datos llegan con la consulta principal de Inventario,
que ya tiene su franja de error con Reintentar.)*

**La columna Unidades en Productos**, que llevaba dos olas esperando "porque sería una consulta más
en el camino caliente del catálogo". No lo era: los frascos armados y el stock del material **ya
viajaban** en la misma respuesta. Un 1.1 se cuenta por frascos armados y un comprado por las
unidades de su material; cuando no se puede saber dice "—" y no "0", porque cero significaría
"no tengo". Con su recorrido en navegador.

## ✅ Los 3 arreglos de los 1.1 — HECHOS (2026-08-29), sin desplegar

Aprobados por él ese mismo día y construidos esa tarde. Diseño completo en
[`superpowers/specs/2026-08-29-logica-1.1-design.md`](superpowers/specs/2026-08-29-logica-1.1-design.md).
**Sin migración**: el deploy es `git pull` + build.

1. **Vender un 1.1 sin frascos ya no lo fabrica.** Se registra la venta, el frasco queda en −1, no
   se toca ni un material y **la pantalla lo dice** (antes esos avisos se calculaban y no los leía
   nadie: venta, crédito, crear y editar).
2. **El precio del 1.1 se ve antes de crearlo.** El aviso trae el de la lista de los 1.1 para esa
   talla; si esa lista no existe, enseña el heredado **en rojo**. Aceptar el de la lista **no**
   guarda precio propio, así que subir la lista los sube a todos.
3. **La disponibilidad es por talla.** La tienda tacha la talla sin frascos y no deja pedirla; el
   armador del dashboard la marca "· sin armar" sin bloquear.

**De paso**: `LotesPorEnlazar` ya distingue "no hay nada" de "no se pudo preguntar" (era el punto
naranja de arriba).

**Sigue sin aprobar, de la misma auditoría:**

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
el lote del **212 VIP Black no se rehace, se convierte** con el botón *"esto en realidad está
macerando"* — ya construido (2026-08-30).

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

> ### ⚠️ Un apagón borró el índice de MySQL local esa misma noche (2026-08-29)
>
> Se reconstruyó todo desde `Downloads/backup-celestial-2026-08-29.sql` y **las 391 pruebas volvieron
> a pasar**. Lo que cambió respecto a lo de abajo: **`celestial_prod_20260814` y
> `celestial_prod_20260825` ya no existen** (sus carpetas quedaron en `data/_roto_2026-08-29` por si
> alguna vez hicieran falta) y `perfumes_db` es ahora una copia limpia del respaldo del 29 con sus
> dos migraciones aplicadas. El diagnóstico completo, en [`gotchas.md`](gotchas.md).

- **`celestial_prod_20260829`**: copia real del servidor del **2026-08-29**, la más reciente
  (`Downloads/backup-celestial-2026-08-29.sql`). Es contra la que se mide de ahora en adelante.
  Se recargó limpia esa noche, así que refleja el respaldo tal cual.
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

## ✅ Las garantías mueven el inventario — HECHAS (2026-08-30), sin desplegar

Reponer un frasco lo sacaba de la repisa del dueño y **no de su sistema**, y el que el cliente
devolvía no volvía nunca. Detalle y porqués en [`reglas-negocio.md`](reglas-negocio.md).

> **⚠️ TRAE MIGRACIÓN** (`20260830130000_devolucion_inventario`): el deploy es `git pull` +
> **`npx prisma migrate deploy`** + build + `pm2 restart`.

**Decisión suya de ese día: se pregunta caso por caso.** Se le ofreció deducirlo del motivo con una
tabla fija y lo descartó con razón — un *"llegó equivocado"* puede volver abierto y un *"llegó
dañado"* puede ser solo la caja. El motivo dice por qué se quejó el cliente, no en qué estado
llegó el frasco.

| Situación | Qué le pasa al inventario |
|---|---|
| Repusiste N frascos | **Salen N**, igual que una venta (de lo armado; si no hay y no es un 1.1, se fabrica) |
| Te lo devolvieron y sirve | **Entra**, a la talla que se vendió y al costo promedio de hoy |
| Te lo devolvieron y no sirve | **Nada**: su costo ya se cargó el día de la venta |
| No te devolvieron nada | **Nada** |

**Lo que cambia en la pantalla**: el formulario estrena una casilla *"el cliente me devolvió el
producto"* y, si se marca, *"¿se puede volver a vender?"*. Debajo, un renglón dice lo que va a
pasar **antes** de guardar ("Al guardar, tus frascos armados: −1 que enviaste · +1 que
recuperaste"). Y lo que el servidor no pudo hacer —reponer un 1.1 sin tenerlo armado, una línea sin
costear— sale como aviso, igual que en ventas y créditos.

**Lo que se movió también**: cerrar, reabrir, corregir y **borrar** un caso deshacen y rehacen su
efecto, así que corregir de 1 a 2 frascos repuestos no cuenta el primero dos veces. Un caso puede
nacer ya resuelto (*"se lo repuse ayer y lo anoto hoy"*) y también mueve inventario.

11 pruebas de base con la tabla entera de combinaciones y un recorrido en navegador que va de la
venta al frasco que vuelve, y de vuelta.

## ✅ La maceración — HECHA (2026-08-30), sin desplegar

Producir son dos momentos y el sistema creía que era uno. **Construido entero**: poner a macerar,
envasar (varias veces y en tallas distintas), cerrar tanda, borrar, y convertir un lote viejo.
Detalle y porqués en [`inventario-costeo.md`](inventario-costeo.md); diseño en
[`superpowers/specs/2026-08-24-maceracion-y-envasado-design.md`](superpowers/specs/2026-08-24-maceracion-y-envasado-design.md).

> **⚠️ TRAE MIGRACIÓN** (`20260830120000_maceracion`): el deploy es `git pull` +
> **`npx prisma migrate deploy`** + build + `pm2 restart`.

**Lo que cambia para el dueño:**

- *Registrar uso* pasa de un botón a tres: **Puse a macerar** (gasta líquido, no envases),
  **Envasé frascos** (gasta envases, saca ml del granel) y **Armé directo**, que es el de siempre.
- Producciones estrena **Macerando ahora**, con los días que lleva cada tanda y sus botones
  *Envasar* y *Cerrar tanda*.
- Inventario estrena la métrica **Macerando**: sin ella, poner a macerar hacía *desaparecer* plata
  de la bodega.
- Cada lote de armado directo tiene un botón para decir **"esto en realidad está macerando"**.

**Lo primero que hay que hacer con esto, en producción**: convertir el lote del **212 VIP Black**
del 11 de agosto. Devuelve 5 envases, 5 bolsas y **5 perfumeros** —parte del agujero que ese
material tiene en negativo— y deja los 500 ml donde deben estar.

**Cubierto por 26 pruebas**: 11 de aritmética (reproducen los $24.187,956 por frasco del lote real),
14 contra base y un recorrido en navegador que macera, envasa, vende y comprueba que **la esencia
sale una sola vez**.

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
