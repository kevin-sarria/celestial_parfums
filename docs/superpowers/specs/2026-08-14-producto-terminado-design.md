# Producto terminado: los frascos que ya están armados

**Fecha**: 2026-08-14 · **Decidido con el dueño**: construirlo ya (opción C).
**Estado**: diseño aprobado y **sin preguntas abiertas**. Verificado contra la copia real de
producción del 2026-08-14 (cargada en la base local `celestial_prod_20260814`).

## El problema, y por qué corre prisa

El dueño registró producciones de perfumes **1.1** en el servidor de producción. Hoy:

- `registrarProduccion` (`inventario.repository.ts:286`) **solo descuenta** los materiales de
  la receta y congela el costo del lote. **No suma nada** en ninguna parte.
- `consumirPorVenta` descuenta **otra vez** la receta completa al vender.

O sea que **los frascos ya armados van a descontar su material dos veces**: una al armarlos y
otra al venderlos. Consecuencias, todas de plata:

- El costo de mercancía del mes sale inflado y la **ganancia sale falsa**.
- El stock de esencia se va a **negativo** sin que nada lo explique.
- Ese stock manda además en el **agotado automático**, el **pedido sugerido** y la **campana**:
  los cuatro empiezan a mentir a la vez.

**Mientras esto no esté construido, no se venden por el sistema los frascos ya producidos.**

## La regla (ya estaba acordada, aquí se construye)

> Al vender, si hay **producto terminado** armado se descuenta ESE primero; si no hay, o no
> alcanza, se consumen los **materiales** por el resto.

Y su complemento, que es lo que hace que los números cuadren:

> El costo de mercancía de lo que sale del terminado es el **costo con el que se armó**
> (congelado en la producción), no el que tendría la receta hoy.

## Modelo de datos

Se copia el patrón que ya existe para los materiales, para no tener dos mentales distintos:
**el libro de movimientos es la verdad; el stock es una proyección.**

```
producciones ──(+)──►┐
                     ├──► movimientos_terminado ──(proyección)──► perfume_presentacion.stock
ventas ──────(−)──►──┘                                                        .costo_promedio
```

- **`movimientos_terminado`** (tabla nueva): `perfume_id`, `presentacion_id`, `tipo`
  (`produccion` | `venta` | `ajuste` | `garantia` | `merma`), `cantidad` (+ entra, − sale),
  `costo_unitario` congelado, `fecha`, `referencia_id`, `nota`.
- **`perfume_presentacion`** suma `stock` y `costo_promedio`. Es la tabla correcta porque ya
  ES perfume × talla y ya lleva el envase y los accesorios de esa combinación.
- **No se reutiliza `movimientos_inventario`**: su `insumo_id` es obligatorio y lo asumen
  todas las consultas que ya existen. Hacerlo opcional para meter aquí perfumes es la clase de
  atajo que revienta en otro sitio.
- El costo promedio se calcula con la **misma fórmula ponderada** que los insumos, así que
  armar dos lotes a distinto costo da un promedio correcto.

Migración: `20260814120000_producto_terminado`. **No toca ni una fila existente**: las
presentaciones nacen con stock 0, que es exactamente lo que hay hoy.

## Cómo entra

`registrarProduccion` ya recibe `perfume_id`, la fórmula y la cantidad, y ya calcula el
`costo_unitario` del lote. Se le suma un movimiento `+cantidad` de terminado con ese costo.

- **La talla sale de la fórmula**: `presentaciones.formula_volumen_id` ya enlaza las dos por
  número, así que no hay que preguntarla.
