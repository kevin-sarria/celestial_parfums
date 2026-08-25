# Maceración y envasado: producir son DOS momentos

**Fecha:** 2026-08-24
**Decidido con el dueño** en esta misma sesión (sus respuestas están citadas más abajo).
**Sustituye a** la "Ola 2" de `2026-08-23-productos-y-accesorios-design.md` en lo que toca al
alta del 1.1 desde el lote: ese alta vive ahora en *Envasé frascos*.

## El problema, medido

Hoy `registrarProduccion` (`inventario.repository.ts:210`) hace TODO en un solo acto: descuenta
esencia + diluyente + **un envase por unidad** y deja N frascos armados de una talla fija. En
perfumería de verdad son dos momentos separados por semanas, y el dueño ya trabaja así.

| El sistema cree | La realidad (lote de 212 VIP Black, 11 ago 2026) |
|---|---|
| 5 frascos de 100 ml listos para vender | ~500 ml en un frasco de 1 litro **macerando** |
| Se gastaron 5 envases de 100 ml | Los 5 envases siguen **vacíos en la repisa** |

No fue un error del dueño: **hizo lo único que el sistema le dejaba hacer.** Textual (2026-08-23):
*"hice una cosa rara"*.

**Por qué urge**: va a pasar de una maceración suelta a macerar **las 10 referencias más
vendidas**. Con 10 graneles en curso, aproximar cada uno como "N frascos de 100 ml" deja el
inventario y los costos inservibles: la plata está en un sitio donde el sistema no puede verla.

## Lo que decidió el dueño (2026-08-24)

Estas cinco respuestas son las que gobiernan el diseño. Si alguna cambia, cambia el modelo.

1. **En el frasco que macera está TODO mezclado** — esencia, diluyente y lo demás desde el primer
   día. Consecuencia: **el granel queda costeado el día que se mezcla**, y envasar solo añade el
   envase. No hay diluyente que gastar al final.
2. **Cada tanda va por separado.** Dos maceraciones de 212 VIP Black son dos frascos distintos en
   la repisa, cada uno con su fecha, su costo y sus ml; al envasar se elige de cuál se saca. Se
   descartó el saldo único promediado: con 10 graneles en curso, lo que importa es *cuál lleva más
   tiempo reposando*, y un promedio lo borra.
3. **Envasar descuenta lo exacto** (talla × unidades) y el resto se queda como saldo. La pérdida
   se anota con **"Cerrar tanda"**, el día que el frasco se acaba de verdad. Se descartó pedirle
   los ml reales en cada envasado (le obliga a medir lo que hoy no mide) y se descartó el cierre
   automático (cerraría tandas que aún servían para un decant).
4. **El tiempo de reposo depende de la fragancia**, así que la fecha de "listo" la escribe él,
   tanda por tanda, y es **opcional**. El sistema no propone plazos ni bloquea nada: solo muestra
   los días que lleva.
5. **El lote del 11 de agosto se convierte con un botón**, no a mano. Devuelve los 5 envases,
   quita los 5 frascos que no existen y crea la tanda de 500 ml con su fecha y su costo original.

Y un dato de tamaño que evita sobre-construir: **hoy hay UNA sola maceración en curso.**

## La forma elegida: una libreta propia (opción B)

Se compararon tres:

| | Cómo guarda el granel | Por qué NO / SÍ |
|---|---|---|
| A | Como un insumo más del inventario | Para tener tandas separadas habría que crear un insumo nuevo en cada maceración: el catálogo de insumos se llena de basura y los desplegables de compras se vuelven inútiles |
| **B** | **Tabla propia `maceraciones`** | **Elegida.** Es el tercer hermano de un patrón que ya funciona dos veces (materiales y frascos armados): cada tanda con su fecha, su costo y sus ml, sin ensuciar nada |
| C | `producciones` con una marca de etapa | Mezcla ml con unidades en la misma lista; en tres meses nadie sabe qué es cada fila |

## Modelo de datos

### Tabla nueva: `maceraciones`

