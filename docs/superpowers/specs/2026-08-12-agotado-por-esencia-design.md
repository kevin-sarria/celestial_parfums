# Agotado automático cuando no alcanza la esencia

Fecha: 2026-08-12. Decidido con el dueño.

## El problema

Un perfume fabricado se arma con la esencia de SU fragancia. Si esa esencia se acabó, el
perfume sigue apareciendo disponible en la tienda y el cliente lo puede pedir. Se le está
prometiendo algo que no se puede armar.

El dueño lo planteó así: *"cuando se acabe la esencia o llegue a menos de lo que debería,
entonces no me debería mostrar esos perfumes como disponibles sino como agotados por el
momento"*.

## Lo que YA existe y no hay que construir

- **El estado `agotado` y todo su comportamiento visible.** La tarjeta se pinta en gris con
  el sello "Agotado", desaparece el botón de agregar al carrito (`PerfumeCard.tsx:184`), y
  la ficha muestra "Agotado por ahora" con el *avísame cuando vuelva*
  (`PerfumeDetailPage.tsx:228`). No se toca nada de eso.
- **La regla de "¿alcanza para armar uno?"** — `puedeArmarHoy` en
  `frontend/src/utils/catalogoFiltros.ts`, ya probada, usada hoy solo por el catálogo PDF.
- **El enlace talla → receta**: `presentaciones.formula_volumen_id`. Verificado en la base:
  las 5 tallas reales están enlazadas; "Combo Personalizado" y "200/250ML" están en NULL a
  propósito porque no son tallas.
- **El stock de la esencia de cada perfume**: `mapPerfume` ya expone `insumo_esencia_stock`.

## Decisiones del dueño

1. **El corte es "no alcanza ni para armar UNO"** de la talla más pequeña de ese perfume.
   Medido contra los datos reales: hoy serían **14 de 220** perfumes fabricados publicados.
   Se descartaron las otras dos opciones: un colchón de 3 unidades escondería 86 perfumes,
   y cortar solo en cero dejaría vender un 30 ml teniendo 3 ml de esencia.
2. **No hay interruptor para forzar "disponible".** Si el sistema se equivoca es porque el
   stock está mal, y ese mismo número manda en los costos, el pedido sugerido y la campana.
   Se corrige el inventario, que arregla los cuatro sitios a la vez.

## Diseño

### No se guarda, se calcula

La columna `perfumes.agotado` **no la toca nunca el sistema**: sigue siendo la marca manual
del dueño. Lo que cambia es lo que `mapPerfume` publica:

```
agotado (lo que ve la tienda) = agotado_manual  OR  sin_esencia
```

Mismo criterio que los sellos de la tarjeta, el cupo de crédito y la gama del perfume: un
valor guardado se desincroniza el primer día que alguien registre una compra.

### La receta viaja con el perfume

`perfumeInclude` se extiende para que cada talla traiga su receta:

```ts
presentaciones: { include: { presentacion: { include: { formula: true } } } }
```

Así `mapPerfume` sigue siendo **puro y síncrono** y no hay que tocar sus ~10 sitios de uso.
La alternativa —cargar las recetas aparte, al estilo de `conRatings`— obligaba a acordarse
de aplicarlas en cada consulta, y olvidar una daría un catálogo que miente en esa pantalla.

### Campos nuevos que expone `mapPerfume`

| Campo | Para qué |
|---|---|
| `agotado` | Lo que consume la tienda: manual **o** sin esencia. Ya existía; cambia cómo se calcula. |
| `agotado_manual` | La columna cruda. El dashboard la necesita para saber qué puede desmarcar. |
| `sin_esencia` | El motivo calculado. |
| `esencia_necesaria` | Cuánta esencia pide una unidad de la talla más pequeña, para poder explicar el motivo. |

### La regla, exacta

- Solo aplica a `tipo_producto = 'fabricado'`. Una gorra o un splash comprado no dependen de
  ninguna esencia.
- Se mide contra la talla **más pequeña** que ofrece ese perfume: uno que solo se vende en
  100 ml necesita 50 ml de esencia, no los 15 del 30 ml.
- Sin esencia asignada → cuenta como sin esencia. (Hoy no hay ninguno, pero un perfume nuevo
  nace así y no debe salir a la venta prometiendo lo que no se puede armar.)
- Si la talla no tiene receta enlazada, el corte cae a `stock > 0`: es lo único que se puede
  afirmar sin inventar un número.

### Los dos sitios que filtran por la columna

- `seo.service.ts:130` (disponibilidad de schema.org) recibe un perfume ya mapeado, así que
  hereda el cálculo solo.
- `recomendacion.service.ts:151` filtra `agotado: false` **en la consulta SQL**, y eso no ve
  el cálculo. Hay que descartar además los que se quedaron sin esencia después de mapear, o
  el quiz recomendaría justo lo que no se puede armar.

### La trampa: el caché

El catálogo se sirve de un caché de minutos. Sin invalidarlo al mover el inventario, el
dueño registra la llegada de una esencia y el perfume sigue diciendo "agotado" un buen rato
— y va a concluir que no funciona. **Registrar un movimiento de inventario debe llamar a
`bustCatalogoCache()`.**

### En el dashboard hay que distinguirlos

En la pestaña Perfumes, un agotado manual y uno por falta de esencia se ven distinto, y el
segundo dice el motivo ("sin esencia: tienes 4 ml y necesitas 15"). Sin eso el dueño
encontraría perfumes agotados que no puede desmarcar y parecería roto — es exactamente la
confusión que ya tuvo con el interruptor de publicar.

### Se borra la copia del navegador

`puedeArmarHoy` deja de vivir en `catalogoFiltros.ts` y el filtro del catálogo PDF pasa a
usar el campo que ya viene calculado del servidor. Dos copias de la misma regla se separan
el día que alguien toque una.

## Arreglos que van en el mismo cambio

Los destapó esta conversación y son de la misma pantalla:

1. **El control de "En stock / Agotado" no parece tocable** (`PerfumesTab.tsx:237`): es una
   etiqueta con `cursor-pointer`, y al lado quedó el interruptor de publicar, que sí se ve
   como un control. El dueño creyó que la función se había eliminado.
2. **`handleToggleAgotado` ignora la respuesta** (`PerfumesTab.tsx:206`): si el servidor
   rechaza, no pasa nada y nadie se entera. Rompe la regla del proyecto de que ninguna
   acción que falla puede quedarse muda.

## Qué se verifica antes de darlo por hecho

- Los 14 perfumes sin esencia suficiente salen agotados en la tienda y **sin botón de
  agregar al carrito**; los otros 206 siguen igual.
- Un perfume con esencia de sobra NO se marca.
- Una gorra (`comprado`) nunca se marca, tenga el stock que tenga.
- Registrar la llegada de esencia devuelve el perfume a la venta **sin esperar el caché**.
- El dashboard muestra el motivo y deja claro cuál es manual y cuál calculado.
- Números antes y después del cambio, medidos contra la base real.
