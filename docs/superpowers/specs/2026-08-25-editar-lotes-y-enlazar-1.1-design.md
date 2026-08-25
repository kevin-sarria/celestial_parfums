# Editar un lote, enlazar los 1.1 que quedaron internos, y publicarlos rápido

**Fecha:** 2026-08-25
**Nace de** tres pedidos del dueño en la misma frase: *"quiero poder editar las producciones para
ajustar valores"*, *"nos faltó el enlazador de perfumes 1.1 … esos se quedan solo internamente"* y
*"necesito poder generar esos registros de manera rápida para el catálogo público con información
básica y luego ajustarla"*.
**Se apoya en** [`2026-08-25-alta-de-productos-por-tipo-design.md`](2026-08-25-alta-de-productos-por-tipo-design.md)
(la carga inicial y el alta rápida desde el lote, ya construidas) y en
[`2026-08-14-producto-terminado-design.md`](2026-08-14-producto-terminado-design.md) (el libro de
frascos armados).

## El problema, medido en el código y en los datos

Un lote hace **tres cosas** al registrarse (`registrarProduccion`, `inventario.repository.ts`):
descuenta el material, congela un costo y suma los frascos a una ficha×talla. Hoy esas tres solo
se pueden deshacer **borrando el lote entero** (`eliminarProduccion`) y volviéndolo a escribir a
mano. No hay editar, y fue a propósito: mover frascos entre fichas es justo donde se descuadran
los costos.

Lo que cambió es que ese "a propósito" ya está costando plata real, medido contra el respaldo de
producción del 2026-08-24:

| Caso | Cuántos | Qué le pasa hoy |
|---|---|---|
| Lote 6, Khamrah del 21 de agosto | 1 frasco | Gastó el *Envase Khamrah 1.1* ($48.680) pero sus frascos quedaron en la ficha del **Khamrah corriente**: si alguien compra el corriente, se le entrega un frasco de $74.580 de costo al precio del normal |
| Lotes del 11 al 14 de agosto | 5 lotes | Se registraron ANTES de que existiera el libro del terminado: descontaron material y **no dejaron ni un frasco** en el sistema |
| Fichas 1.1 en el catálogo | **0 de 229** | Las que nazcan del lote nacen apagadas: quedan solo internas y no se ven en la tienda |

El runbook que había para esto —borrar cada lote y volver a registrarlo— son ~20 minutos de
pantalla, recalcula los costos al promedio de hoy y no deja rastro de que algo se corrigió.

## Lo que decidió el dueño (2026-08-25)

1. **Editar un lote es editarlo todo**: material, cantidad, ficha, envase, fecha y costo. No una
   edición recortada a la ficha.
2. **El costo se recalcula solo y se puede pisar a mano.** Cuando lo pisa, queda marcado como
   puesto a mano: un número que no cuadra con la receta tiene que poder explicarse.
3. **El enlazador resuelve los lotes viejos**, no las fichas apagadas: su trabajo es mandar los
   frascos que quedaron en el sitio equivocado a su ficha 1.1, creándola si no existe.
4. **La ficha 1.1 se copia del perfume corriente.** Es el mismo jugo: solo cambian frasco, precio
   y foto.
5. **Publicar sin foto avisa, no bloquea.**

## Parte 1 — Editar un lote

```
PRODUCCIONES
┌────┬────────────┬──────────────────────┬──────┬───────────┬──────────────┐
│ #  │ Fecha      │ Qué se armó          │ Uds. │ Costo/u   │              │
├────┼────────────┼──────────────────────┼──────┼───────────┼──────────────┤
│ 6  │ 21/08/2026 │ Khamrah · 100 ML     │  1   │ $74.580 ✎ │  [✏️]  [🗑]  │
│    │ ✎ editado el 25/08 · ver cambios                                    │
└────┴────────────┴──────────────────────┴──────┴───────────┴──────────────┘
```

El lápiz abre el **mismo modal de *Armé perfumes*** con todo precargado. Es el mismo formulario a
propósito: dos formularios para lo mismo se desincronizan, y la regla de la casa es que una regla
viva en un solo sitio.