```prisma
model Maceracion {
  id                 Int       @id @default(autoincrement())
  fecha              DateTime  @db.Date        // cuándo se puso a macerar
  perfume_id         Int                       // qué fragancia (sin esto no se sabe qué se envasa)
  /// Proporción de referencia usada al mezclar (de qué receta salió el reparto
  /// esencia/diluyente). Se guarda para poder explicar el costo, no para recalcularlo.
  formula_volumen_id Int?
  ml_iniciales       Decimal   @db.Decimal(10, 2)
  /// Costo de UN ml, congelado el día de la mezcla. De aquí sale el costo de cada frasco.
  costo_ml           Decimal   @db.Decimal(12, 6)
  costo_total        Decimal   @db.Decimal(12, 2)
  /// Cuándo estará lista. La escribe el dueño y es opcional (decisión 4).
  listo_estimado     DateTime? @db.Date
  /// Null = sigue viva. Con fecha = cerrada, y `ml_merma` dice qué se perdió.
  cerrada_en         DateTime? @db.Date
  ml_merma           Decimal?  @db.Decimal(10, 2)
  nota               String?   @db.VarChar(255)
  created_at         DateTime  @default(now())

  perfume   Perfume         @relation(fields: [perfume_id], references: [id])
  formula   FormulaVolumen? @relation(fields: [formula_volumen_id], references: [id], onDelete: SetNull)
  envasados Produccion[]

  @@index([cerrada_en])
  @@map("maceraciones")
}
```

**Lo que NO lleva la tabla: el saldo de ml.** Se recalcula siempre:

```
saldo = ml_iniciales − Σ(envasados: unidades × ml de su talla) − (ml_merma ?? 0)
```

Es la regla de la casa —*lo que se puede recalcular, se recalcula*— y aquí se gana algo concreto:
el día que el dueño corrija o borre un envasado viejo, el saldo se corrige solo en vez de quedarse
mintiendo.

### `producciones` gana una columna

```prisma
maceracion_id Int?   // de qué tanda salieron estos frascos (null = armado directo, como siempre)
```

Con `maceracion_id`:
- El lote **NO consume esencia ni diluyente** (ya se gastaron al macerar): solo el envase y los
  accesorios.
- Su costo unitario = `ml de la talla × costo_ml de la tanda + envase + accesorios`.

Sin `maceracion_id` el comportamiento es **exactamente el de hoy**. El camino viejo no se toca:
quien arma directo sigue armando directo.

### Un valor nuevo en `MovimientoTipo`: `maceracion`

La esencia y el diluyente que se van al granel se anotan con tipo `maceracion`, no `produccion`.
No es cosmético: `revertirMovimientos(tx, tipo, referencia_id)` busca por tipo + referencia, y con
las dos cosas bajo `produccion` el id 7 de una maceración y el id 7 de una producción serían
indistinguibles — borrar un lote devolvería material de una maceración ajena.

## Las pantallas

### Inventario ▸ Registrar uso: un botón pasa a tres

```
Registrar uso ▾
  🧪 Puse a macerar              ← gasta esencia y diluyente. NO gasta envases.
  🍾 Envasé frascos              ← gasta envases y saca ml del granel.
  📦 Armé directo (sin macerar)  ← el de hoy, intacto.
```

### Puse a macerar

```
¿Qué fragancia?         [ 212 VIP Black                        ▾ ]
¿Cuántos ml preparaste? [ 500 ]
Proporción de           [ 100 ml (50 esencia / 48,9 diluyente)  ▾ ]
¿Cuándo estará lista?   [ __/__/____ ]  (opcional)
Nota                    [ ..................................... ]

Se descontará: Esencia 212 Vip Black 250 ml · Diluyente 244,5 ml
               Sellador 4 ml · Feromonas 1,5 ml
Costo de la tanda: $83.939,78  →  $167,88 por ml
```

> **Los números son los REALES**, medidos contra el respaldo de producción del 2026-08-24 (lote
> `producciones.id = 1`, movimientos 287-293). La receta del dueño es **mitad esencia**, no un
> tercio: 100 ml = 50 esencia + 48,9 diluyente + 0,8 sellador + 0,3 feromonas.

La proporción sale de una receta existente (`formulas_volumen`) **escalada** a los ml que se
maceran: es el mismo motor de costeo de las cotizaciones, sin reimplementar nada. Escalar en vez
de inventar una proporción nueva evita que el granel salga con una concentración que ninguna talla
usa.

