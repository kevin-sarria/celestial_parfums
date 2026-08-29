# Alertas de inventario y materiales "en prueba" (2026-08-29)

## De dónde sale

Dos quejas del dueño el mismo día, que resultaron ser la misma pieza:

1. **El pedido sugerido le pide reponer lo que está probando.** Textual: *"al momento de poner que
   tengo solo 25 ml de esa esencia nueva que traje (traje 30 ml, 5 ml lo usé para la muestra) y
   como puse los topes mínimos en 30 ml para que me avise, entonces me marca varios que no se han
   vendido ni 1 sola vez como que se deben traer, y para mí eso no es prioritario porque está en
   una fase de prueba para ver si sale la esencia o no."*
2. **Quiere que el sistema le grite cuando algo se acaba**, configurable por familia de material,
   *"así como la parte que tengo de anuncios para los clientes"* pero solo para el dashboard.

## La decisión que las une

> **El mínimo de la familia y el umbral del aviso son EL MISMO número.**

En su cabeza lo son ("avísame cuando queden menos de 30"). Guardarlo dos veces —un campo para
pedir, otro para avisar— garantiza que un día digan cosas distintas y que ninguna de las dos
pantallas sea de fiar. Por eso `alertas_inventario.minimo` alimenta a la vez la alerta y el tercer
escalón de la cascada del pedido sugerido.

## Las tres piezas

### 1. `insumos_costo.en_prueba`

Interruptor por material. Mientras está marcado, **no sale en el pedido sugerido y no dispara
ninguna alerta**. Sigue siendo inventario normal: se vende, se produce y suma al valor.

- **No se esconde en silencio**: el pedido sugerido devuelve la LISTA de lo marcado (no un
  conteo), y la pantalla la enseña con un clic para desmarcar. Una decisión temporal que cuesta
  deshacer se vuelve permanente sola.
- **No se "gradúa" solo con la primera venta.** Se evaluó y se descartó: el sistema decidiendo por
  él escondería el cambio justo cuando importa, y él ya dijo que quiere decidirlo.
- **Es distinto de "sacar del pedido"**, que ya existía: sacar es *"hoy no"* y vive en el navegador
  (`useAjustesPedido`); en prueba es *"todavía no me interesa reponerlo"* y vive en la base — que
  es exactamente lo que pidió (*"si quiero que el pedido sugerido tenga parte en la base de
  datos"*).

### 2. La cascada de mínimos: material → gama → familia

`minimoDe()` en `alertas.repository.ts`, en un solo sitio porque el número lo miran dos pantallas
y tienen que decir lo mismo. Lo ya configurado por gama **no se toca**: la familia es la red de
seguridad para todo lo que hoy no tiene mínimo (se midió en su día: **1 de 226** materiales tenía
uno propio).

**"Esencias" NO es "materia prima"**: significa materia prima **con gama**. El diluyente, el
sellador y las feromonas quedan fuera — se compran por litros y medirlos con la vara de una esencia
llenaría la alerta de ruido el primer día (decisión suya). Siguen pudiendo llevar su mínimo propio.

### 3. La pantalla de Alertas y el aviso

Pantalla propia en *Producción e inventario → Alertas de inventario*, con una tarjeta por familia:
mínimo, forma del aviso (franja o ventana), encendida/apagada y un texto propio opcional. Cada
tarjeta enseña **lo que esa regla marca AHORA**, traído del servidor: poner un número sin ver a
cuántos materiales alcanza es adivinar.

El aviso (`AvisoAlertas`) va **arriba de todo y en cualquier pestaña** del dashboard. Si solo
saliera en Inventario, avisaría justo a quien ya está mirando el inventario.

- **Una regla por familia** (`@@unique([ambito])`): dos reglas para "envases" con números distintos
  no tienen respuesta correcta.
- **Solo UNA ventana a la vez**, aunque dos familias pidan ventana: dos modales encadenados al
  entrar convierten el aviso en un trámite que se cierra sin leer.
- **Se cierra por el día**, y **vuelve antes si cambia la lista de materiales que lo dispararon**.
  Se guarda una firma con esos ids: si cambian, es otra alerta. Una que se calla mientras se acaban
  tres cosas más es igual a no tener alerta.
- Se vuelve a consultar al cambiar de pestaña, o seguiría nombrando algo que se acaba de marcar en
  prueba.

### Corrección del mismo día: es un formulario, no autoguardado

La primera versión guardaba al salir de cada campo y recargaba la pantalla entera. El dueño la usó y
la cortó en la misma tarde: configurar es tantear —subir un número, ver a cuántos materiales
alcanza, cambiar otro y recién ahí aceptar—, y con autoguardado no hay nada que aceptar.

Ahora hay **borrador + guardado**, un botón `Guardar cambios`, un `Deshacer`, y al guardar el estado
se rehace con lo que responde el servidor en vez de volver a pedirlo todo (era el `setCargando(true)`
el que desmontaba el formulario y lo hacía parpadear). De paso, las tres tarjetas pasaron a una tabla
de tres renglones: **913 px → 390 px**. El porqué completo, en
[`diseno-ux.md`](../../diseno-ux.md).

## Qué se verifica

Pruebas de base (`alertas.bd.test.ts`, 9): que un material en prueba no se sugiere ni dispara; que
al desmarcarlo vuelve; que la familia cubre lo que no tiene mínimo propio ni de gama; que el propio
manda sobre el de la gama y el de la gama sobre el de la familia; que el diluyente **no** entra en
"esencias"; que una alerta apagada no dispara; y que guardar dos veces la misma familia corrige la
regla en vez de duplicarla.

Recorrido en navegador (`alertasInventario.e2e.test.ts`): configurar el mínimo en la pantalla, ver
el aviso salir **en otra pestaña** del dashboard, ver el mismo material aparecer en el pedido
sugerido y sacarlo marcándolo en prueba.

## Lo que NO entra

- **Alertas por material suelto** más allá del `stock_minimo` que ya existe.
- **Avisos por correo o WhatsApp**: esto es una alerta de pantalla. El día que se quiera avisar
  fuera del dashboard, es otro módulo.
- **Historial de alertas** ("cuándo saltó y quién la cerró"). Se recalcula en cada consulta y no se
  guarda, como el resto del sistema.