### Qué se puede cambiar

Fecha · fragancia (ficha) · tamaño (receta) · envase · cantidad · los materiales consumidos y sus
cantidades · nota · **costo unitario**.

### Qué pasa al guardar

Una **sola transacción** que hace, en este orden:

1. `revertirMovimientos('produccion', id)` — devuelve el material del lote viejo.
2. `revertirTerminado('produccion', id)` — quita los frascos que ese lote había armado.
3. Vuelve a aplicar todo con los valores nuevos (la misma función que usa el alta).
4. **Recalcula el costo promedio** de las fichas tocadas —la vieja y la nueva— desde el libro.
5. Escribe la línea del historial.

O pasa todo o no pasa nada: a mitad de camino el inventario mentiría.

### El costo: recalculado, pisable, y marcado

El modal muestra el costo que sale de los materiales que quedaron puestos, **calculado en vivo**.
Si el dueño escribe otro, manda el suyo y el lote guarda `costo_manual = true`, que se ve en la
tabla con un ✎ junto al número.

**Por qué se marca**: un costo escrito a mano no cuadra con la receta ni ahora ni nunca. Sin la
marca, dentro de tres meses el sistema parecería estar mal calculando; con ella, dice la verdad —
ese número lo puso una persona.

### El promedio de la ficha se RECONSTRUYE, no se pisa

Hoy `revertirTerminado` resta el stock pero **deja el `costo_promedio` viejo**: es un defecto
latente que nadie había disparado porque borrar un lote era raro. Con la edición pasa a ser
rutina, así que el promedio se recalcula del libro (`movimientos_terminado`), que es la verdad
auditable:

> promedio = (suma de cantidad × costo de las ENTRADAS que quedan vivas) ÷ (suma de sus cantidades)

Nueva función `recalcularPromedioTerminado(tx, perfume_id, presentacion_id)` en
`inventario.terminado.ts`, llamada por la edición **y por el borrado**. Es lo que impide que
corregir un lote deje el costo del frasco mintiendo.

### Los dos avisos que cuestan plata

- **Frascos ya vendidos**: si bajar la cantidad deja el conteo por debajo de lo que ya salió, se
  avisa con el número exacto (*"quedarían −2 frascos armados de Khamrah 100 ML"*) y decide el
  dueño. **Avisa, no bloquea** — es la misma decisión que ya rige el borrado de un lote: el dato
  físico manda sobre el sistema.
- **Material en negativo**: si al rehacer el lote algún material queda bajo cero, se avisa igual.
  Registrar un lote de hace una semana, cuando sí había esencia, es un caso legítimo.

### El historial

Cada edición añade una línea legible, con fecha y en español:

```
25/08/2026 · 3 → 5 unidades · ficha Khamrah By Lattafa → Khamrah 1.1 · costo $74.580 puesto a mano
```

**Se guarda el texto ya redactado, no los ids.** Un historial de ids obliga a reconstruir nombres
que quizá ya no existan (una ficha borrada, un envase renombrado) y acabaría mostrando "perfume
#529 → perfume #612", que no le dice nada a nadie.

### Migración

`producciones` gana dos columnas. Es la única migración de todo el diseño:

| Columna | Tipo | Para qué |
|---|---|---|
| `costo_manual` | `Boolean @default(false)` | El costo lo escribió una persona, no la receta |
| `historial` | `Json?` | Lista de líneas `{ fecha, texto }`, la más nueva primero |

`historial` es JSON y no una tabla aparte porque solo se lee **con su lote**, nunca se cruza ni se
consulta por su cuenta: una tabla obligaría a un join en una pantalla que ya carga bien.

### Endpoint

`PATCH /inventario/producciones/:id` — **PATCH, nunca PUT**: el CORS del proyecto solo permite
`GET/POST/PATCH/DELETE`. Mismo cuerpo que `produccionSchema` más `costo_unitario` opcional.

## Parte 2 — El enlazador

Vive en **Producciones**, como una sección arriba de la tabla, con su contador. Cuando no queda
ninguno, desaparece sola (el patrón de *Frascos ya armados* en Inventario).