### Envasé frascos

```
¿De cuál granel?   [ 212 VIP Black · 500 ml · lleva 13 días  ▾ ]
¿Qué talla?        [ 100 ML ▾ ]      ¿Cuántos frascos? [ 5 ]
¿Qué envase?       [ Frasco 100ml normal ▾ ]
¿De qué producto?  [ 212 VIP Black ▾ ]   ← aquí vive el alta del 1.1 (ver abajo)

Saca 500 ml de los 500 → quedan 0 ml
Cada frasco te queda en $24.188   ·   [ Envasar ]
```

- Se puede envasar **en varias tandas y en tallas distintas** del mismo granel (3 × 30 ml hoy,
  2 × 100 ml la semana que viene).
- **Si los ml no alcanzan: avisa y deja pasar**, igual que hoy con los insumos que no alcanzan
  (`ProduccionModal.tsx`, bloque `faltantes`). Criterio sostenido: bloquear a alguien un martes
  por la noche porque midió a ojo es peor que un saldo negativo visible.

### El alta de un 1.1, desde el envasado

En "¿de qué producto son estos frascos?", el buscador ofrece
**`+ Crear "Bon Bon 1.1" como producto nuevo`**, con envase, precio y esencia ahí mismo.

Es el **tercer hermano** de un patrón que ya existe dos veces en `emparejarEsencias.repository.ts`:

| Origen | Función | Qué crea |
|---|---|---|
| Una esencia | `enlazarOCrearPerfume` | La fragancia que sale de ella (`fabricado`) |
| Un accesorio | `enlazarOCrearAccesorio` | El producto que se revende tal cual (`comprado`) |
| **Un envasado** | **nuevo** | **El 1.1 que acabas de envasar (`solo_armado`)** |

Reglas heredadas, no reinventadas:
- **Nace apagado** (`publicado: false`), como ya nacen todos los productos desde el 2026-08-24.
- **Si ya existe un producto con ese nombre, no se toca**: se avisa y decide el dueño.
- **Puerta única**: al existir esta, se quita la casilla "Solo se vende si ya está armado" de
  *+ Nuevo producto* (`FichaPerfumeModal.tsx`), que hoy está ahí como deuda intencional. Dos
  puertas acaban en "Bon Bon 1.1" y "Bon bon 1.1" como dos fichas, stock partido y costos que no
  cuadran.
- **Y hay que reescribir `backend/e2e/disponibilidad.e2e.test.ts`** (Recorrido 6, primer `it`):
  hoy crea el 1.1 marcando esa casilla. Sin ella, el recorrido tiene que crear el 1.1 pasando por
  el envasado.

**Por qué el envasado y no la maceración**: un 1.1 se define por su **envase premium**, y el
envase se elige justo ahí. Un granel no es todavía un 1.1: de la misma tanda pueden salir tres
frascos normales y dos 1.1.

### Los envases en cero (el bug del perfumero en −5.000)

Hoy el desplegable de envase es un `SelectSimple` que lista todos los envases por igual, y por eso
se eligen envases que están en cero. Pasa a `BuscadorSelect` con este orden:

```
Frasco 100ml normal          38 disponibles
Frasco 100ml luxury           7 disponibles
──────────────────────────────────────────
Frasco 1.1 premium            sin existencias   (gris, al final)
```

Elegir uno en gris **avisa** que el stock quedará negativo, y deja seguir. **No se esconden**:
registrar una producción de la semana pasada, cuando sí había envase, es un caso legítimo y
esconderlos lo bloquearía. (Decisión ya tomada el 2026-08-23; este diseño solo la ejecuta.)

### Producciones deja de ser una sola lista

```
MACERANDO AHORA (1)
 212 VIP Black   500 ml   desde 11 ago (13 días)   $120,94/ml   [Envasar] [Cerrar tanda]

YA ENVASADO (histórico)
 21 ago   4 × Bon Bon 1.1   $327.316   ⚠ Sin foto   [Completar]
```

**Completar** abre la ficha REAL del producto (el mismo modal de Productos), no una copia. El
aviso ⚠ dice qué le falta: sin foto, sin descripción o sin publicar. Va aquí porque es donde el
dueño está cuando termina de armar; pedirle que se acuerde de ir a otra pestaña es exactamente
cómo quedaron 9 frascos sin ficha.

