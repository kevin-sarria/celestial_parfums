# Fusionar dos registros del mismo material (2026-08-29)

## El problema, con nombre propio

El dueño tiene **dos fichas para el mismo perfumero físico**, y las dos tienen historia:

| id | Nombre | Tipo | Estado | Stock | Costo | Movimientos |
|---|---|---|---|---|---|---|
| 9 | Perfumero Recargable | accesorio | apagado | −25 | $0 | 21 (15 ventas + 6 producciones, desde 2025-12-21) |
| 11 | Perfumero recargable 6 ml | envase | activo | 54 | $2.100 | 1 (la carga inicial del 2026-08-09) |

*(Medido contra `perfumes_db` local el 2026-08-29; la copia va con retraso, en producción los
números serán otros — él dice tener ~30 unidades hoy.)*

No puede borrar ninguno de los dos: `eliminarInsumo` los retiene porque ambos dejaron rastro, y
hace bien — borrar el 9 se llevaría por delante sus 21 movimientos (`onDelete: Cascade`). Apagar
el viejo, que es lo que hizo, esconde el problema pero parte el historial en dos para siempre: el
pedido sugerido nunca vuelve a contar bien los perfumeros, y el costo del accesorio se calcula
sobre media vida.

**Textual suyo:** *"desearía una manera de poder modificar el registro o registros en específico
para cambiarlos al registro del perfumero exacto, pero al cambiarlo que no me descuente lo que
esté antes de esa modificación"*.

## Lo que desbloquea el diseño: el stock NO es una suma

El miedo del dueño era terminar en −370: si 400 ventas viejas se re-apuntan al registro bueno,
¿no le van a descontar 400 unidades?

**No, y por cómo ya está construido el inventario.** `insumos_costo.stock` es una **columna
guardada** que `aplicarMovimiento` actualiza en el instante de cada movimiento; no se recalcula
sumando el libro en ninguna consulta (a diferencia del producto terminado, que sí tiene
`recalcularPromedioTerminado`). Mover la columna `insumo_id` de un movimiento viejo **re-etiqueta
la historia; no la vuelve a ejecutar**.

De ahí sale la regla central de esta función:

> **Fusionar mueve el pasado y no toca el presente.** El registro que sobrevive conserva
> exactamente el stock y el costo promedio que tenía.

Y de paso, un hallazgo que conviene no perder: **esas ~400 ventas no existen como movimientos.**
El libro solo tiene 15 salidas por venta, porque el consumo por venta no es retroactivo (decisión
vieja, ver `inventario-costeo.md`). La fusión no puede inventar un historial que nunca se escribió.

## La forma: la fusión es el borrado, pero mudando

`eliminarInsumo` ya enumera **de dónde cuelga un insumo** para decirle al dueño qué lo retiene. Esa
misma lista es la lista de mudanzas. Se extrae a `contarUsos(id)` y la usan las dos: el borrado
para bloquear, la fusión para mover. Una regla, un sitio — si mañana aparece una tabla nueva que
apunte a un insumo, las dos se enteran a la vez.

Son **ocho** sitios. Los siete que ya se cuentan:

1. `movimientos_inventario.insumo_id`
2. `compra_items.insumo_id`
3. `formulas_volumen.envase_insumo_id`
4. `formulas_volumen.esencia_insumo_id`
5. `formula_accesorios.insumo_id`
6. `perfumes.insumo_esencia_id` / `perfumes.insumo_producto_id`
7. `perfume_presentacion.envase_insumo_id`

Y un **octavo que el borrado no mira y la fusión sí tiene que mirar**, encontrado al revisar el
código para este diseño:

8. `perfume_presentacion.accesorios` — una lista de ids **dentro de una columna JSON**, que
   `inventario.consumoVenta.ts` lee **viva** en cada venta para saber qué accesorios descontar. Una
   fusión que no la reescriba deja ahí un id que ya no existe, y la siguiente venta de esa talla
   revienta con "El insumo no existe". Hoy ninguna fila la usa (comprobado: 0 filas), pero el
   camino está en el código y el día que la use, falla en la caja.

   *No se toca, en cambio, el JSON congelado de `venta_lineas.accesorios`/regalos: ahí el nombre y
   el precio van copiados a propósito, para que una venta vieja siga diciendo lo que se entregó
   aunque el material cambie o desaparezca.*

Después de mudar los ocho, y **dentro de la misma transacción**, se vuelve a contar: si algo
quedara apuntando al duplicado, la fusión entera se cancela en vez de borrarlo. No es paranoia
barata — `movimientos_inventario` se borra en cascada con su insumo, así que un borrado con algo
todavía colgando se llevaría por delante la historia que esta función existe para salvar.