```
⚠ 6 lotes por enlazar

  Lote 6 · 21/08 · Khamrah By Lattafa · 100 ML · 1 unidad
  Gastó "Envase Khamrah 1.1 100ml", pero su frasco quedó en la ficha del perfume
  corriente. Si alguien compra el Khamrah normal, se le entrega este frasco.
                                                    [ Enlazar a su ficha 1.1 ]

  Lote 3 · 13/08 · Bon Bon · 100 ML · 1 unidad
  Descontó su material pero no dejó ningún frasco en el sistema (se registró
  antes de que existiera el libro de frascos armados).
                                            [ Sumar el frasco a su ficha 1.1 ]
```

### Las dos reglas, y por qué son estas

Ninguna adivina por el nombre del producto. Las dos son hechos comprobables en la base:

1. **El lote no dejó frascos**: tiene `perfume_id` y su talla existe, pero no hay ni un
   `movimientos_terminado` con `referencia_id = lote`. Son los registrados antes del 14 de agosto.
2. **El envase no es el de la ficha**: `producciones.envase_insumo_id` ≠
   `perfume_presentacion.envase_insumo_id` de la ficha×talla donde quedaron sus frascos. Es el
   caso Khamrah, y es objetivo: el envase que gastó y el que la ficha declara no son el mismo.

**Adivinar por el nombre ("dice 1.1") se descartó**: bastaría un producto llamado "Set 1.1" o un
1.1 sin esas letras para que la lista mintiera, y una lista que miente en dinero se deja de mirar.

### Qué hace cada botón — y qué NO hace

| Caso | Acción | Material |
|---|---|---|
| Regla 1 (sin frascos) | **Carga inicial** ya existente: suma los frascos con su costo | **No se toca**: ya se descontó el 13 de agosto |
| Regla 2 (envase ajeno) | **Editar el lote** cambiando su ficha: los frascos se mudan con su costo | **No se toca**: es el mismo lote, solo cambia a dónde apuntan sus frascos |

El enlazador **no tiene motor propio**: es una lente sobre los datos y dos botones que llaman a lo
que ya existe (la carga inicial y el `PATCH` de la Parte 1). Un tercer camino para mover frascos
sería una tercera versión de la misma regla, y la casa tiene una sola regla por sitio.

Si la ficha 1.1 de destino todavía no existe, el mismo botón la crea con la Parte 3 sin salir de
la pantalla.

### Endpoint

`GET /inventario/producciones/por-enlazar` — devuelve los lotes marcados, con **cuál de las dos
reglas** los marcó, la ficha en la que están y la ficha 1.1 que se propone (la que tenga ese
envase configurado, si existe). Solo lee.

## Parte 3 — La ficha 1.1 nace del perfume corriente

En el alta rápida (desde el lote o desde el enlazador) aparece una línea más:

```
¿Es el 1.1 de un perfume que ya tienes?   [ 🔎 Khamrah By Lattafa ▾ ]
  ✓ Se copiarán su descripción, notas, ocasiones, género, duración y proyección.
    Tú pones la foto, el precio y el envase.
```

Se copian: `descripcion`, notas/tipos de aroma, ocasiones, `genero`, `duracion`, `proyeccion`.
**No** se copian: precio, foto, categoría (queda 1.1), envase, tallas ni el estado publicado.

**Copia, no enlace.** Si mañana el dueño cambia la descripción del corriente, la del 1.1 no se
mueve: son dos productos que se venden distinto y comparten el jugo, no la ficha. Un enlace vivo
obligaría a decidir cuál manda el día que se separen, y esa pregunta no tiene respuesta buena.

**La copia se hace en el servidor** (`perfume.repository.ts`), no en el formulario: así el alta
por Excel y por API heredan el mismo comportamiento. Es la misma razón por la que
`naceComoProducto` vive en el servidor.

### Publicar

La ficha nace apagada, como todo producto desde el 2026-08-24, y la pantalla trae su botón
**Publicar** al lado. Si le falta la foto, avisa —*"en la tienda se verá una tarjeta sin
imagen"*— y publica igual si el dueño confirma. **Avisa, no bloquea**: decisión suya del
2026-08-25, y coherente con el resto del sistema, donde el dato físico y el criterio del dueño
mandan sobre el sistema.