## Los números

- **El costo del granel se congela** el día de la mezcla, al promedio vigente de cada insumo. Si
  la esencia sube mañana, esa tanda no cambia. Misma regla que ya usan los lotes y las compras.
- **Costo de cada frasco** = ml de la talla × `costo_ml` + envase + accesorios, congelado al
  envasar. **Macerar + envasar tiene que dar lo mismo que armar directo.** Ya está comprobado
  contra los datos reales (respaldo del 2026-08-24), y esta cadena es la prueba que cierra el
  diseño:

  | | |
  |---|---|
  | Granel: esencia 250 ml + diluyente 244,5 + sellador 4 + feromonas 1,5 | **$83.939,78** (500 ml → **$167,879 56/ml**) |
  | Envasado: 5 envases 100 ml + 5 bolsas organza + 5 perfumeros | **$37.000,00** |
  | Total | **$120.939,78** → **$24.187,956 por frasco** |

  Es exactamente el `costo_unitario` que hoy tiene `producciones.id = 1`. Si la implementación no
  reproduce ese número, está mal.

- **El envasado consume también los accesorios de la receta** (bolsa organza, perfumero…), no solo
  el envase: en el lote real son $11.400 de los $37.000. Se descubrió midiendo, y es la diferencia
  entre devolver bien o mal el inventario al convertir el lote viejo.
- **Cerrar tanda** anota los ml que quedaron como pérdida, con su plata (`ml_merma`). No genera
  movimiento de inventario: el granel no es un insumo y no hay a quién restarle. Sale en el
  reporte como merma de maceración.
- **Inventario gana la métrica "Macerando"** (ml y plata), al lado de "Frascos armados". Sin ella,
  poner a macerar haría *desaparecer* plata de la bodega: sale de los materiales y no entra en
  ningún sitio visible.
- **Vender no cambia**: sigue saliendo primero de los frascos armados (`sacarDeTerminado`), y el
  granel no se toca al vender — un granel no se vende, se envasa.

## Deshacer

| Acción | Qué devuelve | Regla |
|---|---|---|
| Borrar un **envasado** | Los ml vuelven al granel (el saldo se recalcula solo), los envases vuelven a la bodega, los frascos armados se quitan | Igual que hoy, más el saldo |
| Borrar una **maceración** | La esencia y el diluyente vuelven a la bodega | **Solo si no se ha envasado nada de ella.** Si ya hay envasados, primero se borran esos |

Esa condición es el arreglo de fondo del susto viejo: hoy borrar el lote del 212 devolvería una
esencia que **sí se gastó** (está en el frasco de 1 litro). Con la regla, eso no puede pasar por
accidente.

## Convertir el lote viejo

