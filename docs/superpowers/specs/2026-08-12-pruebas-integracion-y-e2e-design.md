# Segunda ola de pruebas: los motores que tocan base, y los recorridos completos

Fecha: 2026-08-12. Decidido con el dueño.

Continúa `2026-08-12-pruebas-motores-precios-design.md` (primera ola, 91 pruebas sobre
funciones puras). Aquella dejó fuera, explícitamente, "nada de base de datos, nada de
pantallas". Esto es eso.

## Por qué esta ola y no otra

La primera ola cubrió la aritmética: dado un precio y un descuento, cuánto se cobra. Lo que
queda sin red es **lo que escribe**: el costo promedio que se arrastra compra tras compra, la
esencia que se descuenta al vender, y el cupón que no puede canjearse dos veces. Un error ahí
no se ve en pantalla — se ve meses después, en un margen que no cuadra.

## Decisiones

### Una base aparte, vacía, armada desde las migraciones

`perfumes_test` en el mismo XAMPP. **No es una copia de `perfumes_db`**: se crea vacía y se le
aplican las migraciones en orden.

Dos razones, y la segunda no es obvia:

1. Los datos reales del dueño no se abren ni se tocan. Una prueba que trunca tablas junto a
   261 ventas de verdad es un accidente esperando.
2. **Armarla desde las migraciones las prueba a ellas.** Hoy nadie verifica que el juego
   completo de migraciones levante el sistema desde cero; se descubriría el día que haya que
   reconstruir el servidor, que es el peor día para descubrirlo. Este proyecto arrastra
   histórico de `db push` y ya tuvo una migración que reventaba por nombres de columna
   duplicados — un fallo que `db push` **nunca** habría mostrado porque no ejecuta los `.sql`.

Se descartó **SQLite en memoria**: es otro motor. Aquí se prueba dinero en `DECIMAL(12,4)`,
enums y llaves foráneas; una prueba verde sobre SQLite no diría nada sobre MySQL. Se descartó
también **usar `perfumes_db` con transacciones que se deshacen**: varias de las funciones bajo
prueba abren su propia transacción, así que no se pueden anidar de forma fiable, y el precio
de equivocarse es escribir en los datos del negocio.

El cliente de Prisma lee la conexión del entorno (`src/config/prisma.ts` es un `new
PrismaClient()` pelado), así que apuntarlo a la base de pruebas **no exige tocar código de
producción**.

### Cada archivo siembra lo suyo

Nada de un juego de datos grande compartido. Cada archivo limpia las tablas que usa y crea los
tres o cuatro registros que necesita. Cuando una prueba falla, el motivo tiene que estar en la
misma pantalla — no en lo que dejó otra prueba en otro archivo.

### Los recorridos, con el Edge que ya está instalado

`playwright-core` sobre `channel: 'msedge'`, que es exactamente lo que ya hace
`revisar-pantalla.mjs`. **Cero navegadores descargados.** Corren bajo Vitest, así que el
proyecto sigue con UNA herramienta de pruebas y no dos.

Van en un comando aparte (`npm run test:e2e`) porque necesitan los servidores levantados. Si
compartieran comando con la aritmética, un backend caído taparía el resultado de todo lo demás
y el conjunto dejaría de ser creíble.

**Un solo login reutilizado** en los cuatro recorridos: el `authLimiter` corta a los 10
intentos cada 15 minutos y ya bloqueó pruebas antes. El captcha se apaga al empezar y **se
restaura al terminar pase lo que pase**, incluso si un recorrido revienta a la mitad.

## Qué se prueba

### Sin base (aritmética pura, milisegundos)

| Motor | Reglas |
|---|---|
| `desglosarIva` | Los tres modos. `incluido` saca la base dividiendo, no restando; `agregado` suma; `sin_iva` no toca nada. Tasa en cero se comporta como sin IVA. |
| `costosConFlete` | El flete se prorratea **sobre el valor con impuesto**. El IVA es costo solo si NO es descontable. Litros ×1000, ml y gramos 1 a 1. Caso medido: la misma factura de $322.000 deja el insumo en **$383,18/ml** con proveedor `agregado` y en **$322,00/ml** con `incluido`. Sin el 3er parámetro se comporta como antes de que existiera el IVA. |

### Con base

| Motor | Reglas |
|---|---|
| `aplicarMovimiento` / `recalcularPromedio` / `revertirMovimientos` | 200 ml a $380 + 500 ml a $420 = **$408,57**. Una salida se valora al promedio y **no lo mueve**. Con stock en cero, la primera compra fija el promedio. Revertir una compra deja el libro y el promedio como estaban. |
| `consumirPorVenta` / `revertirVenta` | 3 × 30 ml descuentan **45 esencia, 42,9 diluyente, 1,2 sellador, 0,9 feromonas y 3 envases**, con costo congelado **$27.768**. Borrar la venta lo devuelve exacto. El **comprado** descuenta una unidad y no exige talla; el **fraccionado** descuenta ml + envase; el perfume **sin esencia no descuenta nada** (el que infla la ganancia). Stock insuficiente: **deja pasar, avisa y queda negativo**, nunca bloquea. |
| Cupones (`anuncio.service`) | Un código es de **un solo uso en la vida**. Una persona sostiene **uno a la vez**. `max_descuento` topa el descuento en pesos y `max_canjes` agota la campaña. **Editar una venta y borrar el código se RECHAZA en el servidor**; borrar la venta sí lo libera; y en **crédito** quitarlo sí lo libera. Esas tres se comportan distinto a propósito y son las que se rompen al "unificarlas" sin querer. |

### Recorridos completos

1. **Combo en el carrito** — tres perfumes de la misma categoría y talla: el precio de combo se
   aplica solo y el mensaje de WhatsApp sale con el total correcto.
2. **Venta con líneas** — registrar producto + talla + cantidad desde el dashboard y comprobar
   que el inventario bajó lo que tenía que bajar.
3. **Cupón amarrado a su venta** — verificar el código, enlazarlo, y comprobar que al editar
   **no** se puede soltar borrando el campo.
4. **Lista de precios** — mover una casilla de Catálogo → Precios cambia a toda la categoría y
   **no** toca a los que tienen precio propio.

## Un fallo documentado que esta ola cierra

`recalcularPromedio` solo escribe el precio `if (movs.length)`. Si al borrar una compra el
insumo se queda **sin ningún movimiento**, conserva el costo que fijó la compra borrada en vez
de volver a su precio de partida (lo que se vio en agosto: Esencia Clásica en $383,18 en vez de
$380). Está anotado en `CLAUDE.md` como caso de borde abierto.

No es un cambio de regla de negocio: la regla dice que el precio **es** el promedio del libro de
movimientos, y con el libro vacío conservar el costo de una compra borrada es incumplirla. Se
escribe la prueba con el comportamiento correcto, se comprueba que falla, y se arregla.

## Qué NO cubre

Correo, subida de fotos, respaldo de base y pasarelas de pago: nada de eso mueve plata en este
negocio. Tampoco los importadores de Excel más allá de lo que ya cubre la primera ola.

## Cómo se corre

```bash
cd backend  && npm test        # aritmética + base de datos (segundos)
cd frontend && npm test        # aritmética
npm run test:e2e               # recorridos, con los servidores levantados
```
