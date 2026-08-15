# Dónde quedamos y qué sigue

**Última sesión: 15 de agosto de 2026.** Todo compila, **209 pruebas en verde** (115 backend +
68 frontend + 26 recorridos) y **todo está commiteado** en la rama `producto-terminado`.

**El producto terminado está TERMINADO en código.** Lo único que queda es data entry en la
tienda en vivo, y son decisiones y fotos del dueño: el runbook está más abajo.

## ⚠️ Lo primero

**NINGUNO de los 9 frascos armados se puede vender todavía por el sistema** — ni los 4 de "1.1"
ni los 5 de 212 VIP Black.

El motivo es el mismo para los nueve, y **no es que falte código**: el producto terminado
**arranca desde que se activa y nunca mira hacia atrás** (mismo criterio que el consumo por
venta). Comprobado contra la copia de producción del 2026-08-14: hay **5 lotes registrados**
(perfumes 424, 549, 651, 619 y 446) y **`movimientos_terminado` está vacío**, con cero
presentaciones con stock. Esos lotes se registraron ANTES de que existiera la tabla, así que
para el sistema esos frascos no existen y venderlos volvería a descontar la receta — el
problema original.

Se arregla con el **runbook** de abajo: hay que **rehacer los 5 lotes** (borrarlos y volverlos a
registrar con el código nuevo ya desplegado), y de paso los 4 de 1.1 pasan a sus fichas nuevas.
Son ~20 minutos en el dashboard.

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

- **`celestial_prod_20260814`**: copia real del servidor del 2026-08-14 **con la migración ya
  aplicada**. Es la base contra la que se prueban las migraciones. El respaldo original sigue en
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
- **Todo subido a git** en la rama `producto-terminado` (14 y 15 de agosto): el producto terminado
  con su migración, los 9 documentos de `docs/` y la mudanza del frontend a la capa HTTP única.
  **Falta desplegar**: en el servidor no está nada de esto todavía.

## El refactor del frontend (capa HTTP única) — a mitad de camino

Detalle y decisiones en [`arquitectura.md`](arquitectura.md). Al 2026-08-15 van **67 llamadas por
`http` y quedan 59** con el `fetch` viejo. Migrado todo el dashboard del día a día más el mayoreo
(Cotizaciones, Tamaños y fórmulas, Costos de producción) y el **Excel compartido**. Quedan:
**Publicidad, Recompensas y Entregas, Devoluciones** (pestaña y formulario), el **detalle de
compra**, **Proveedores**, las **clasificaciones** (`LookupTab`), la **campana**, el
`ListasProvider`, y todas las **páginas públicas** (tienda, blog, contacto, portal del cliente,
login/registro).

Se migra **pantalla entera o nada**, y al migrarla se aprovecha para que ningún handler ignore la
respuesta (toast con el mensaje del servidor). Cuando caiga la última se borran `client.ts` y
`useGuardedFetch`.

## El resto de la lista (después del producto terminado)

1. **DECISIÓN DEL DUEÑO — el caso de borde del costo promedio.** Al borrar la ÚNICA compra de un
   material, su costo se queda en el de la compra borrada en vez de volver al de partida. Está
   medido y con dos pruebas puestas (una `it.skip` con la etiqueta `DISCREPANCIA` y otra que fija
   lo que hace hoy). **No se arregló porque el precio de arranque no se guarda en ninguna parte**:
   exige una columna nueva (`precio_inicial`) con su migración. Detalle en
   [`inventario-costeo.md`](inventario-costeo.md).
2. **Rellenar la talla de 4 líneas de venta** que sí se pueden deducir: las ventas **1269**
   ("30ML") y **1272** ("50ML") lo dicen sin ambigüedad en el texto de la venta. Las otras 8
   (ventas 1179, 1180, 1181, 1249 y 1219) son ambiguas de verdad — solo el dueño sabe si fue el de
   200 o el de 250 ml, y la 1219 es un "Combo Personalizado" con dos tallas en una línea.
   **Rellenarlas NO recupera el descuento de inventario** (el consumo no es retroactivo, por
   diseño): sirve para que el histórico quede completo.
3. **3 esencias sin género** (eran 189). Se llenan desde el Excel *Lista de materiales*.
4. **La gama "Diseñador" tiene mínimo configurado y CERO esencias**: o se le cuelgan esencias o se
   borra.
5. **Paso 3 del costeo por gama**: separar la pantalla — la receta se queda en *Tamaños y fórmulas*
   (la usa toda la app para descontar inventario) y los rangos de precio mayorista se van a
   *Mayoreo*. Hoy `formulas_volumen` mezcla tres cosas.
6. **Separar "200/250ML" en dos tallas reales** y sembrar su stock inicial. Ya se puede hacer
   desde Clasificaciones sin tocar la base: crear "200 ML" y "250 ML" nace con su número y su
   receta enganchados solos.
7. **Accesibilidad de los formularios**: `Field` (`dashboard/ui.tsx`) pinta un `<label>` suelto sin
   `htmlFor`, así que ni el navegador ni un lector de pantalla lo asocian al campo. Hay que
   hablarlo con el dueño antes de tocar 25 modales.

## Decisiones pendientes con el dueño

- **Igualar la regla del cupón en créditos y ventas.** Hoy en ventas un cupón canjeado queda
  amarrado a su venta, y en créditos quitar el código lo libera. Es a propósito (es el único camino
  para devolver un cupón en crédito), pero igualarlas es una decisión suya.
- **Merma de fraccionamiento**: cuántos ml se pierden al trasvasar una botella original a decants.
  Mientras no se sepa, **un decant nunca se agota solo**: su botella se gasta por ml y no hay
  corte confiable para decir "ya no da para otro". Las otras tres categorías sí se agotan solas.
- **`precio_inicial`** para el caso de borde del costo promedio (punto 1 de arriba).

## No volver a levantar como hallazgo

**Que los premium al mayoreo se vendan por debajo del costo (−56% a −87%).** Es un **riesgo
aceptado a conciencia** por el dueño el 2026-08-11. Solo se le avisa si sube el precio de la
esencia premium o si llega un mayorista que pida casi puro premium.

## Antes de medir nada contra los datos

**Pídele el respaldo de producción al dueño.** La base local se atrasa rápido — el 2026-08-11 iba
una semana por detrás y reportó como rotos cuatro pendientes que él ya había cerrado.