Todo dentro de **una transacción**: ocho mudanzas y un borrado cuadran completos o no pasa ninguna.

## Decisiones del dueño (2026-08-29)

- **Las unidades del que desaparece se descartan.** El −25 del registro viejo es basura contable de
  una ficha que nunca tuvo una compra; sumárselo al bueno le bajaría sus ~30 reales a ~5. El stock
  que vale es el que él contó a mano en el registro bueno.
- **Los costos viejos no se reescriben.** Cada movimiento lleva congelado lo que costó ese día
  ($1.050 y $1.400 el perfumero); son su contabilidad pasada. El costo bueno ($2.100) manda de aquí
  en adelante. Consecuencia aceptada: el costo histórico de esas 15 ventas sigue siendo el que se
  registró entonces.
- **Manda el registro que sobrevive.** Tipo, unidad, costo, stock, gama y estado son los suyos. En
  este caso concreto uno es `accesorio` y el otro `envase`, y no importa: gana el bueno.

## Casos raros, decididos de antemano

- **Los dos en la misma receta** (`formula_accesorios` tiene clave compuesta
  `(formula_volumen_id, insumo_id)`): mudar a ciegas reventaría con clave duplicada. Cuando el
  destino ya está en esa receta, la fila del duplicado **se borra** en vez de moverse — el
  resultado es el mismo: esa receta incluye un perfumero.
- **Fusionar un registro consigo mismo**: se rechaza con mensaje, no se hace nada.
- **Cualquiera de los dos no existe**: se rechaza. Se comprueban los dos contra la base al
  aplicar, no se confía en lo que llega: entre que se pintó la pantalla y se pulsó el botón, otra
  pestaña pudo borrar uno.
- **Rastro**: la fusión escribe en el destino un movimiento `ajuste` de **cantidad 0** con la nota
  *"Fusionado desde «X» (21 movimientos, 2 recetas)"*. Cantidad cero a propósito: aparece en el
  historial del material —que es donde el dueño lo va a buscar— sin mover ni el stock ni el costo
  promedio.
- **No se puede deshacer.** Por eso la pantalla enseña la cuenta exacta antes de aplicar, y por eso
  el runbook de producción pide el respaldo antes.
- **Solo ADMIN**, como el resto de inventario.

## La pantalla

En **Inventario**, junto a los iconos que ya tiene cada fila (Ajustar, Editar, Apagar, Eliminar),
uno nuevo: **Fusionar**. Abre un modal que:

1. Pide con un `BuscadorSelect` **cuál es el registro bueno** (el que sobrevive). Nunca un
   `<select>` de HTML, y con buscador porque la lista de materiales crece.
2. Enseña **la cuenta medida de lo que va a mover**, traída del servidor, no prometida:
   *"21 movimientos · 2 recetas · 0 compras · 1 perfume · 0 tallas"*.
3. Avisa en ámbar lo que más le importa: *"«X» se borra. El stock de «Y» sigue en 30: la fusión no
   descuenta nada."*
4. Aplica y muestra en el toast qué se movió.

El modal vive en su propio archivo (`inventario/FusionarMaterialModal.tsx`) porque
`InventarioTab.tsx` ya está en 500 líneas justas. De paso, los dos bloques de acciones de fila
(escritorio y móvil) salen a `inventario/AccionesMaterial.tsx`: es lo que deja sitio para el botón
nuevo sin romper la regla de las 500.

## Cómo se verifica

Pruebas de base (`fusionarInsumos.bd.test.ts`), porque lo que hay que demostrar son movimientos
reales, no aritmética:

1. **El stock del destino no se mueve ni un gramo** tras fusionar un origen con 21 movimientos.
2. **No se pierde ningún movimiento**: los 21 quedan con el `insumo_id` del destino (hoy borrar el
   insumo se los llevaría por cascada; la fusión los muda primero).
3. **La receta que incluía a los dos queda con una sola línea**, no con dos ni con un error.
4. **El id del duplicado desaparece de las 8 tablas**, comprobado tabla por tabla.
5. **Fusionar consigo mismo se rechaza.**
6. **El rastro queda**: el destino tiene un `ajuste` de cantidad 0 con la nota.

Más la pantalla abierta en el navegador, con captura.

## Lo que NO entra

- **Detectar duplicados solos** (nombres parecidos). El dueño dice no tener más hoy; el día que
  haga falta se agrega, y esa lista se apoya en `palabras()`, que ya existe.
- **Deshacer una fusión.** El costo de construirlo no se justifica contra una vista previa clara y
  un respaldo.
- **Reescribir el costo histórico** (decisión de arriba).
