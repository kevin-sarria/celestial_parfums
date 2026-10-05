# Maestro de mensajes — diseño

**Fecha:** 2026-10-04 · **Pedido del dueño:** *"hagamos algo así como un maestro de mensajes en el
que tengamos mensajes configurables para cada cosa, algo así como plantillas, en dado caso de no
tener nada configurado que el botón salga deshabilitado y con un popup que nos diga que para ello
debemos configurarlo"*.

## El problema

Los mensajes de WhatsApp que el panel manda **viven dentro del código** y no se pueden cambiar sin
un despliegue:

| Dónde | Qué manda hoy |
|---|---|
| `recompra/TarjetaCliente.tsx` (`mensajeDe`) | *"¡Hola Laura! Te escribo de Celestial Parfums 😊 ¿Cómo te ha ido con tu Khamrah 30ml?"* |
| `components/CartDrawer.tsx` | El pedido armado con sus líneas y el total |
| `pages/dashboard/cotizacion/CotizacionForm.tsx` | La cotización al mayorista |
| `tabs/AvisosTab.tsx` | El aviso de reposición, al que espera un perfume |

Y el dueño escribe **distinto según el cliente**: *"ey bro, como vamos?"* con los jóvenes, algo
formal con los mayores. Un texto fijo nunca le sirve, y hoy no tiene dónde ponerlo.

## La decisión del dueño

Un **maestro de mensajes**: plantillas configurables por caso, con **varias variantes por caso** (su
tono relajado y su tono formal). Si un caso no tiene ninguna plantilla, el botón que la usaría sale
**deshabilitado** y al tocarlo un aviso explica que hay que configurarla.

**Nace vacío a propósito.** El texto lo escribe él: es su voz, y el sistema no la inventa.

## Diseño

### Dónde vive

**Ajustes → Mensajes.** Una sección por caso y, dentro, sus variantes. El patrón es el de
*Clasificaciones*: una entrada en el menú, y arriba un selector para pasar de un caso a otro.

### La tabla (`plantillas_mensaje`, **lleva migración**)

| Campo | Para qué |
|---|---|
| `caso` | Para qué sirve: hoy solo `credito`. Los demás entran después |
| `nombre` | Cómo la llama él: "Relajado", "Formal", "Al mayorista" |
| `texto` | El mensaje, con marcadores |
| `orden` | El orden en que salen en el menú |

### Los marcadores (lo que la app rellena)

Se escriben entre llaves y la app los cambia por el dato real:

| Marcador | Qué pone | Ejemplo con sus números |
|---|---|---|
| `{nombre}` | El primer nombre del cliente | Laura |
| `{saldo}` | Lo que todavía debe | $ 137.000 |
| `{vence}` | Cuánto falta, o cuánto pasó | *vence en 5 días* · *venció hace 3 días* |
| `{fecha}` | La fecha pactada | 15/10/2026 |

`{vence}` está pensado para que **una sola plantilla sirva para los dos casos** (por vencer y
vencido): *"te recuerdo que tu crédito {vence}"* sirve para los dos.

**En el editor no hay que memorizarlos**: son botones que los insertan donde esté el cursor, y al
lado una **vista previa** con un cliente de ejemplo.

### El botón que los usa

En **Créditos**, cada crédito con saldo lleva un botón *Recordar el pago*:

- **Con plantillas** → abre un menú con las variantes ("Relajado", "Formal"). Al elegir una, abre
  WhatsApp con el texto ya lleno —y el chat del cliente directo si su ficha tiene teléfono—.
- **Sin plantillas** → el botón sale **deshabilitado**, y al tocarlo un aviso: *"Todavía no has
  escrito ningún mensaje para cobrar. Escríbelo y este botón se enciende."*, con un botón que lleva
  al maestro.

### Lo que NO entra (a propósito)

- **Nada de enviar solo.** Sigue abriendo WhatsApp para que él lea y cambie antes de mandar. Un
  mensaje automático a un cliente que debe plata es un riesgo que no se toma sin su permiso.
- **Los otros casos** (recompra, reposición, cotización, pedido): la estructura queda lista para
  meterlos, pero no se tocan pantallas que hoy funcionan en la primera entrega.

## Lo que hay que decidir

| # | Pregunta | Opción A (recomiendo) | Opción B |
|---|---|---|---|
| 1 | ¿Qué casos entran **ahora**? | **Solo el cobro** (el que necesitas hoy, $1.059.500), con la estructura lista para los demás | Los cuatro de una (cobro, recompra, reposición, cotización): más grande y toca pantallas que ya funcionan |
| 2 | ¿Los marcadores te sirven así? | **Sí**, con botones para insertarlos y vista previa (nunca los tecleas) | Un texto sin marcadores, y el nombre/saldo se pegan a mano al abrir WhatsApp |
