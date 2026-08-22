# Pruebas automatizadas (desde 2026-08-12)

```bash
cd backend  && npm test              # aritmética + base de datos (~40 s)
cd backend  && npm run test:unidad   # solo aritmética, sin MySQL (~0,5 s)
cd backend  && npm run test:bd       # solo las que tocan base
cd backend  && npm run test:e2e      # recorridos en navegador (~35 s)
cd frontend && npm test
```

**215 pruebas** al 2026-08-15 (contadas corriéndolas): **68 en el frontend**, **115 en el
backend** (1 marcada como discrepancia) y **32 recorridos** en navegador repartidos en 16 archivos
(`arranque`, `combo`, `compra`, `cupon`, `desplegable`, `disponibilidad`, `esenciaEnPerfume`,
`listaPrecios`, `mayoreo`, `menuLateral`, `modal`, `paginaPublica`, `pedidoSugerido`,
`promociones`, `tallas`, `venta`).

## Por qué estas herramientas

**Vitest, NO Jest.** El frontend es Vite 8: Vitest reutiliza esa configuración (alias `@/`,
TypeScript) sin una capa paralela que se rompe en cada actualización. Usarlo también en el backend
deja UNA herramienta en vez de dos.

**Playwright y no Cypress**, con `playwright-core` sobre el Edge instalado (igual que
`revisar-pantalla.mjs`): cero navegadores descargados. Y corre **bajo Vitest**, así que sigue
habiendo una sola herramienta de pruebas en todo el proyecto.

## Reglas

- **Solo `*.test.ts`.** El patrón por defecto de Vitest también recoge `.spec.ts`, y
  `src/schemas/import.spec.ts` **NO es una prueba**: es la definición de columnas del importador.
  Está acotado en los dos `vitest.config`.
- **El `tsconfig.json` del backend EXCLUYE los tests** y también `src/test/` y `e2e/`: si no,
  `npm run build` los mete en `dist/` y suben al servidor con un `import` de vitest —y del CLI de
  Prisma— que allá no existe.
- **Los archivos van junto al código** que prueban y **los nombres de las pruebas en español**: el
  dueño tiene que poder leer la salida cuando algo falle.
- **Se escriben desde la REGLA de negocio, no desde el código.** Si el código hace otra cosa, no se
  fuerza la prueba para que pase: se marca la discrepancia y se le pregunta al dueño. Así se
  encontró el fallo de `matchPerfumes` con los nombres que llevan coma.
- **Ola 1** (funciones puras): `finalPrice`, `detectarCombos`, `costeoCotizacion`, `lineasPedido`,
  `catalogoFiltros`, `perfumeMatcher` y `sinEsenciaParaUno`. Diseño en
  `docs/superpowers/specs/2026-08-12-pruebas-motores-precios-design.md`.
- **Ola 2** (lo que escribe + recorridos): costo promedio, consumo por venta, cupones e IVA por
  proveedor. Diseño en `…/2026-08-12-pruebas-integracion-y-e2e-design.md`.

## La base de pruebas: `perfumes_test`, vacía y desde las migraciones

**Nunca `perfumes_db`.** Se crea vacía y se le aplican las migraciones. Dos motivos, y el segundo
no es obvio: (1) los datos del negocio no se abren, y estas pruebas TRUNCAN tablas; (2) **armarla
desde las migraciones las prueba a ellas**. Nadie verificaba que el juego completo levante el
sistema desde cero, y eso se descubriría el día que haya que reconstruir el servidor — el peor
día. Verificado el 2026-08-12: **lo levanta, y el resultado es idéntico a la copia de producción**
salvo un default cosmético (`curdate()` frente a `now()`).

- **El seguro está por partida doble**: `prepararBase.ts` se niega a correr si el nombre de la base
  no termina en `_test`, y `limpiarBase()` —la que de verdad borra— lo vuelve a comprobar antes de
  truncar. Probado apuntándolo a `perfumes_db`: se niega y los datos quedan intactos. **No quitar
  la segunda comprobación** por parecer redundante: es la última oportunidad de parar si alguien
  corre las pruebas con otra configuración.
- **Dos grupos** (`projects` de Vitest): `unidad` no necesita MySQL prendido, `base` sí. Los
  archivos que tocan base se llaman `*.bd.test.ts`.