El endpoint de publicar **ya existe** (`patchPublicadoPerfume`); no se toca.

## Qué NO cambia

- El cálculo del costo promedio de los **materiales**, el consumo por venta y el costeo.
- Las reglas de disponibilidad (`motivoAgotado`) y la pestaña a la que cae cada producto.
- La tienda pública: un 1.1 publicado entra por el mismo camino que cualquier perfume.
- Borrar un lote sigue existiendo, igual que hoy (y ahora también recalcula el promedio).

## Pruebas que tiene que dejar

**Con base:**
1. Editar un lote devuelve el material viejo y descuenta el nuevo: la esencia queda **exactamente**
   como si el lote se hubiera registrado bien desde el principio.
2. Editar cambiando la ficha mueve los frascos de una a otra **con su costo congelado**, sin tocar
   ni un ml de esencia ni un envase.
3. El `costo_unitario` escrito a mano manda sobre el calculado y deja `costo_manual = true`.
4. El costo promedio de la ficha se reconstruye del libro: 3 frascos a $70.000 + este lote a
   $74.580 dan el ponderado, no $74.580 a secas.
5. Bajar la cantidad por debajo de lo ya vendido **deja el conteo negativo y no revienta** (avisa
   la pantalla, no el servidor).
6. El historial guarda una línea por edición, la más nueva primero.
7. `por-enlazar` marca el lote sin frascos y el del envase ajeno, y **no** marca un lote sano.
8. Crear un 1.1 con `copiar_de_perfume_id` hereda los seis campos y **no** hereda precio, foto ni
   publicado.

**En el navegador:**
9. Editar el lote 6 desde Producciones: cambiar cantidad y ficha, ver el costo recalculado y el
   historial nuevo en la fila.
10. Enlazar desde el aviso: el contador baja y el lote desaparece de la lista.
11. Crear el 1.1 heredado desde el enlazador y publicarlo con el aviso de la foto.

## Archivos que toca

**Backend**
- `prisma/schema.prisma` + migración `..._editar_producciones` (dos columnas).
- `repositories/inventario.repository.ts` (452 líneas): se **extrae `aplicarLote(tx, datos)`** con
  el cuerpo que hoy vive dentro de `registrarProduccion`; crear y editar lo comparten. Si el
  archivo se acerca a las 500, las producciones salen a `inventario.producciones.ts`.
- `repositories/inventario.terminado.ts`: `recalcularPromedioTerminado`, y `revertirTerminado`
  pasa a llamarla.
- `repositories/producciones.enlazar.ts` **(nuevo)**: la consulta de las dos reglas. Solo lee.
- `repositories/perfume.repository.ts`: la herencia del perfume corriente al crear.
- `routes/inventario.router.ts` + `schemas/inventario.schema.ts`: el `PATCH` y el `GET`.

**Frontend**
- `tabs/ProduccionesTab.tsx` (130): la sección del enlazador y el botón de editar.
- `tabs/inventario/ProduccionModal.tsx` (255): acepta un lote existente y guarda con `PATCH`.
  Si pasa de ~300, el cuerpo del formulario sale a su propio archivo.
- `tabs/producciones/LotesPorEnlazar.tsx` **(nuevo)**.
- `tabs/inventario/AltaProductoArmado.tsx` (160): la línea de "¿es el 1.1 de…?" y el aviso al
  publicar.
- `pages/dashboard/columns.tsx`: la marca ✎ del costo a mano y el "editado el…".

## Orden sugerido

1. **Editar un lote** (Parte 1). Es el motor: sin él, el enlazador no tiene con qué mover nada.
   Ya por sí solo permite arreglar el Khamrah a mano.
2. **La ficha 1.1 heredada y su publicar** (Parte 3). Pequeña, y hace falta antes del enlazador
   para que el botón "crear la ficha aquí mismo" tenga a dónde llamar.
3. **El enlazador** (Parte 2). Es la lente que junta las dos anteriores y las pone a un clic.