- **Sin `perfume_id` no hay terminado**: hoy ese campo es opcional (se puede registrar "armé 20
  de 30 ml" sin decir de qué fragancia). Esa producción sigue descontando materiales y no suma
  frascos — no se puede adivinar de qué perfume son.
- **Borrar un lote revierte las dos cosas**: devuelve los materiales (ya lo hace) y quita los
  frascos. Si esos frascos ya se vendieron, el stock queda negativo **con aviso**, igual que
  el criterio ya acordado para las ventas.

## Cómo sale

En `consumirPorVenta`, por cada línea (perfume + talla + unidades):

1. `disponible = perfume_presentacion.stock`
2. `deTerminado = min(unidades, disponible)` → movimiento `−deTerminado`, y el costo de esas
   unidades es el `costo_promedio` del terminado.
3. `porArmar = unidades − deTerminado` → se consume la receta como hoy, con su costo.
4. `ventas.costo_mercancia` = la suma de los dos.

- **Editar o borrar la venta revierte las dos partes** (`revertirVenta` ya existe y se le suma
  el terminado).
- **Si no alcanza, deja pasar y avisa**: la venta ya ocurrió en la vida real. Mismo criterio
  que el resto del módulo.

## Lo que cambia en otras pantallas (y no se puede olvidar)

- **Agotado automático**: hoy un fabricado sin esencia sale AGOTADO. Con frascos armados eso
  deja de ser cierto — **si hay terminado, el perfume está disponible aunque no haya esencia**.
  Es el caso exacto de los 1.1 y es lo que los hace vendibles.
  → `mapPerfume` pasa a mirar `stock` además de la esencia.
- **Pedido sugerido y campana**: no cambian de fórmula, pero el consumo de materiales baja
  porque parte de las ventas ya no consume receta. Es correcto: refleja lo que de verdad se
  gasta.
- **Costos de producción / margen por fragancia**: siguen costeando la receta. No cambian.
- **Inventario** gana una lectura nueva: "frascos armados", que hoy no existe en ninguna
  pantalla.

## Lo que NO cambia

- Las ventas históricas. El terminado arranca desde que se active, **nunca hacia atrás**
  (mismo criterio que el consumo por venta).
- El precio, la lista de precios y los combos.
- El costeo de cotizaciones B2B.

## Cómo entra el 1.1

Decidido con el dueño: **el 1.1 es un producto distinto que se vende aparte**, así que lleva
**su propia ficha** en el catálogo (nombre, foto real del 1.1 y precio propio).

- Es `tipo_producto = 'fabricado'` como cualquier otro: tiene receta y esencia. La diferencia
  es que se arma por adelantado, y de eso se encarga el producto terminado.
- **No hay que inventar un "insumo frasco armado"**: esa era la salida manual (opción B) y
  deja de hacer falta.
- Al crear la ficha, si todavía no tiene esencia asignada saldría agotada — pero con frascos
  armados en stock se ve disponible, que es justo lo que se quiere.

## Las tres categorías NO se venden igual (decidido con el dueño, 2026-08-14)

Hoy el sistema trata a los 229 perfumes como contratipos: todos `fabricado`, todos disponibles
si alcanza la esencia. El dueño lo corrigió — **cómo se consigue el producto cambia cuándo se
puede vender**:

| Categoría | Cómo se consigue | Disponible cuando… |
|---|---|---|
| **Contratipo** | Se arma cuando lo piden | alcanza la esencia *(regla actual)* |
| **1.1** | Se arma ANTES, con su frasco especial | **hay stock armado > 0** |
| **Original** | No se fabrica: viene hecho | **hay stock de la botella** |

- **El 1.1 no se ofrece por tener el frasco.** Confirmado con el dueño sobre un caso real: tiene
  el *Envase Khamrah 1.1* comprado y sin armar, y ese perfume **no debe verse en la tienda**
  hasta producirlo. Es la diferencia con un contratipo, que sí se arma contra pedido.
- **El original es `tipo_producto = 'comprado'`**, que ya existe: descuenta UNA unidad del insumo
  que ES el producto, sin receta.
  - **Hueco a tapar en el camino**: hoy un `comprado` **nunca** sale agotado automáticamente
    (`esenciaParaUno` solo juzga a los fabricados), así que se podría vender una botella que no
    se tiene. Pasa a mirar el stock de su insumo-producto.

### Cómo lo sabe la ficha

**Con una marca en el PERFUME, no colgada del nombre de la categoría.** Se agrega
`perfumes.solo_armado` (boolean, default false) = *"este producto solo se vende si ya está
armado"*.

- La categoría **sugiere** el valor al crear la ficha (elegir "1.1" lo marca, elegir "Original"
  propone `comprado`), pero la verdad vive en el producto.
- Atar la regla al nombre de una categoría —que es un dato que el dueño edita— significa que el
  día que la renombre, la regla deja de aplicarse **en silencio**. Mismo criterio por el que la
  gama dejó de deducirse del nombre del material.

### El "doble precio" ya existe

El dueño confirmó que se refería a **lista + precio propio**, que es la cascada de `mapPerfume`
tal cual está: la lista da el precio de toda la categoría 1.1 ($120.000) y la ficha puede llevar
el suyo ($150.000 en Bon Bon y Yum Yum). **No hay nada que construir aquí.**

### Tallas de los originales

Vienen en tamaños que hoy no existen en la lista (90 ml, 125 ml…). Se crean desde
Clasificaciones, pero **crear una talla guarda solo el nombre**
(`perfume.repository.ts:674`): `ml` y `formula_volumen_id` quedan en NULL, y una talla sin `ml`
el sistema la trata como "no es un tamaño" y no la costea.

→ Al crear o renombrar una talla, **deducir `ml` del nombre** con el mismo REGEXP que usó la
migración `20260801140000_tallas_en_ml`, y enlazar la fórmula por número si existe. Son tres
líneas y es lo que permite al dueño cargar los originales sin pedir una migración.

## Pruebas que tiene que dejar

Ola de base (`*.bd.test.ts`), escritas desde la regla:

1. Producir 10 → el terminado sube a 10 y los materiales bajan la receta × 10.
2. Vender 4 → el terminado baja a 6 y **los materiales NO se mueven**.
3. Vender 8 teniendo 6 → salen 6 del terminado y **2 se arman con materiales**; el costo de la
   venta es la suma de los dos, no el de 8 recetas.
4. Borrar la venta → todo vuelve exacto, las dos partes.
5. Borrar el lote → devuelve materiales y quita frascos.
6. Un perfume sin esencia pero **con frascos armados NO sale agotado**.
7. Un perfume marcado `solo_armado` **sin stock armado SÍ sale agotado**, aunque tenga esencia
   y su frasco especial en bodega.
8. Un `comprado` sin stock de su botella **sale agotado** (hoy no lo hace).
9. Crear la talla "90 ML" la deja con `ml = 90`, no en NULL.

## Qué es un 1.1, resuelto con el dueño y comprobado en los datos

**La receta es IDÉNTICA. Lo único que cambia es el frasco** (que trae envase y caja de esa
fragancia) y cuesta muchísimo más. Confirmado midiendo los 5 lotes reales: todos gastan por
unidad 50 ml de esencia, 48,9 de diluyente, 0,8 de sellador y 0,3 de feromonas. La diferencia
es el envase: **$5.000 el normal contra $33.535–$81.133 el del 1.1** — entre el 60% y el 79%
del costo del frasco.

Consecuencias para el modelo, y **todas se resuelven con piezas que YA existen**:

- **No necesita fórmula propia.** Reutiliza la de 100 ml.
- **El envase se asigna en `perfume_presentacion.envase_insumo_id`**, que se construyó
  exactamente para esto (*"un 1.1 de Sauvage no usa el mismo frasco que uno de Bleu"*).
- **Va en la categoría `1.1`**, que ya existía en la base y estaba **vacía** (igual que
  `Original`). Como la lista de precios es categoría × talla, eso le da precio propio a todos
  los 1.1 de una vez. **Si se crearan en `Contratipo` heredarían los $70.000 y dos de ellos se
  venderían a pérdida.**
- **Es un perfume aparte** (decisión del dueño: se vende aparte, con su foto real).

### Precios acordados con el dueño

| 1.1 | Costo real | Precio | Margen |
|---|---|---|---|
| Asad | $54.436 | $120.000 | 55% |
| Mandarin Sky | $66.344 | $120.000 | 45% |
| Khamrah (sin producir aún) | ~$70.929 | $120.000 | 41% |
| Bon Bon | $81.829 | $150.000 | 45% |
| Yum Yum | $103.135 | $150.000 | 31% |

Configuración: **lista de precios `1.1 × 100ML = $120.000`** y **precio propio de $150.000**
en las fichas de Bon Bon y Yum Yum. Yum Yum queda en 31%, por debajo del 35% con el que el
sistema avisa: es el que menos aguanta una subida de ese frasco.

## Los 5 lotes que ya están registrados en producción

Ojo, **solo 4 son 1.1**:

| Lote | Perfume | Envase usado | Uds | Costo/u |
|---|---|---|---|---|
| 1 | 212 VIP Black | normal ($5.000) | 5 | $24.188 |
| 2 | Mandarin Sky | 1.1 ($38.944) | 1 | $66.344 |
| 3 | Bon Bon | 1.1 ($59.498) | 1 | $81.829 |
| 4 | Yum Yum | 1.1 ($81.133) | 1 | $103.135 |
| 5 | Asad | 1.1 ($33.535) | 1 | $54.436 |

Los cuatro de 1.1 apuntan hoy al perfume ORIGINAL. Al crear las fichas 1.1 hay que
**re-apuntarlos**, o el stock armado caería en el producto equivocado. El lote 1 (212 VIP
Black normal) se queda donde está y también entra al terminado: 5 frascos armados.