- **El stock se siembra con un movimiento de `ajuste`, nunca escribiendo la columna.** `stock` y
  `precio` son una PROYECCIÓN del libro de movimientos, así que un valor puesto a mano desaparece
  en cuanto algo obliga a reconstruir — y la prueba falla culpando al código de un descuadre que
  creó la siembra. Ya pasó.
- `descuento_codigos.venta_id` **sí tiene llave foránea** (a diferencia de
  `movimientos_inventario.referencia_id`, que es un número suelto): para enlazar un cupón hace
  falta una venta de verdad.

## Los recorridos (`backend/e2e/`)

Levantan el sistema entero: base sembrada, backend en el **4100** y tienda en el **5273**. Puertos
y base propios, así que **el dueño puede tener sus servidores de siempre corriendo** mientras
pasan, y ningún recorrido escribe en `perfumes_db`.

- **El `.env` NO se toca.** El backend salta el captcha cuando `RECAPTCHA_SECRET_KEY` viene vacía,
  y `dotenv` **no sobreescribe** una variable que ya existe en el entorno: basta arrancarlo con esa
  variable en blanco. Editar el `.env` del dueño y restaurarlo después es justo lo que se queda a
  medias cuando una prueba revienta.
- **La sesión de admin se pide por HTTP y se inyecta como cookie**, sin pasar por el formulario.
  Así no se carga el script de reCAPTCHA, que exigiría internet y añadiría un fallo intermitente
  que no dice nada del sistema.
- **La entrada se pide UNA vez por corrida, en el arranque**, y se deja en un archivo temporal que
  todos los recorridos leen (`ARCHIVO_SESION`). Antes era una por archivo, y como el servidor corta
  a los **10 intentos cada 15 minutos**, eso ponía un techo al número de recorridos: al sumar el
  archivo 12 (el del menú lateral) el último moría con un **429** que no dice nada del sistema.
  Va por archivo y no por variable de entorno porque cada recorrido corre en su propio proceso.
  **Agregar recorridos ya no cuesta intentos de login.**
- **La tienda arranca con `--mode e2e`** para tomar `frontend/.env.e2e`, que la apunta al backend
  de pruebas.
- **Cada recorrido trabaja sobre su propia categoría** (Carrito, Precios, Ventas). El catálogo
  público va por caché en memoria, así que resembrar con el servidor andando enseñaría datos
  viejos; con una categoría por recorrido el orden de los archivos da igual.
- **Un fabricado sin esencia sale AGOTADO** y una card agotada no tiene botón de agregar. Al
  sembrar productos de prueba hay que darles esencia con stock, o la tienda queda llena de cosas
  que no se pueden comprar.
- `src/app.ts` **exporta `server`** solo para poder apagarlo al terminar; en producción nadie lo usa
  y arrancar sigue siendo `node dist/app.js`.
- Cubren: combo en el carrito, venta con líneas que descuenta inventario, cupón amarrado a su venta
  (por pantalla **y** por API, porque la pantalla se puede saltar), lista de precios que mueve a
  toda la categoría sin tocar los precios propios, y **un 1.1 sin armar que no llega a la tienda**
  (`disponibilidad.e2e.test.ts`: se crea desde el formulario con la casilla marcada, la tabla dice
  "Sin armar" y la card sale agotada aunque su esencia esté llena; después se arma el lote desde
  el modal y se comprueba que aparece en Inventario y pasa a vendible), **una talla nueva que
  nace con sus ml** (`tallas.e2e.test.ts`), **Blog y Contáctame** (`paginaPublica.e2e.test.ts`) y
  **el camino del mayoreo** (`mayoreo.e2e.test.ts`: un rango de precio por cantidad, el costo de
  producción que sale de él, y una cotización de lista de precios que vuelve con su número).
  También **la compra** (`compra.e2e.test.ts`: se da de alta un material desde la propia factura,
  entra al inventario y queda con el costo que salió de esa compra) y **las promociones**
  (`promociones.e2e.test.ts`: un anuncio y la tarjeta de sellos, comprobados recargando).
- **`formatPrice` mete un espacio DURO entre el `$` y el número** (es `Intl` es-CO). Buscar
  `text=$19.000` no encuentra nada nunca; hay que buscar solo el número.
- **`selectOption()` de Playwright no sirve en esta aplicación**: ningún desplegable es un
  `<select>` del navegador, ni siquiera los escritos con `<option>` (`SelectSimple` envuelve al
  `BuscadorSelect`). Se abre y se hace clic — para eso está el ayudante `elegirOpcion()`.