En Producciones, un lote de **armado directo** gana un botón discreto: **"Esto en realidad está
macerando"**. Aparece solo si **sus frascos siguen completos en stock**: si ya se vendió alguno, no
hay nada que convertir sin descuadrar el terminado, y el botón no se ofrece (con un "ya vendiste
frascos de este lote" al pasar por encima). Al confirmar:

1. Devuelve a la bodega **los envases Y los accesorios** del lote: en el lote real son 5 × Envase
   100 ml, 5 × Bolsa Organza y **5 × Perfumero Recargable**. Lo de los accesorios se descubrió
   midiendo el respaldo del 2026-08-24, y no es un detalle: el Perfumero Recargable está hoy en
   **−25 unidades** en producción, y estos 5 son parte de ese agujero.
2. Quita los frascos que el sistema cree que existen (5 × 212 VIP Black 100 ML).
3. Crea la tanda: `ml_iniciales = unidades × ml de la talla` (5 × 100 = 500 ml), con la **fecha
   original** (11 ago) y el **costo original del lote** (no el promedio de hoy).
4. **Borra la producción** —revirtiendo sus movimientos, como ya hace `eliminarProduccion`— y deja
   la tanda en su lugar: ese lote nunca fue un envasado, y dejarlo en el histórico haría contar dos
   veces la misma esencia.

**El botón aparece en todos los lotes viejos, pero solo el dueño decide cuál convertir.** Los 4
lotes de 1.1 son frascos que sí existen físicamente y no se tocan. El sistema no puede adivinar
cuál es cuál: la diferencia está en la repisa, no en los datos.

Esto **cambia el runbook de los 9 frascos** (`docs/pendientes.md`): el lote de 212 VIP Black ya no
se "rehace", se **convierte**. Los otros 4 siguen su runbook tal cual.

## Qué NO cambia

- Armar directo sin macerar (el flujo de hoy, entero).
- Registrar ventas, el consumo por venta, los precios, los descuentos.
- La tienda pública y las fichas del catálogo.
- Los 222 perfumes del dueño: ninguno se toca.

## Fuera de alcance (a propósito)

- **Columna STOCK** en la tabla de Productos (esperaba a la Ola 2; sigue esperando).
- **La tienda pública**: `/accesorios` aparte y sacar los accesorios de `/perfumes` (Ola 3).
- **Avisos automáticos** de "tu granel ya está listo": el dueño pidió que el sistema no le apure.
- **Macerar varias fragancias en un mismo frasco**: no lo hace y no se modela.

## Pruebas que tiene que dejar

**Aritmética (sin base):**
1. Escalar la proporción de una receta a N ml reparte esencia y diluyente sin perder ml.
2. `costo_ml` de la tanda × ml de la talla + envase = el costo del frasco.
3. **Macerar + envasar da el MISMO costo que armar directo** con los mismos insumos.

**Con base:**
4. Macerar descuenta esencia y diluyente y **no toca los envases**.
5. Envasar descuenta envases, suma frascos armados y baja el saldo de la tanda.
6. Envasar en dos tallas distintas de la misma tanda deja el saldo correcto.
7. Cerrar tanda anota la merma y el saldo queda en cero.
8. Borrar un envasado devuelve ml, envases y quita los frascos.
9. Borrar una maceración **con envasados se rechaza** con un mensaje que dice cuántos hay.
10. Convertir un lote viejo deja: envases devueltos, frascos quitados, tanda creada con la fecha y
    el costo originales.
11. Crear un 1.1 desde el envasado lo deja `solo_armado`, apagado, y con sus frascos.

**En el navegador:**
12. Recorrido completo: macerar → envasar → el frasco aparece en "Frascos ya armados" → vender ese
    frasco no descuenta esencia otra vez.
13. El desplegable de envases muestra los de cero al final, en gris, y avisa al elegirlos.

## Migración y deploy

Trae migración: tabla `maceraciones`, columna `producciones.maceracion_id` y el valor `maceracion`
en el enum `MovimientoTipo`. El deploy es el de siempre (`git pull` + `npx prisma migrate deploy` +
build + `pm2 restart`).

**Ojo con las dos bases locales**: `prisma migrate deploy` revienta el MariaDB local, así que la
migración hay que aplicarla a mano y registrarla a mano en `_prisma_migrations` en `perfumes_db` y
en `perfumes_test` (ver `docs/gotchas.md`). En el servidor funciona normal.

## Archivos que toca

**Backend**
- `prisma/schema.prisma` + migración nueva.
- `repositories/inventario.maceracion.ts` **(nuevo)**: macerar, envasar, cerrar, revertir,
  convertir el lote viejo, listar tandas con su saldo.
- `repositories/inventario.repository.ts`: `registrarProduccion` acepta `maceracion_id` y, con
  ella, no consume esencia/diluyente. `eliminarProduccion` devuelve los ml.
- `repositories/emparejarEsencias.repository.ts`: el tercer hermano (`enlazarOCrearArmado`).
- `routes/inventario.router.ts` + `schemas/inventario.schema.ts`: los endpoints nuevos.

**Frontend**
- `tabs/inventario/MaceracionModal.tsx` y `EnvasadoModal.tsx` **(nuevos)**.
- `tabs/inventario/ProduccionModal.tsx`: el envase pasa a `BuscadorSelect` con los ceros al final.
- `tabs/ProduccionesTab.tsx`: las dos secciones (macerando / ya envasado).
- `tabs/InventarioTab.tsx`: la métrica "Macerando".

Ningún archivo debería pasar de 500 líneas: la lógica de maceración va en su propio archivo desde
el principio, no dentro de `inventario.repository.ts` (452 líneas hoy).