- **El portal del cliente tiene su propio recorrido** (`portalCliente.e2e.test.ts`) y es el
  único que NO entra como administrador: sus tres pantallas enseñan lo de cada quien (sus
  favoritos, sus compras, sus sellos, su deuda), así que una sesión de admin las vería vacías y
  pasaría sin comprobar nada. Para eso está `abrirComoCliente(email, clave)` en `navegador.ts`,
  que entra por la API y mete las cookies en una pestaña nueva. **Ojo con los intentos de login**:
  cuesta uno de los 10 que da el servidor cada 15 minutos, así que se pide una vez por recorrido.
- **Ningún recorrido puede dar por fijo un total de la base.** El del filtro de columna esperaba
  "12 registros" —las ventas que él mismo sembraba— y se rompió el día que otro recorrido registró
  una venta más, sin que nada estuviera mal. Ahora pregunta `prisma.venta.count()` y compara con
  eso. Misma familia que la regla del material compartido: lo global se consulta, no se escribe a
  mano. Y lo que es único en toda la tienda (la configuración de la tarjeta de sellos) **se
  escribe justo antes de mirarlo**, porque otro recorrido también la configura.
- **El buscador de un desplegable solo se pinta con 6+ opciones** (`MINIMO_PARA_BUSCAR` en
  `BuscadorSelect`). La tienda sembrada tiene un puñado de productos, así que
  `getByPlaceholder('Escribe para filtrar…')` se queda esperando los 30 s y el recorrido muere sin
  decir por qué: se abre el desplegable y se hace clic en la opción por su nombre.
- **El regalo por línea** (`regaloDeLinea.e2e.test.ts`): en Ventas, un accesorio que no se cuela
  entre las fragancias, 2 unidades con 1 marcada como regalo que cobran una sola, y el inventario
  descontando las dos. Y en Créditos, que NO aparezca ni el campo ni el buscador de accesorios —
  era un paso manual del plan y ahora se comprueba solo.
- **Un recorrido no puede tocar un material que otro da por fijo.** El de la compra empezó
  comprando el "Frasco 30 ml" sembrado: le subía el costo promedio y el recorrido de la venta
  —que comprueba un costo exacto— fallaba **según el orden de los archivos**, o sea a veces sí y a
  veces no. Ahora crea su propio material. Misma regla que las categorías: cada recorrido con lo
  suyo, y el orden deja de importar.
- **Un refactor de red se comprueba guardando y volviendo a leer.** `paginaPublica` no mira el
  diseño: crea una entrada de blog y la busca en la lista, y guarda el nombre de Contáctame,
  **recarga** y comprueba que sigue ahí. Es el fallo típico al mover una pantalla de librería —se
  pinta igual, dice "guardado ✓" y el dato nunca viajó— y ninguna prueba de aritmética lo ve.
- **Esperar a que el modal se CIERRE, no solo a que aparezca el dato.** La lista se repinta antes
  de que termine la animación de salida del diálogo, así que una captura tomada justo ahí sale con
  el formulario todavía encima y parece un fallo que no existe (pasó el 2026-08-15 con el blog).
- **`innerText` devuelve lo RENDERIZADO, no el texto del código**: las etiquetas de las métricas
  llevan `uppercase` por CSS, así que buscar "Frascos armados" tal cual falla. Comparar con
  expresión regular insensible a mayúsculas.
- **El botón de un `BuscadorSelect` muestra la opción elegida, no su `placeholder`**: de arranque
  es la PRIMERA opción de la lista ("— Sin especificar —"), no el texto gris que uno espera.
- **Las fotos de los recorridos van a la carpeta temporal del sistema**, no al repositorio: sirven
  para MIRAR la pantalla cuando algo se ve raro, no para versionarlas.
- **El botón de guardar de un modal NO se llama "Guardar"**: `PerfumesTab` manda
  `submitLabel="Crear perfume"` / `"Guardar cambios"`. Buscar el genérico deja el recorrido
  esperando 30 segundos a un botón que no existe.
- **`getByLabel` no funciona en el dashboard**: `Field` (`dashboard/ui.tsx`) pinta un `<label>`
  suelto, sin `htmlFor` y sin envolver el campo, así que el navegador no los relaciona. Es un hueco
  de accesibilidad real —un lector de pantalla tampoco los asocia— pendiente de hablar con el
  dueño. Mientras exista, los recorridos usan el ayudante `campo()`.
