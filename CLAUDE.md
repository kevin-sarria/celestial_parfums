# Celestial Parfums — Contexto para Claude

E-commerce de perfumería (Colombia, COP) con pedidos por WhatsApp (sin pagos en línea).
Dueño: Kevin — no técnico; explícale en español claro, sin jerga, y dale los comandos listos.

**Mantén este archivo actualizado**: cada vez que hagas un cambio relevante (regla de
negocio, migración, convención nueva, gotcha descubierto) agrégalo aquí en la sección
que corresponda. Este documento es la memoria del proyecto entre sesiones y modelos.

## Reglas inquebrantables de código

- **Refactoriza SIEMPRE que se pueda**: extrae helpers, reutiliza lógica existente (no
  dupliques), y deja el código más limpio que como lo encontraste tras cada cambio.
- **Ningún archivo debería superar ~500 líneas** idealmente. Si un archivo crece de más,
  pártelo en piezas con una sola responsabilidad (hooks, componentes, helpers, servicios)
  antes de seguir agregándole. Evita la sobrecarga de código en un mismo archivo.

## Stack y estructura

- `backend/`: Express + TypeScript + Prisma 6 + MySQL. Build: `npm run build`
  (prisma generate + tsc → `dist/`).
- **El cliente de Prisma se importa de `@prisma/client`, NUNCA de una carpeta dentro de
  `src/`** (y el `generator` del schema NO lleva `output`). Con `output = "../src/generated/
  prisma"` el proyecto funcionaba en local pero **se rompía en el servidor**: `tsc` solo
  traduce los `.ts`, así que a `dist/` llegaban 7 archivos y quedaban fuera los otros 43
  — incluido el MOTOR de Prisma. En local no se notaba porque el dev server corre desde
  `src/`; en producción `node dist/app.js` arrancaba sin motor. `node_modules` no lo
  compila nadie, así que ahí el cliente queda entero. Verificado arrancando `dist/app.js`
  y consultando la base de verdad.
- `frontend/`: React + Vite + Tailwind **v4** + shadcn. Build: `npm run build` → `dist/`.
- Auth: JWT en cookies, roles (ADMIN=rol 1), Google OAuth, reCAPTCHA en login/registro
  (para pruebas E2E locales: comentar `RECAPTCHA_SECRET_KEY` en `.env` y restaurar al final).
- Local: MySQL de XAMPP (`C:\xampp\mysql\bin\mysql.exe`, base `perfumes_db`, user root sin
  password). Arrancar si no responde el puerto 3306. Producción: base `celestial_db`.

## Arquitectura de páginas (landing vs catálogo)

- **`/` = Landing de marketing** (`HomePage.tsx`), diseñada para CONVERTIR (embudo):
  `LandingHero.tsx` (propuesta de valor "las fragancias que amas, sin pagar de más" +
  buscador con ejemplos que NAVEGA a `/perfumes?q=` + micro-confianza) → **más vendidos**
  (prueba social primero) → nuevos → **combos con descuento** (sube el ticket) →
  `EnvioPagos.tsx` (reaseguro) → galería de ganadores → "cómo funciona" → **cierre con CTA
  de WhatsApp**. NO lleva sidebar de filtros ni grilla paginada. `/catalog` (solo admin) es
  su vista previa (`adminPreview`).
- **Muestras de regalo = INTERNO, NO se muestran en la web** (`MUESTRAS_INTERNO` en
  `config/negocio.ts`, solo referencia). Son un detalle interno según disponibilidad de
  envases, no una promesa pública. En la web se promete envío + pago + asesoría por WhatsApp.
- **`/perfumes` = Catálogo completo** (`PerfumesPage.tsx` + hook `usePerfumes`): filtros +
  paginación + búsqueda server-side. Lee `?q=` (búsqueda del landing) y `?categoria=` (de
  "elegir mis perfumes" de un combo). Aquí vive la grilla pesada.
- **`/legal`** = información legal (ver más abajo).
- Datos operativos del negocio (transportadoras, tiempos, métodos de pago, muestras) en
  `config/negocio.ts` — editar ahí (candidato a volverse configurable desde el dashboard).

## Dashboard: la pestaña vive en la URL

- Ruta `/dashboard/:tab` (ej. `/dashboard/cotizaciones`). `/dashboard` o una pestaña
  inexistente redirigen a `/dashboard/perfumes` con `replace` (no ensucia el historial).
  Así recargar, usar atrás/adelante o guardar un marcador conserva dónde estabas.
- La pestaña activa se lee de `useParams`, NO de `useState`: la fuente de verdad es la URL.
  Un efecto sobre `tab` recarga los datos de perfumes/combos y expande la sección del menú
  correspondiente, funcione el cambio por clic o por el botón atrás del navegador. Ese
  efecto se salta el primer render (`primerRender` ref) porque la carga inicial ya trae
  esos datos — si no, se pedirían dos veces al entrar.
- Al agregar una pestaña nueva basta con sumarla al union `Tab`, a `TAB_META` y a
  `NAV_SECTIONS`; el enrutado la reconoce sola (`esTabValido` valida contra `TAB_META`).
- **El footer público NO va en el dashboard**: `App.tsx` compara con
  `pathname.startsWith('/dashboard/')`, no por igualdad. Comparar `=== '/dashboard'` dejaba
  el footer de la tienda colgando debajo de TODAS las pestañas (la ruta real es
  `/dashboard/:tab`); solo se notaba al mirar la página completa, no la primera pantalla.

## La tabla del dashboard (`SmartTable`) — Ola 1 del rediseño, 2026-08-01

Diseño y plan en `docs/superpowers/specs/` y `docs/superpowers/plans/` (fecha 2026-08-01).
La usan ~10 pestañas, así que **todas sus capacidades son props OPCIONALES**: una pestaña
que no pase nada renderiza exactamente igual que siempre. Al tocarla, mantener esa regla.

- `numerada`: columna **#** con la **posición visible**, no el id. Sigue de corrido entre
  páginas (la 2 empieza en 26) y **se renumera al reordenar** — es un número para leer y
  para decir "revisa el 14", no un código permanente. El `id` sigue siendo la llave real
  de `rowKey` y de las rutas `PATCH`/`DELETE`; el `#` nunca viaja al servidor.
- `paginadoLocal`: pagina en el navegador las pestañas que cargan todas las filas de una
  (Usuarios, Clasificaciones). Se ignora si ya se pasó `pagination` (la de servidor).
  Por defecto **25**, a propósito distinto del `DEFAULT_PAGE_SIZE = 10` de `helpers.ts`:
  ese aplica cuando cada página cuesta una petición; aquí las filas ya están en memoria.
  El corte se hace **sobre `processed`** (ya filtrado y ordenado), nunca sobre `rows`.
- **Volver a la página 1** al buscar, filtrar u ordenar se hace **en el evento**
  (`volverAlPrincipio`), no en un `useEffect`: el linter de react-hooks rechaza
  `setState` dentro de un efecto porque encadena renders. Sin esto, filtrar de 200 a 3
  registros deja al usuario mirando una página 7 vacía.
- `tarjetaMovil`: debajo de 640px la fila se pinta como tarjeta táctil resumida que se
  expande al tocarla (`FilaTarjeta.tsx`), en vez del scroll horizontal. Es **opt-in** para
  no cambiarle el aspecto a Ventas y Créditos antes de su propio rediseño (Ola 2).
  El papel de cada columna se declara con `movil: 'titulo' | 'meta' | 'estado' |
  'destacado' | 'detalle'`; **sin marcar es `detalle`** (solo se ve al expandir), y si
  ninguna se declara `titulo` manda la primera columna.
- `accionesMovil`: acciones con TEXTO para la tarjeta (`✎ Editar`), porque `renderActions`
  devuelve botones de solo icono pensados para una fila estrecha y con el pulgar el icono
  solo es ambiguo. Si falta, cae a `renderActions`.
- `useMediaQuery(query)` (`components/table/useMediaQuery.ts`) reemplazó al hook privado
  `usePantallaAngosta`; lo usan el paginador compacto (520px) y la tarjeta (639px).
- **Clasificaciones** (aromas, ocasiones, categorías, presentaciones) salen las cuatro de
  `LookupTab`: alta y edición por modal con **"Guardar y agregar otro"**, aviso de
  duplicado calculado en el front (normalizando tildes y mayúsculas) antes de gastar una
  petición, y `nuevo`/`editar` como textos completos ("Nueva categoría", "Nuevo aroma")
  en vez de derivar el género gramatical, que se escribe mal.
- **BUG ya corregido**: los tres `handleLookup*` de `DashboardPage` hacían
  `await guardedFetch(...)` **sin mirar `res.ok`**. Si el backend rechazaba, no aparecía
  nada: el elemento no se agregaba y nadie sabía por qué. Ahora devuelven
  `{ ok, error }` y la pestaña muestra el mensaje del servidor. **Regla: ningún handler
  de mutación puede ignorar la respuesta.**
- `BloqueCampos` (`dashboard/ui.tsx`) agrupa campos con título dentro de un formulario
  largo. Estrenado en Usuarios (contacto vs. cuenta web); es la pieza con la que la Ola 2
  parte el formulario de Ventas.

## Ventas y Créditos (`pedido/`) — Ola 2 del rediseño, 2026-08-02

Diseño y plan en `docs/superpowers/` (fecha 2026-08-02). Las dos pantallas hacían **lo
mismo** con dos implementaciones desalineadas: cada una era buena en lo que la otra no.
Ahora comparten pieza.

- **`pedido/lineasPedido.ts`** (antes `creditoLineas.ts`): cálculos puros. La `LineaPedido`
  lleva la talla **por partida doble a propósito**: `presentacion` es la etiqueta con la que
  se busca el precio y `ml` el número con el que el inventario sabe qué receta descontar.
  Las dos salen juntas de `perfume.precios[]`, así que **no se pueden desincronizar**.
  `presentacion`/`ml` en null = producto sin talla (una gorra).
- **El servidor manda `ml` dentro de `precios[]`** (`resolverPrecios`). Se decidió eso en vez
  de que el navegador adivine el número leyendo el texto: de ese número depende qué insumo
  se descuenta, y "200/250ML" o "Combo Personalizado" no tienen número que adivinar.
- **`ArmadorPedido`**: agregar el mismo producto con la misma talla suma unidades; cambiar
  la talla hasta dejar dos líneas iguales **las fusiona**. Sin eso la misma referencia
  aparece dos veces y el conteo miente.
- **`ResumenPedido`**: productos − combo − cupón = total. Las líneas que valen cero no se
  pintan. En Ventas el total es un **"Sugerido"** con botón `usar`: el valor se sigue
  tecleando a mano porque es la plata que entró de verdad; el sistema propone, no impone.
- **El campo "Cantidad" suelto de Ventas desapareció**: se deriva de las líneas
  (`unidadesDeLineas`). Era un dato duplicado y el día que no coincidiera ganaba el número
  tecleado.
- **Al contado el precio de combo se aplica solo** (es política de precios permanente);
  a crédito hay interruptor y está apagado por defecto.
- **CUPÓN CANJEADO = AMARRADO A SU VENTA** (decidido con el dueño el 2026-08-02). Antes
  bastaba con **borrar el texto del campo al editar** para que `liberarCodigoDeVenta` lo
  devolviera a `activo` y esa persona pudiera usarlo otra vez. Ahora:
  - `liberarCodigoDeVenta(ventaId, excepto, soloNoCanjeados)` — al **editar** se pasa
    `true`; al **borrar** la venta no, porque ahí sí debe soltarse.
  - `updateVenta` **rechaza** el cambio con un mensaje claro. La regla vive en el servidor:
    la pantalla se puede saltar.
  - En el formulario el campo sale `disabled` con la explicación.
  - **Ojo: en CRÉDITOS sigue funcionando distinto a propósito** (quitar el código lo
    libera; es el único camino para devolver un cupón canjeado en crédito). Igualar las dos
    reglas es una decisión aparte que hay que hablar con el dueño.
- **`GET /creditos/totales`**: cuánto te deben, cuánto está vencido y cuánto abonaron este
  mes. Hace falta un endpoint porque eso **no se puede calcular con la página que está en
  pantalla**. Usa el MISMO criterio de saldo que `mapCredito` para que la caja de arriba y
  la tabla de abajo nunca digan cosas distintas.
- Archivos: `VentasTab` 607→236 (+ `VentaForm` 453), `CreditosTab` 565→313
  (+ `CreditoForm` 381). Ninguno pasa de 500.

## Maquetación de una pestaña del dashboard (decidido por el dueño, 2026-08-02)

El dueño rechazó tener el título, los botones, las métricas, el buscador y la tabla dentro
de la misma tarjeta: *"se ve pésimo y nada similar a un dashboard serio"*. El orden correcto:

1. **`EncabezadoPagina`** — solo el título y su contador, fuera de la tarjeta.
2. **`FranjaMetricas`** + **`StatCard`** — rejilla (no `flex-wrap`, para que queden del
   mismo ancho) sobre el fondo de la página. `StatCard` va en **`bg-card`**: antes era
   `bg-background` DENTRO de una tarjeta blanca, o sea al revés, y parecía un hueco hundido.
   `StatCard` acepta `nota` para el matiz que no cabe en la etiqueta.
3. **`Section`** con la tabla **y nada más**.
4. **Los botones que actúan SOBRE la tabla** (crear, importar, exportar) van en la prop
   `acciones` de `SmartTable`, dentro de su barra y **al lado opuesto del buscador**.
   Sueltos junto al título se leen como acciones de toda la página y dejan una banda de
   botones sin caja. Esto lo corrigió el dueño explícitamente.

**Aplicada en las 14 pestañas** de las tres olas. La única excepción es **Tamaños y
fórmulas**, que no tiene tabla sino una rejilla de tarjetas: ahí sus botones van en el
`EncabezadoPagina` porque no hay barra donde colgarlos.

**OJO — "no hay barra" casi nunca es una razón válida, es un síntoma** (2026-08-04). A
Inventario se le documentó esa misma excepción y era falsa: no tenía barra porque su tabla
estaba escrita a mano en vez de usar `SmartTable`. En cuanto se convirtió, apareció la
barra y la excepción se cayó sola. Antes de escribir una tabla a mano, comprobar que
`SmartTable` no sirva — si no se usa, la pantalla pierde de golpe buscador, orden, filtros,
columna #, paginación y vista de celular, y se nota a simple vista que no pertenece al
mismo dashboard. Es exactamente lo que el dueño reclamó.

**`ExportMenu`** (`components/ExportMenu.tsx`) agrupa varias descargas de Excel y el
importar en UN solo botón desplegable. Nació en Inventario, que tenía 3 exportaciones + 1
importación + 3 acciones de negocio: siete botones no caben en una barra y la fila suelta
de Excel era la "banda de botones sin caja" que el dueño ya había rechazado. La lógica de
descarga vive en `useExportEntity` y la comparte con `ExportButton`, así que no está
duplicada. Regla: bajar Excel es MANTENIMIENTO, no la tarea del día — cabe detrás de un clic;
lo que no puede esconderse son las acciones reales (registrar llegada, producción, salida).

Los comparativos entre meses **no van en las cajas**: van a Reportes, que es la pantalla
de analizar, no la de registrar.

## Reportes — selector de periodo (Ola 3, 2026-08-02)

- `ReporteShell` acepta `acciones` para los controles del reporte. En Ventas hay un
  selector de **3 / 6 / 12 meses** que recorta la serie **solo del gráfico**.
- La tarjeta "Ventas" dice cómo va el último mes contra el anterior
  (`variacionUltimoMes`). Devuelve null si el mes previo fue cero: un "+∞ %" no informa.
- **El número de ventas SIEMPRE son 12 meses** aunque el gráfico muestre 3: el selector no
  filtra el resto del reporte. La etiqueta lo dice explícitamente en vez de mentir.
- **GOTCHA repetido**: `Intl.DateTimeFormat` necesita `timeZone: 'UTC'` al formatear un mes
  construido con `Date.UTC`. Sin eso, en Colombia (UTC-5) el día 1 se corre al mes anterior
  y "agosto" se lee "julio". Se detectó mirando la pantalla, no compilando.

## Avisos al usuario (toasts)

- Se usa **sonner**, el toast oficial de shadcn (`components/ui/sonner.tsx` con el `<Toaster/>`
  montado UNA vez en `App.tsx`). En cualquier vista: `import { toast } from 'sonner'` →
  `toast.error(msg)` / `toast.success(msg)`. **No inventar un toast propio**: sonner ya
  resuelve apilado, colapso, deslizar para descartar, accesibilidad y animaciones (se probó
  una implementación casera y se descartó: apilaba avisos duplicados y en móvil se montaba
  sobre el formulario). `richColors` activo para que el error se vea rojo de un vistazo.
- **Deduplicar los avisos repetibles**: `toast.error(msg, { id: msg })` — si el usuario
  pulsa el botón varias veces, el aviso se reemplaza en vez de apilarse (probado: 6 clics
  seguidos = 1 solo aviso).
- **Regla: una acción que falla SIEMPRE avisa.** Nada de `if (!res.ok) return;` mudo ni de
  dejar el error solo en la consola (el dueño no la mira). Patrón:
  ```ts
  const res = await guardedFetch(url, {...});
  if (!res.ok) { const j = await res.json().catch(() => null);
                 toast(j?.error ?? 'No se pudo guardar'); return; }
  ```
  Mostrar el mensaje que manda el backend: ya viene redactado en español y explica la causa.
- Validar en el front ANTES de llamar (y avisar con toast) para que el usuario sepa qué
  corregir sin esperar al servidor. Al fallar, **no borrar lo que el usuario escribió**.
- `window.alert()` queda deprecado en el dashboard: usar toast. `window.confirm()` sí sigue
  para confirmar borrados.

## Diseño (respetar SIEMPRE)

- Design system: shadcn/Tailwind, paleta marfil + iris (`bg-card`, `text-primary`,
  `bg-brand-soft`, `text-ink`), tipografías Fraunces (display) / Manrope. Solo modo claro.
- Estética "sobria": cards minimalistas, sin exceso de info. Inputs/selects: `rounded-md
  border-input bg-card shadow-xs` + focus ring de 3px (`ring-ring/50`). Copiar clases de
  `ui/input.tsx` / `ui/native-select.tsx` al crear controles.
- Listas largas en formularios → `components/BuscadorSelect.tsx` (combobox con buscador
  DENTRO del panel; modo valor único con `value`, modo "agregar varios" sin `value`).
  Selects de 2-5 opciones → `NativeSelect`. Multi-select: control arriba, chips de lo
  elegido DEBAJO.
- Notas olfativas con colores estilo Fragrantica: `domain/entities/aroma.colors.ts`
  (fallback determinístico por hash para aromas nuevos).
- Símbolos de género con selector de texto U+FE0E (`♂︎`) o iOS los vuelve emoji.
- Grillas de catálogo: `sm:grid-cols-[repeat(auto-fill,minmax(16rem,18rem))]` — las cards
  nunca se estiran más de 288px (mismo ancho del carrusel). Datos faltantes en cards: las
  filas se colapsan (no reservar espacio vacío); footer anclado con `mt-auto`.

## Reglas de negocio (decididas con el dueño; no cambiarlas sin preguntarle)

### Precios por presentación (base de todo lo demás)
- El precio NO vive en el perfume: sale de una **cascada** resuelta en `mapPerfume`:
  1. `perfume_presentacion.precio` (excepción de ESE perfume en ESA talla)
  2. `precios` (categoría × presentación) — la lista de precios del negocio
  3. `perfumes.precio` (respaldo: perfumes sin categoría o sin lista)
- Cambiar una casilla de la lista mueve a TODOS los perfumes de esa categoría de una
  vez; los que tienen precio propio no se enteran. Editor: dashboard → Catálogo → Precios.
- `mapPerfume` expone `precios[]` (talla + precio + `propio`), `precio` (el más barato,
  para las cards) y `varios_precios` (dispara el "desde $X").
- El carrito guarda el precio de LA talla elegida: `AddToCartModal` recibe precios de
  lista y aplica `finalPrice` UNA sola vez (no pasarle precios ya descontados).
- **Esencia premium** (`perfumes.esencia_premium`): contratipos con la esencia de mayor
  calidad del laboratorio (ej: Ahli Octans, 60k los 30ml). Llevan distintivo en card y
  detalle, y **NUNCA entran en el precio de combo** (`useComboDetector` los excluye del
  agrupado). Ojo con el vocabulario: NO es perfumería "nicho" (Creed, MFK), que es otra
  cosa; el adjetivo describe la esencia. Cuando el carrito sugiere completar un combo y
  hay premium excluidos, el mensaje lo aclara (si no, el cliente reclama al pagar).

### Precios y descuentos (lo más delicado de la app)
1. **Descuento de producto vs categoría**: el % efectivo es `max(propio, categoría)` —
   se calcula en `mapPerfume` (backend). El de categoría es UN registro en `categorias.descuento`,
   nunca updateMany sobre perfumes.
2. **Combos = precio por mayoreo, SIEMPRE aplica**: el carrito detecta N perfumes sueltos de
   la misma categoría+presentación y cobra precio de combo si es más barato
   (`useComboDetector.ts`). No es una promo: es política de precios permanente.
3. **Cupones** (anuncios tipo `descuento` + códigos únicos `CP-XXXXXX`):
   - Una persona sostiene **UN solo cupón a la vez**; cada cupón es de **un solo uso en la
     vida** (código canjeado bloquea ese cupón, no las campañas futuras).
   - Por compra se redime **un solo cupón** (el de mayor descuento en pesos).
   - El cupón descuenta **sobre lo realmente pagado** (combo incluido); los mínimos se miden
     sobre precio de lista; los productos con descuento propio NO reciben cupón.
   - Guardarraíles por campaña: `max_descuento` (tope en pesos por canje) y `max_canjes`
     (cupo total; agotado = deja de anunciarse y no emite más).
   - Flujo: popup → carrito aplica solo → pedido WhatsApp lleva el código → admin lo
     verifica en Publicidad → lo enlaza a la venta → al pagarla queda canjeado.
   - **En el formulario de ventas el `valor_venta` SIEMPRE se teclea ya con el descuento
     restado** (es la plata que entró de verdad); la casilla del código solo verifica y
     enlaza, nunca recalcula. Al validar el código aparece una **ayuda de cálculo** que
     propone el valor final (reusa `descuentoDeCupon` de `creditoLineas.ts`, con el tope
     `max_descuento` de la campaña) y un botón "Aplicar" — sugiere, no impone.
     **Guardarraíl anti doble descuento**: si se está EDITANDO una venta cuyo código no
     cambió (`codigoOriginal`), el valor guardado ya trae el descuento y en vez de la
     sugerencia sale un aviso ("no lo vuelvas a descontar"). Igual tras pulsar "Aplicar"
     (`cuponAplicado`), que se resetea si se vuelve a teclear el valor. Esto importa porque
     todas las ventas históricas se registraron con el descuento ya aplicado a mano.
   - Patrón de 2 anuncios: gancho (imagen/mensaje, audiencia "no_registrados") + cupón real
     (descuento, audiencia "registrados").
4. **Los descuentos nunca se acumulan entre sí** salvo cupón sobre precio de combo (regla 3).

### Créditos ↔ Ventas
- Crear un crédito genera su **venta enlazada pendiente** (`creditos.venta_id`), con los
  perfumes detectados del texto de artículos vía `perfumeMatcher`.
- El abono que salda la deuda marca la venta como pagada (y es simétrico: borrar un abono
  la reabre; borrar el crédito borra su venta).
- Estadística "Ingresos este mes" = ventas de contado del mes + abonos del mes. La venta
  enlazada a crédito NUNCA suma ahí (su plata entra por abonos; evita doble conteo).

### Crédito itemizado (productos reales, no texto libre)
- El formulario de crédito arma **líneas**: perfume del catálogo + su talla + cantidad.
  El precio sale de la lista de precios (cascada de `mapPerfume`); el descuento de la
  página se aplica por defecto pero cada línea tiene un check **"sin −X%"** para quitarlo
  (a crédito no siempre aplica lo del contado). La suma = "valor de los productos".
- **Interruptor "aplicar precio de combo"** (apagado por defecto): a crédito el mayoreo NO
  se aplica solo; si se enciende, reutiliza `detectarCombos` (mismo motor del carrito) y
  resta el ahorro. Los ítems con descuento propio o esencia premium no entran al combo.
- El form manda `perfume_ids` (repetidos por cantidad), `presentacion` (resumen "30ml,
  60ml") y `articulos` (texto generado). El backend usa los ids directo (sin matcher);
  el importador de Excel sigue infiriéndolos del texto libre.
- **La deuda que se manda ya es el valor FINAL** (líneas − combo − cupón): el cálculo del
  cupón vive en el FRONT (`creditoLineas.ts`); el backend la guarda tal cual y solo consume
  el código. Así editar no aplica el descuento dos veces. Campo editable a mano.
- **Editar crédito** (`updateCredito`, PATCH `/creditos/:id`): conserva los abonos,
  recalcula pagada contra ellos, reconstruye las líneas desde `venta.perfumes` (talla
  best-effort) y re-enlaza el cupón como en ventas. Quitar el código en el editor lo
  libera (vuelve a activo). Piezas extraídas: `PerfilCreditoModal.tsx` y `creditoLineas.ts`.

### Cupón sobre un crédito (crédito+descuento)
- Al crear o editar un crédito se puede canjear un código: el descuento se calcula en el
  form y se guarda la deuda ya neta. El cupón se consume **al instante** (canjeado, un solo
  uso), NO espera a que pague todo — a diferencia de una venta normal
  (`canjearCodigoEnCredito`; editar usa `liberarCodigoDeVenta` + re-canje como en ventas).
- Borrar el crédito (o quitar el código al editar) **libera** el cupón (vuelve a activo):
  revierte la compra. Es el único camino para "devolver" un cupón canjeado en crédito.
- `creditos.fecha_limite` (`@db.Date`): acuerdo de pago, por defecto 1 mes desde `fecha`,
  editable. El crédito sale "Vencido" en la tabla si sigue con saldo pasada esa fecha.

### Devoluciones y garantías (dashboard → Ventas y créditos → Devoluciones)
- **Toda devolución cuelga de una VENTA** (`devoluciones.venta_id`). Sin ese enlace la plata
  devuelta no se puede descontar de ningún lado y los ingresos quedan inflados para siempre
  (mismo criterio que créditos ↔ ventas).
- **La plata devuelta sale de los ingresos**: `getVentaTotales` resta `monto_devuelto` de las
  devoluciones `resuelta` **por `fecha_resolucion`** (criterio de caja, igual que los abonos):
  una venta de marzo devuelta en julio afecta a julio, que es cuando salió el dinero.
  `total_dinero` resta el histórico completo. Expone además `devoluciones_mes`.
- **Guardarraíl**: no se puede devolver más de lo que costó la venta, contando las
  devoluciones anteriores de esa misma venta (`validarContraVenta`). Sin eso los ingresos
  podrían quedar en negativo.
- Zod exige coherencia: `resuelta` obliga a decir la `solucion`; solo hay `monto_devuelto`
  si la solución es `devolucion_dinero`. Un caso cerrado sin decir qué se hizo deja el
  histórico inservible.
- **Reloj del plazo legal**: la tarjeta avisa en ámbar a los 23 días hábiles y en rojo
  pasados los **30 hábiles** (Decreto 735/2013). Se cuentan HÁBILES (`diasHabilesDesde` en
  `devoluciones/etiquetas.ts`), no corridos: contar corridos daría una alarma prematura.
- **Portal del cliente** (`/mis-compras` → sección "Garantía de mis pedidos",
  `components/devoluciones/MisPedidos.tsx`): el cliente ve sus compras PAGADAS y abre un
  reclamo con motivo, texto y hasta 3 fotos (WebP vía `sharp`, igual que reseñas). Reglas:
  - Nace `pendiente`, `origen: 'cliente'` y **con `monto_devuelto` en 0**: cuánto se
    devuelve lo decide el admin, nunca el cliente (el endpoint ni lo acepta).
  - Solo sobre ventas con `venta.user_id === req.jwtUser.id`; si no, responde
    "No encontramos esa compra en tu cuenta" (mismo mensaje que si no existe: no se
    filtra qué ventas hay).
  - **Un solo reclamo abierto por compra** (evita que se dupliquen a punta de clics).
  - Si el reclamo se rechaza DESPUÉS de subir la foto, el router borra los archivos ya
    guardados: si no, quedarían huérfanos en el disco para siempre.
  - Las rutas de cliente van ANTES de `devolucionRouter.use(requireAdmin)` en el router.
- Los textos (motivos, estados, soluciones, colores) viven en
  `domain/entities/devolucion.labels.ts` (NO en `pages/dashboard`, para que el portal
  público no arrastre código del dashboard). Hay **dos juegos de soluciones**: `SOLUCIONES`
  en voz del admin ("Le repuse el producto") y `etiquetaSolucionCliente` en voz del cliente
  ("Te repusimos el producto") — usar la que corresponda o el texto suena absurdo.

### Inventario y costo promedio (base del futuro POS) — EN CONSTRUCCIÓN
- **El precio de un insumo ya NO se teclea**: es el **costo promedio ponderado** que sale
  de las compras. `insumos_costo.precio` y `.stock` son una PROYECCIÓN del libro
  `movimientos_inventario`; la verdad auditable es el libro.
  Fórmula (en `inventario.repository.ts` → `aplicarMovimiento`):
  `(stock × promedio + cantidad × costo) / (stock + cantidad)`. Una salida (producción,
  garantía, merma) se valora al promedio vigente y **NO** lo modifica.
- **El flete de la compra se reparte entre las líneas** (`costosConFlete`), proporcional al
  subtotal de cada una. El transporte ES parte de lo que costó el material: ignorarlo infla
  los márgenes de las cotizaciones. Se congela en `compra_items.costo_unitario_final`.
- **La compra vive sobre `pagos_proveedor`** (que ya existía), no en una tabla paralela: se
  le agregaron `numero_factura`, `archivos` (JSON) y las líneas `compra_items`. Un pago sin
  líneas sigue siendo válido (los históricos no las tienen) y no mueve inventario.
- **Editar o borrar una compra revierte sus movimientos** (`revertirMovimientos`) y los
  vuelve a aplicar. Sin eso el stock se contaría dos veces. `recalcularPromedio` reconstruye
  todo desde el libro y es la red de seguridad si algo se descuadra.
- **Unidades de compra** (`UnidadCompra`): **ml y gramos van 1 a 1** (así factura el sector);
  NO meter densidades para "arreglarlo", descuadraría contra la factura del proveedor.
  Los **litros SÍ multiplican ×1000** (`FACTOR_UNIDAD` / `aBase`): sin eso, teclear "20 L"
  de alcohol entraba como 20 ml y el costo por ml quedaba **mil veces inflado** — con el
  diluyente siendo casi la mitad del frasco, eso solo da costos de producción absurdos.
  El inventario SIEMPRE guarda la unidad base (ml o piezas).
- **UNA ESENCIA POR FRAGANCIA, no una "Esencia" genérica** (`perfumes.insumo_esencia_id`):
  Eternity, Khamrah y Mandarin Sky cuestan distinto por ml (verificado: 1.233 / 1.850 / 617).
  Promediarlas en un solo insumo daba un costo que no era el de ninguna y la esencia barata
  comprada en volumen se comía el promedio → se cotizaría a pérdida. Cada esencia es su
  propio `insumos_costo` con su stock. La fórmula del tamaño es solo la RECETA de
  proporciones; la esencia sale del perfume (con la del tamaño como respaldo).
- **PRECIO DE VENTA PAREJO, COSTO DISTINTO** (decisión del dueño): todas las no premium se
  venden al mismo precio de lista aunque Khamrah cueste más que Eternity — se renuncia a la
  ganancia extra de la esencia barata por tener un precio reglamentario. **Por eso NO hay
  que poner precio por fragancia**; lo que hace falta es VER el margen de cada una
  (`cotizacion/MargenPorFragancia.tsx`, dentro de Costos de producción): tabla ordenada de
  la que menos deja a la que más, con aviso ámbar bajo 35% y rojo si el costo supera al
  precio. Sin eso, una esencia que sube de precio deja de rendir y nadie se entera, porque
  el precio de venta no se mueve. `calcularDesgloseCosto` acepta un 4º parámetro opcional
  con el costo por ml de la esencia del perfume (prioridad: perfume → receta → por nombre).
- **El envase también varía dentro del mismo tamaño** (normal vs luxury): se elige al
  producir, con el de la fórmula por defecto.
- **Salidas sin venta** (`POST /inventario/salidas`): `muestra` (rolones del mostrario,
  minis de regalo) es **costo de marketing**, `merma` (derrame, frasco roto) es **pérdida**.
  Van separadas a propósito: mezclarlas oculta cuánto cuesta dar a probar. El resumen del
  mes las muestra aparte (`salidasDelMes`).
- **El desperdicio pequeño del día a día NO se anota uno por uno** (los 1,6-3 g que se van
  de más al servir): lo absorbe el **conteo físico**. La diferencia entre el stock teórico y
  el real ES el desperdicio, y queda registrada como `ajuste`. Pedirle al dueño que anote
  cada gramo garantiza que deje de usar el módulo en una semana.
- **Soportes de compra** (`utils/soporteArchivo.ts`): imágenes → WebP como el resto; **PDF
  se guarda tal cual**. `uploadSoportes` valida mimetype **y** extensión (con solo uno, un
  `.pdf` con otro contenido pasaría) y rechaza SVG (admite scripts). `sanearUploadsConservados`
  acepta PDF solo con `conPdf = true` — en reseñas y premios sigue sin admitirlos.
- Verificado numéricamente (`aplicarMovimiento`, prorrateo, reversión de edición y borrado):
  200 ml a $380 + 500 ml a $420 = $408,57 promedio; salida de 150 ml no mueve el promedio.
- **Pestaña Inventario** (`InventarioTab.tsx`, sección Ventas y créditos): existencias, costo
  promedio y valor por insumo, más el valor total de la bodega. El botón **Ajustar** es un
  conteo físico ("tengo X") — con él se siembra el stock inicial; el costo solo pesa si el
  ajuste SUMA material.
- **Producción** (`POST /inventario/producciones`): "armé N de 30 ml" descuenta esencia,
  diluyente, sellador, feromonas, envase y accesorios por defecto. **El frontend calcula qué
  se consume** con el mismo motor puro de las cotizaciones y lo manda; el backend valida y
  aplica (no se reimplementa la fórmula en dos lenguajes). El modal avisa si no alcanza el
  stock. Borrar un lote devuelve los insumos.
- **Garantías al costo real** (`devoluciones.costo_reposicion` + `costo_envio`): al marcar
  "le repuse el producto" se elige el tamaño y las unidades, y se valora al **costo de
  producción**, NUNCA al precio de venta — esa plata ya se cobró en la venta original y
  contarla otra vez duplicaría la pérdida. El costo se congela al guardar.
  **La reposición NO descuenta inventario**: el material ya salió cuando se registró la
  producción de ese frasco; descontarlo de nuevo sería doble conteo.
  La pestaña Devoluciones suma "las garantías te han costado X" (devuelto + producto + envíos).
- **Punto de pedido** (`insumos_costo.stock_minimo`, 0 = alerta apagada): la pestaña muestra
  arriba una **lista de compras** con qué pedir y cuánto (`sugerido` = volver al doble del
  mínimo). Se fija desde el modal Ajustar y se guarda aunque no cambie la cantidad.
- **Orden importante al arrancar**: sembrar primero el stock inicial y DESPUÉS registrar
  compras. Al revés, el promedio se calcula contra stock cero y la primera compra manda sola.


### Inventario fase 2 — DISEÑO ACORDADO CON EL DUEÑO (pendiente de construir)

Decidido el 2026-08-01. **No cambiar sin volver a preguntarle.**

1. **Arma CONTRA PEDIDO, no por lotes.** Por eso NO se lleva stock de "producto
   terminado" como concepto central: **la VENTA es la que consume los insumos**
   (esencia + frasco + caja + diluyente…). De ahí sale el **costo de mercancía
   vendida** y, con él, la ganancia real del mes (hoy "Ingresos" es facturación).
   - Regla para que nunca se cuente doble: al vender, si hay producto terminado
     armado se descuenta ESE primero; si no hay, se consumen los insumos.
   - La `Produccion` manual queda para lo que arme adelantado; ahí sí suma
     producto terminado.
   - **El descuento arranca desde que se active, NUNCA retroactivo**: las ~261
     ventas históricas no tienen que mover inventario.
2. **El frasco y la caja se definen por PERFUME Y TAMAÑO**, no solo por perfume:
   Sauvage 1.1 en 30 ml usa otro frasco que en 100 ml. Sitio natural:
   `perfume_presentacion` (ya tiene perfume+presentación+precio) sumándole
   `envase_insumo_id` y sus accesorios.
   - **OJO — punto delicado**: `PerfumePresentacion` usa `presentaciones` (catálogo
     público, texto libre: "30ml", "100 ml") y el costeo usa `formulas_volumen`
     ("30 ml"). Son tablas distintas y hoy solo coinciden por nombre. Hay que
     enlazarlas de verdad antes de construir esto o el costo se irá al insumo
     equivocado.
   - La fórmula del tamaño queda SOLO como la receta de proporciones (ml de
     esencia, diluyente, sellador, feromonas). El envase sale del perfume.
3. **Merchandising CON inventario** (gorras y demás): `perfumes.tipo_producto` =
   `fabricado` | `comprado` | `merchandising`. Los que no se fabrican no tienen
   fórmula: su costo es lo que se pagó por ellos y su stock se lleva igual que
   un insumo. Meterlos como "perfume fabricado" haría que el costeo intente
   aplicarles una receta y dé números sin sentido.
4. **Originales: las dos cosas.** Botella completa para revender (`comprado`) y
   botella para sacar decants (`fraccionado`): costo del decant =
   (precio botella ÷ ml útiles) × ml + envase. **Falta decidir con el dueño
   cuántos ml se pierden al trasvasar** (merma de fraccionamiento).

5. **Cuándo descuenta**: al REGISTRAR la venta, no al marcarla pagada. El perfume
   ya salió físicamente aunque sea a crédito; si esperara al pago, el sistema
   creería tener frascos que ya no están y se prometerían dos veces.
6. **Si no alcanza el stock: deja pasar y AVISA.** La venta ya ocurrió en la vida
   real y bloquearla no la deshace, solo impide registrarla. El stock queda en
   negativo con alerta visible para que se cuadre con un conteo. Nunca en
   silencio: el descuadre crecería sin que nadie se entere.
7. **Perfume sin insumos configurados: NO descuenta y se lista aparte.** Son 200+
   perfumes; obligar a configurarlos antes de vender frenaría el mostrador, y
   usar la esencia genérica descuadraría ese insumo y daría un costo falso. La
   venta se registra normal y el perfume aparece en "pendientes por configurar".

**BLOQUEANTE Nº1 — la venta no guarda la talla POR PRODUCTO.** `venta_perfume` es
solo (venta_id, perfume_id, cantidad); la talla es UN campo de texto libre para
toda la venta (`ventas.presentacion`, ej: "1 de 30 ml y 2 de 60 ml"). Como la
fórmula es la receta de UNA unidad de UNA talla, sin saber qué talla llevó cada
perfume es IMPOSIBLE descontar bien: no se sabe qué receta aplicar. Hay que
sumarle la talla a `venta_perfume` y pasar el formulario de ventas a líneas
(perfume + talla + cantidad), como YA lo hace el de créditos (`LineaCredito`).
Las ventas históricas se quedan sin talla por línea y no mueven inventario — el
consumo arranca desde que se active, nunca hacia atrás.

**LA VENTA PASA A SER UNA LISTA DE ÍTEMS** (decidido con el dueño el 2026-08-01,
él mismo lo propuso). En vez de un solo campo de texto para toda la venta, el
formulario pregunta qué se vendió: producto + talla + cantidad, una línea por
REFERENCIA DISTINTA. Dos Khamrah de 30 ml = una línea con cantidad 2, no dos
registros. Un Khamrah de 30 y otro de 100 = dos líneas.
- **Consecuencia técnica ineludible**: hoy `venta_perfume` tiene PK
  (venta_id, perfume_id), así que el MISMO perfume en dos tallas no cabe. Hay que
  meter la talla en la PK o darle id propio.
- `ventas.presentacion` deja de ser la fuente de verdad y pasa a ser un resumen
  derivado (igual que `referencia_perfume`).
- Las líneas deben admitir productos SIN talla (una gorra no tiene ml).
- Esto elimina la necesidad de "Combo Personalizado", que era el apaño para
  registrar varias tallas en una sola venta.

**Tallas reales (producción, 2026-08-01)** y qué es cada una:
- 30 / 50 / 100 ml → fabricados, ya tienen fórmula.
- **RECETAS CONFIRMADAS POR EL DUEÑO** (el diluyente es SIEMPRE el resto, nunca
  se guarda). Todas llevan esencia al 50% del volumen:

  | Talla | Esencia | Sellador | Feromonas | Diluyente |
  |---|---|---|---|---|
  | 30 ml | 15 | 0,40 | 0,30 | 14,30 |
  | 50 ml | 25 | 0,50 | 0,30 | 24,20 |
  | 75 ml | 37,5 | 0,80 | 0,30 | 36,40 |
  | 100 ml | 50 | 0,80 | 0,30 | 48,90 |
  | 6 ml (lleno) | 3 | 0,20 | 0,15 | 2,65 |

  El 75 ml usa el mismo sellador y feromonas que el 100 ml (no escalados).
  Faltan crear en base las de **75 ml** y **6 ml**; las otras tres ya existen.
- **6 ml** → el perfumero recargable. **SON DOS PRODUCTOS DISTINTOS**: el vacío
  es comprado/reventa (sin fórmula) y el lleno es fabricado (esencia al 50% = 3 ml).
- **200 y 250 ml** → **splash COMPRADOS ya hechos, sin fórmula**. El "200/250ML"
  del catálogo era un apaño para marcarlos como splash: la talla debe ser el
  número real y "splash" va como categoría/tipo, no como talla.
- "Combo Personalizado" NO es una talla: se elimina al pasar a líneas.

**Diluyente ≠ alcohol a secas**: es alcohol de papa con exaltante, ya balanceado.
Por eso el insumo se llama "Diluyente" en todo el módulo y tiene costo propio.
No renombrarlo a "alcohol".

**PASO 2 — BACKEND HECHO (2026-08-01)**: `venta_perfume` tiene id propio, columna
`ml` y UNIQUE(venta, perfume, ml). Las 205 líneas existentes se conservaron.
`createVentaSchema` acepta las DOS formas: `lineas[]` (nueva, con talla) y
`perfume_ids[]` (vieja, sin talla) — `lineasDeVenta()` las normaliza y agrupa por
producto+talla. `ventas.presentacion` dejó de ser obligatorio: se DERIVA de las
líneas si llega vacío (pasó a ser resumen, no fuente de verdad). Probado: una venta
con el mismo perfume en 30ml y 100ml, antes imposible.
Migración: `20260801150000_lineas_de_venta`.
**PASO 9 COMPLETO (2026-08-01) — IMPORT/EXPORT DE TODO**: `import/resto.ts` suma
formulas (import+export), y producciones, cotizaciones, usuarios, blog y avisos.
**Criterio de qué se puede IMPORTAR**: solo configuración y datos que el dueño
tecleó. El HISTÓRICO CONTABLE (producciones, cotizaciones emitidas, movimientos)
se exporta pero se rechaza al importar — reescribirlo rompería la trazabilidad.
El blog tampoco se importa: su HTML se sanea en el servidor y meterlo por Excel se
saltaría ese filtro. Las cotizaciones exportan UNA FILA POR LÍNEA y **nunca**
costos ni márgenes. Verificado: los 24 exportadores responden 200; reimportar
formulas actualizó las 5 recetas; producciones rechaza con su motivo.

**PASO 8 COMPLETO (2026-08-01) — GRÁFICOS**: `GraficoMeses.tsx` (barras apiladas,
SVG/CSS puro, sin dependencias nuevas) en la pestaña Ventas, con endpoint
`GET /ventas/por-mes`. Ganancia + costo de lo vendido apilados (misma escala: NUNCA
dos ejes), leyenda siempre visible, tooltip al pasar el mouse y tabla equivalente
plegable. **La paleta se validó con el script del design system**: el iris de marca
(#524276) FALLA como color de barra (muy oscuro, croma bajo); los que pasan las seis
comprobaciones son #8661cc y #c78200 (ΔE 28 protan, contraste ≥3:1). No cambiarlos
por el color de marca.

**PASO 7 COMPLETO (2026-08-01) — COTIZACIONES CON LA ESENCIA REAL**:
`LineasCotizacion` pasa `perfume.insumo_esencia_precio` como 4º parámetro de
`calcularDesgloseCosto`, así que cada línea se costea con SU fragancia. Verificado:
mismo tamaño, 1 Million (Khamrah 1.800/ml) cuesta 5.488 y 1 Million Lucky
(Mandarin Sky 617/ml) cuesta 1.939 — casi el triple. En 500 unidades son 1,7
millones de diferencia que antes no se veían. Si el perfume no tiene esencia
asignada sale un aviso ámbar en la línea: el costo es aproximado y en mayoreo eso
son cientos de unidades mal costeadas.

**PASO 6 COMPLETO (2026-08-01) — FRASCO Y CAJA POR PERFUME + TALLA**:
`perfume_presentacion` suma `envase_insumo_id` y `accesorios` (JSON de ids). Lo que
se define ahí MANDA sobre el envase/accesorios de la receta del tamaño, que pasan a
ser el valor por defecto. La receta queda como lo que es: las PROPORCIONES.
Verificado: dos perfumes de 100 ml con la misma esencia pero frascos distintos
descontaron cada uno el SUYO (Frasco Sauvage 50→49 y Frasco Bleu 50→49).
En la ficha del perfume: selector "¿Cómo consigues este producto?" (fabricado /
comprado / fraccionado), el insumo que ES el producto, los ml aprovechables del
decant, y un selector de frasco por cada talla marcada.
Migración: `20260801180000_envase_por_perfume_talla`.

**PASO 5 COMPLETO (2026-08-01) — TIPOS DE PRODUCTO**: `perfumes.tipo_producto`
(fabricado | comprado | fraccionado) + `insumo_producto_id` + `ml_utiles`.
`recetaDe` se bifurca: fabricado usa la receta de la talla; **comprado** descuenta
UNA unidad del insumo que ES el producto (y NO exige talla: una gorra no tiene ml);
**fraccionado** descuenta los ml del decant de la botella origen + su envase.
Verificado: venta de 1 gorra + 2 decants de 10 ml → gorra 20→19, botella 95→75,
costo 144.320 (126.320 de líquido + 18.000 de la gorra).
**GOTCHA que costó un ciclo**: `consumirPorVenta` saltaba toda línea sin `ml`, así
que los comprados nunca descontaban. Solo los fabricados y fraccionados necesitan
talla. Migración: `20260801170000_tipos_de_producto`.

**PASO 4 COMPLETO (2026-08-01)**: **crear producto al vuelo desde la venta**. El
buscador del formulario trae "+ Crear producto nuevo" y abre un mini-form con lo
mínimo (nombre + precio); al crearlo se agrega como línea sin salir de la venta.
Mismo patrón que "+ Registrar persona nueva".
**Aroma y ocasión dejaron de ser obligatorios** al crear un producto (Zod y el
service): el catálogo ya no es solo perfumes — una gorra no tiene notas olfativas
— y exigirlos frenaba el mostrador. Verificado: CREATE 201 desde el formulario.

**PASO 3 COMPLETO (2026-08-01) — LA VENTA CONSUME INVENTARIO**: `consumirPorVenta`
descuenta esencia (la DEL PERFUME), diluyente, sellador, feromonas, envase y
accesorios según la receta de la talla × unidades, y congela el costo en
`ventas.costo_mercancia`. `getVentaTotales` expone `costo_mercancia_mes` y
**`ganancia_mes`** = ingresos − devoluciones − costo. Editar o borrar una venta
revierte el consumo (`revertirVenta`). Verificado con números: 3× 30ml descontaron
45 ml de esencia, 42,9 de diluyente, 1,2 de sellador, 0,9 de feromonas y 3 envases;
costo 27.768 (3 × 9.256); ganancia 196.000 − 27.768 = 168.232. Al borrar, todo volvió
exacto. Migración: `20260801160000_consumo_por_venta`.

**PASO 2 COMPLETO (2026-08-01)**: el formulario del dashboard ya es un editor de
LÍNEAS (producto + talla + cantidad). `agregarLinea` suma unidades si el producto
ya está sin talla; `actualizarLinea` FUSIONA dos líneas si al cambiar la talla
quedan idénticas (evita duplicados de la misma referencia). El campo suelto de
"Presentacion" se eliminó: la talla vive en cada línea y `ventas.presentacion` se
deriva. Probado con clics reales: venta con dos productos en 30ml y 100ml → guardó
"1 Million 30ml, 1 Million Lucky 100ml" con sus dos líneas correctas.

**PASO 1 — HECHO (2026-08-01)**: `presentaciones.ml` (número) + `formula_volumen_id`.
La talla dejó de ser texto: el número sale del propio nombre con REGEXP, y el enlace
catálogo↔receta se hace POR NÚMERO. Probado con "30ml", "50 ml" y "100 ml" (tres
escrituras distintas) → las tres enlazan bien. Las que NO son talla ("200/250ML",
"Combo Personalizado") quedan con ml NULL a propósito y no se costean. Creadas las
recetas de 75 ml y 6 ml, y corregidas las feromonas del 100 ml (0.40 → 0.30).
Migración: `20260801140000_tallas_en_ml`.

~~BLOQUEANTE Nº2~~: unificar las tallas. Hoy hay TRES listas que no
coinciden — `presentaciones` (30ml, 50 ml, 100 ml), `formulas_volumen` (30 ml,
50 ml, 100 ml) y el texto libre de `ventas.presentacion` (30 ML, 100 ML, 80 ML,
"6 ML - Perfumero Rec", 60ML). Falta que el dueño dé la lista definitiva y la
escritura canónica. Sin eso, el enlace frasco↔talla busca el insumo equivocado.

Orden acordado: (0) unificar tallas → (1) consumo por venta + ganancia real →
(2) crear producto al vuelo desde la venta → (3) tipos de producto →
(4) cotizaciones B2B con la esencia del perfume → (5) gráficos →
(6) import/export de lo que falta.

### Cotizaciones mayoristas B2B (módulo interno, 100% solo admin)
- Sirve para cotizarle a quien quiere **revender** los perfumes. Vive en el dashboard,
  sección **Mayoreo B2B** (4 pestañas: Cotizaciones, Insumos y precios, Tamaños y fórmulas,
  **Costos de producción**).
- **DOS TIPOS de cotización** (`cotizaciones.tipo`):
  - `detallada`: los productos concretos que se lleva el cliente (con total).
  - `general`: **lista de precios por cantidad, SIN decir qué fragancias** — para que el
    cliente vea cuánto le sale según el volumen y arme su pedido. No tiene total; la lista
    se congela en `cotizaciones.lista_precios` (JSON) al guardar, así no cambia si mañana
    se ajustan los precios. El PDF y el mensaje de WhatsApp cambian según el tipo.
- **NADA de costos va quemado en código**: el admin teclea sus insumos (`insumos_costo`:
  materia_prima/envase/accesorio, con precio por `ml` o por `unidad`) y sus tamaños
  (`formulas_volumen`: ml_total + esencia/sellador/feromonas + envase). El **diluyente NUNCA
  se guarda**: es siempre `ml_total − esencia − sellador − feromonas` (así no se desincroniza
  si se edita el volumen). Zod rechaza fórmulas cuya suma supere el total.
- **Cada tamaño elige SU esencia** (`formulas_volumen.esencia_insumo_id`): hay varias
  cargadas (normal, premium…) y adivinar por nombre daba costos equivocados. El motor usa
  `formula.esencia_precio`; solo si no hay ninguna asignada cae al matcher por nombre.
- **Si falta un insumo, se avisa**: una materia prima no registrada cuenta $0 y la ganancia
  saldría inflada; la pestaña de tamaños lo advierte en amarillo. Igual, **sin precio de
  venta NO se muestra "utilidad negativa"** (comparar costo contra cero no significa nada):
  se dice "falta ponerle precio". Un número alarmante sin explicación solo confunde.
- **Costo de producción por presentación** (pestaña propia `CostosProduccionTab.tsx` +
  `cotizacion/CostoDeProduccion.tsx`): cada tamaño muestra "producir uno te cuesta $X" con el
  desglose insumo por insumo y **la ganancia de cada rango de precio** (utilidad y margen %).
  Sale del mismo motor puro, así que al subir el precio de una materia prima TODO se
  recalcula solo. Es la entrada natural del futuro módulo de inventario: ahí ya está el costo
  unitario por presentación.
- **Accesorios: NADA estático** (el dueño lo pidió explícito — "que tal que mañana no sea el
  perfumero sino una tarjeta personalizada"). Son `insumos_costo` de tipo `accesorio` y su
  columna `alcance` decide dónde pesan:
  - `unidad` (perfumero recargable, bolsa de organza, tarjeta): cuesta por CADA perfume.
    Cada tamaño guarda los suyos por defecto en `formula_accesorios` (tabla puente,
    `PATCH /costeo/formulas/:id/accesorios`); al agregar una línea a la cotización vienen ya
    marcados y se pueden ajustar para ese cliente. La marca es **optimista** (el costo y los
    márgenes cambian al instante) y se revierte sola con un toast si el guardado falla.
  - `pedido` (caja de envío, un obsequio único): se cobra UNA vez por cotización completa.
    Vive en `cotizaciones.extras_pedido` (JSON) y NO entra en el costo unitario — meterlo ahí
    distorsionaría el costo por perfume.
  - La impresora y demás equipo NO se costean aquí: amortizar activos fijos en el costo
    unitario da un número que no sirve para fijar precios.
- **El cliente sí ve lo que incluye**: el PDF lista los accesorios bajo cada producto y
  además cierra con un bloque **"Tu pedido incluye"** (unión de accesorios por línea +
  extras del pedido). Solo nombres, nunca precios de costo.
- **Motor de costeo desacoplado**: `frontend/src/application/costeoCotizacion.ts`, funciones
  PURAS (`calcularDesgloseCosto`, `sugerirPrecio`, `rentabilidadLinea/Total`). No hacen fetch
  ni tocan estado → el día que exista inventario solo hay que alimentarlas desde ahí. Las
  materias primas se ubican por NOMBRE normalizado (contiene "esencia"/"diluyente"/
  "sellador"/"feromonas"); si falta una, cuenta 0 y no revienta.
- **Escalas de precio** (`escalas_precio`, por tamaño): el rango se evalúa **por línea**
  (cada producto según SU cantidad), no por el total de la cotización. `cantidad_max` null
  = "100+". Ante rangos solapados gana el de mínimo más alto. Se pueden **editar** (lápiz,
  `PATCH /costeo/escalas/:id`), no solo borrar y recrear.
- **El editor de rangos se redacta como una FRASE** ("Si el cliente lleva desde [10] u hasta
  [19] u, le cobras $[19000] por cada uno"), con vista previa en palabras y una alerta si
  el "desde" es ≥ 1000 (suele ser el precio tecleado en la casilla de cantidad). Nació de un
  caso real: tres casillas numéricas con etiquetas escuetas y el dueño metió el precio donde
  iba la cantidad. **Un formulario de números sin contexto se malinterpreta**: etiquetar con
  unidades ("u", "$") y confirmar en lenguaje natural evita datos basura.
- **Las cifras se congelan** en la cotización (`cotizacion_items.desglose_costo` y
  `accesorios_seleccionados` en JSON): si mañana sube la esencia, una cotización vieja NO
  cambia su rentabilidad histórica. Mismo criterio que la deuda de un crédito. El frontend
  calcula y manda; el backend valida con Zod y guarda tal cual (nunca recalcula la fórmula).
- **REGLA DE ORO**: el desglose de costo, la utilidad y el margen son SOLO del admin.
  `utils/cotizacionPdf.ts` jamás los imprime — el cliente ve producto, cantidad, precio
  unitario, subtotal, descuento y total. Verificado en pruebas: ninguna cifra de costo
  aparece en el PDF.
- PDF con jsPDF crudo (sin dependencias nuevas), calcado de `catalogoPdf.ts`: marfil+iris,
  marca de agua, encabezado con número (`COT-AAAA-0001`, consecutivo por año) y vigencia,
  cliente, tabla, resumen, bloque "¿Por qué elegir…", condiciones comerciales y avisos
  legales en letra pequeña. En los avisos, `{{vigencia}}` se reemplaza por los días reales.
  Ojo: usa Helvetica (fuente nativa); el "menos" tipográfico `−` (U+2212) NO existe ahí y
  descuadra el texto — usar guion normal.
- Textos configurables en `cotizacion_config` (fila única, patrón `SobreNosotrosConfig`):
  condiciones comerciales, beneficios y avisos legales. Se siembran con los textos que
  escribió el dueño y son editables. `plantillas_cotizacion` existe en el modelo para la
  Fase 2 (plantillas Mayorista/Distribuidor con descuento y condiciones propias).
- Los datos del cliente van en **texto libre** en `cotizaciones`: un prospecto mayorista no
  es un `User` del sitio ni una `Empresa` (que en este proyecto son PROVEEDORES).
- Gotcha: `GET /api/parfums` sin paginar responde `{ data: { data: [...] } }` (anidado);
  con `?page=` responde `{ data: [...], total }` y **limit tope 100**. Para listas completas
  (ej. el selector de productos) usar el no paginado y desenvolver ambas formas.

### Motor de cupo (`creditoPerfil.service.ts`, solo admin)
- Recalcula SIEMPRE desde el historial (no se guarda). Factor sobre `users.cupo_base`,
  acotado 0.5–2.0. Pago rápido (≥300k en 14 días) ×1.1; pago lento (>30 días sin abonar
  con saldo) ×0.9; veto a los 60 días sin mover.
- **Cupón vencido**: un crédito que usó cupón y sigue con saldo pasada su `fecha_limite`
  castiga el DOBLE (×0.8, evento `cupon_vencido`) y reemplaza al pago lento en ESE crédito
  (no se suman). Es "el factor tiempo en contra": descuento + plazo incumplido no salen gratis.

### Tarjeta de recompensas (fidelidad, tipo "junta 5 sellos")
- **Los sellos NO se guardan**: se recalculan del historial (como el motor de cupo).
  Un sello = una venta con `user_id`, `pagada=true` y `valor_venta ≥ min_compra`. Editar o
  borrar ventas ajusta los sellos solos. Solo se guarda `sellos_consumidos` (por premios
  entregados) en `recompensa_usuario`.
- Config GLOBAL en `recompensa_config` (fila única, tipo ContactoConfig): `sellos_objetivo`,
  `premio`, `min_compra`, `activo`. Cada cliente puede tener **override** propio
  (`objetivo_override`, `premio_override`, `min_compra_override`; null = usa la global).
- Al llenar la tarjeta el admin "entrega premio" (`sellos_consumidos += objetivo`,
  `premios_entregados++`) y la tarjeta se **reinicia** (programa repetible). El backend
  recalcula, nunca confía en el cliente. Lógica en `recompensa.repository.ts`.
- **Colores configurables** en `recompensa_config` (`color_fondo`, `color_lineas`,
  `color_texto`); son GLOBALES (no por cliente) y viajan en `calcularTarjeta().colores`.
- Portal: `/mis-recompensas` (enlace en el menú solo para logueados). La tarjeta es GRANDE
  (`max-w-2xl`, ~mitad de pantalla en escritorio) y escala su contenido con `cqw`+`em`.
- Admin: pestaña Recompensas = **tabla** (SmartTable) de clientes con progreso + botón
  "Configurar tarjeta" en el header que abre un **modal con previsualización en vivo**
  (`RecompensaConfigModal.tsx`) y selectores de color. `ColorField` vive en `dashboard/ui.tsx`
  (reusado por RedesTab). Entregar premio y regla especial (override) por cliente.
- **Tarjeta 3D**: CSS puro (`TarjetaRecompensas3D.tsx`) para TODOS — se inclina, voltea y
  brilla con transform 3D, escala con `cqw`+`em` (contenedor con `container-type: inline-size`),
  acepta `colores`. Estética negro+dorado de la tarjeta física. (Se probó una capa premium
  con Three.js pero se descartó: pesaba mucho para el público de gama baja y el render no
  igualaba los trazos de la CSS. NO reintroducir Three.js sin buena razón.)

### Reseñas de productos (compra verificada + moderación)
- Solo puede reseñar quien **compró ese perfume** en una venta con `user_id` y `pagada=true`
  (`resena.repository.ts` → `haComprado`). El portal `/mis-compras` lista los productos que
  la persona compró (`productosComprados`) y por cada uno un formulario (estrellas 1-5,
  comentario, **máx 3 fotos**). Enlace "Mis compras" en el menú del logueado.
- **Moderación primero**: la reseña nace `pendiente` y NO se ve en público hasta que el
  admin la aprueba (pestaña **Reseñas** del dashboard → `ResenasTab.tsx`, filtro por estado,
  aprobar/rechazar/eliminar). Enum `ContenidoEstado` (pendiente/aprobada/rechazada).
- **Promedio de estrellas**: NO se guarda, se recalcula con `groupBy` (`resumenRatings`).
  `mapPerfume` expone `rating_promedio` + `rating_total`; el helper `conRatings()` los inyecta
  en TODOS los endpoints de catálogo (una sola query por llamada cacheada). Se muestran en
  las cards (`PerfumeCard` → `Estrellas.tsx`) y en el detalle (con la lista de reseñas,
  `ResenasProducto.tsx`). `@@unique([user_id, perfume_id])`: una reseña por persona y producto
  (el POST hace upsert). Router `/api/resenas`.

### Galería de ganadores (publicidad social gratis)
- Al **entregar un premio** de fidelidad, `entregarPremio` crea (en `$transaction`) un registro
  `RecompensaEntrega` (estado `pendiente`, premio congelado). Sobre él se suben las FOTOS de la
  entrega: el propio cliente desde `/mis-recompensas` (`SubirFotosEntrega.tsx`, máx 3) o el admin
  desde la pestaña Recompensas (`EntregasModeracion.tsx`, también modera).
- **Moderación primero** igual que reseñas: si el cliente sube fotos vuelve a `pendiente`. La
  **galería pública** (`GaleriaGanadores.tsx`, endpoint `/api/recompensas/ganadores`, cacheado)
  muestra solo entregas `aprobada` con foto; sale en la Home (bajo destacados) y en el portal.

### Imágenes → WebP (servidor liviano)
- Dependencia **`sharp`** (`utils/imagenWebp.ts`): `guardarWebp` redimensiona (máx 1400px, `fit:
  inside`) y comprime a WebP calidad 78. Reseñas y fotos de premio lo usan vía `uploadMemoria`
  (multer memoryStorage, 10MB, solo imágenes). En el deploy del frontend NO cambia nada; en el
  **backend hay que correr `npm install`** (nueva dependencia `sharp`).

### Unidades por perfume en una venta
- `venta_perfume.cantidad` guarda cuántas unidades de ESA fragancia lleva la venta: un
  combo de 3 puede ser 2× Eros + 1× Sauvage. Antes la PK (venta_id, perfume_id) solo
  admitía el mismo perfume UNA vez y el repetido se perdía.
- En el formulario de ventas se elige el mismo perfume varias veces y el chip muestra
  `2× Nombre`; la "Cantidad" de la venta se sincroniza sola (sigue editable a mano).
- `agruparEnlaces(ids)` (perfumeMatcher) convierte una lista con repetidos en
  `{perfume_id, cantidad}`: úsala SIEMPRE antes de `perfumes: { create: ... }`.
- "Los más vendidos" reparte `cantidad_perfumes` de la venta proporcional a esas
  cantidades (los enlaces viejos, todos en 1, reparten en partes iguales como antes).
- La referencia visible se escribe con el mismo formato (`2× Eros, Sauvage`).

### Matcher de perfumes (`backend/src/utils/perfumeMatcher.ts`)
- Conservador: solo enlaza con candidato ÚNICO; ambigüedad = sin enlazar (fallo barato).
- Alias (`one`→`1`, `aqua`→`acqua`) y tolerancia a typos de 1 letra SOLO en palabras de 5+.
- Con separadores (,;+/" y ") se enlaza cada parte; el texto completo es plan B.
- `matchPerfumes` devuelve ids REPETIDOS a propósito ("Eros, Eros" = 2 unidades); no
  deduplicar: quien consume usa `agruparEnlaces`.
- Tests de casos reales: "One Million" solo enlaza si existe ese nombre exacto en el
  catálogo; si solo hay variantes (Elixir, Parfum) debe dar vacío, nunca elegir una.

### Subir fotos desde el navegador (bug ya corregido — no reintroducirlo)
- `e.target.files` es un **FileList VIVO** del input. El patrón
  `setFotos(f => [...f, ...Array.from(files)]); input.value = ''` **pierde las fotos**: el
  updater de React se ejecuta después, y para entonces limpiar el input ya vació la lista.
  Hay que **copiar el array ANTES** de llamar a `setState`. Estaba en los 3 subidores
  (reseñas, fotos de premio y devoluciones); síntoma: se elige la foto, a veces se ve la
  miniatura, pero el POST viaja sin el campo `imagenes`.

### Selects con valores libres (bug ya corregido — no reintroducirlo)
- `ventas.presentacion` es TEXTO LIBRE (los Excel reales traen "30 ML" con espacio, "80 ML",
  "6 ML - Perfumero Rec", "1 de 30 ml y 2 de 60 ml"). Estaba pintado con un `<select>` de
  lista quemada: cuando el valor guardado no está entre las opciones, **el navegador muestra
  la PRIMERA y al guardar pisa el dato original en silencio** — así se dañaron muchos
  registros. Ahora es `<input list=…>` con `<datalist>`: sugiere sin encerrar.
  **Regla: un `<select>` solo sirve si el dato guardado SIEMPRE está entre sus opciones.**

### Fechas (bug ya corregido — no reintroducirlo)
- **Inicio de mes en las estadísticas**: las columnas `@db.Date` se leen como medianoche
  **UTC**. Armar el corte con `setHours(0,0,0,0)` da medianoche LOCAL (05:00 UTC en
  Colombia) y **todo lo del día 1 queda fuera del mes** (ventas, abonos y devoluciones).
  En `getVentaTotales` se construye con `new Date(Date.UTC(a, m, 1))`.
- Las fechas "de calendario" (`ventas.dia`, `creditos.fecha`, `pagos.dia`, `anuncios.inicio/fin`)
  son `@db.Date`: el backend las manda como AAAA-MM-DD. Formatearlas con `new Date(s)`
  las lee como medianoche UTC y en Colombia (UTC-5) mostraba **el día anterior**
  (una venta del 22 salía como 21). Usar `fmtDate` de `dashboard/helpers.ts`, que parte
  la cadena; para marcas de tiempo reales (`created_at`) usar `fmtInstante`.

### Importadores/exportadores
- Son genéricos por entidad: basta agregar la entidad a `IMPORT_SPECS` (columnas + notas)
  y sus ramas en `exportEntity`/`importEntity`. El router, la plantilla, el modal y el
  botón Exportar del frontend ya funcionan solos (`<ExportButton entity="..." />`).
- **24 entidades** con export (y con import las que son configuración): perfumes, precios,
  aromas, ocasiones, categorias, presentaciones, combos, descuentos, publicidad, ventas,
  creditos, proveedores, insumos, inventario, movimientos, devoluciones, resenas, entregas,
  formulas, producciones, cotizaciones, usuarios, blog y avisos (la lista categoría×presentación;
  importar ACTUALIZA la combinación existente, sirve para subir precios en bloque).
- La plantilla de perfumes lleva `precios_presentacion` (`30ML=60000, 100ML=150000`, solo
  excepciones) y `esencia_premium` (si/no).
- Publicidad: exporta/importa las CAMPAÑAS, nunca los códigos ya emitidos (son de cada
  persona). Importar siempre CREA (no actualiza): subir dos veces el archivo duplica.
  En anuncios que no son de tipo `descuento` las columnas de cupón se guardan en cero
  (un mensaje no puede colar un descuento).
- **El servicio está partido por dominio** (era un archivo de ~830 líneas):
  `services/import.service.ts` es solo el REPARTIDOR (~78 líneas) y los dominios viven en
  `services/import/`: `core.ts` (helpers, plantillas, `sheetFromRows`, `entityRows`),
  `lookups.ts` (aromas/ocasiones/categorías/presentaciones), `catalogo.ts` (perfumes,
  precios, combos, descuentos), `ventas.ts` (publicidad, ventas, créditos, proveedores),
  `inventario.ts` (insumos, conteo, movimientos, devoluciones) y `legacy.ts` (el importador
  histórico de un Excel con varias hojas). Para una entidad nueva: spec en `IMPORT_SPECS` +
  rama en el módulo de su dominio. Ninguno pasa de 290 líneas. `inventario` es la **hoja de conteo físico**: se exporta con lo que
  el sistema cree que hay, se escribe lo real en `cantidad_real` y al subirla cada fila pasa
  por `ajustarStock` (queda su movimiento auditable). Es la forma cómoda de sembrar el stock
  inicial. `movimientos` es **solo exportación**: importarlo descuadraría el stock, que es una
  proyección de ese libro.
- **Contenido de clientes (reseñas, fotos de premios): se EXPORTA todo, se IMPORTA solo la
  moderación** (`import/contenido.ts`). El importador exige el `id` de un registro existente
  y solo cambia `estado`; una fila sin id se rechaza con el motivo. Razón: una reseña solo
  existe si esa persona COMPRÓ el perfume, y un importador que las cree se salta esa barrera
  — sería publicidad engañosa (Ley 1480, sancionable por la SIC) y además las estrellas
  dejarían de decirle al dueño qué fragancia gustó de verdad. El **exportador sí hace falta**:
  es el respaldo del contenido y la forma de responder un derecho de acceso a datos
  (Ley 1581). Verificado: aprobar en lote funciona; crear una reseña desde archivo se rechaza.
- **Redes sociales va en JSON, no Excel** (`/api/contacto/export` e `/import`): su estructura
  (config + links con overrides de estilo) es irregular y en una hoja quedaría ilegible. El
  resto del sistema sí es parametrizado y va en Excel.
- `bustImportCache()` limpia `parfums:` y `anuncios:`.

### Otros
- Imagen de fondo de la página Contáctame: se sube con `POST /api/contacto/fondo`
  (igual que el avatar); deja `fondo_tipo='imagen'` y borra del disco la imagen anterior.
  `saveConfig` también borra el fondo viejo si cambió.
- "NUEVO" en cards: automático, por antigüedad del registro (`NUEVO_DIAS` en
  perfume.repository, hoy 7 días). El mismo valor decide qué sale en "Nuevos" del home.
- Al borrar/reemplazar imagen de perfume/combo/anuncio se borra el archivo físico de
  uploads (`utils/imagenes.ts`) — servidor pequeño, cero huérfanos.
- **BUG GRAVE ya corregido (2026-08-01): el respaldo bajaba VACÍO — DOS causas.**
  **Causa raíz**: se escuchaba `req.on('close')` para matar mysqldump si el cliente
  cancelaba, pero la PETICIÓN emite 'close' en cuanto termina de leerse su cuerpo (a los
  milisegundos). Se mataba el dump antes de que escribiera nada → salía por señal (código
  `null` en los logs de pm2, señal delatora) y el gzip se cerraba vacío. Ahora se escucha
  `res.on('close')` y solo se mata si `!res.writableEnded` (el cliente se fue de verdad).
  **Diagnóstico**: si `mysqldump` a mano funciona y el botón no, mirar el CÓDIGO en los
  logs — `null` = lo mataron, no falló.
  **Segunda causa (defensa en profundidad)**: la respuesta
  empezaba a enviarse en el evento `spawn`, antes de saber si mysqldump iba a
  funcionar. Cuando fallaba (binario ausente, credenciales malas), no escribía
  nada pero el gzip se cerraba solo y el navegador recibía un `.gz` **válido y
  vacío de 20 bytes** — se ve como un respaldo y no tiene ni una tabla. Ahora
  **no se manda un solo byte hasta que mysqldump escupa el primero**, y si no
  produce datos responde 500 con el stderr real. Un respaldo que miente es peor
  que no tener respaldo. **Verificar en producción que el archivo pese MB, no
  bytes**, y que `MYSQLDUMP_PATH` apunte al de `mariadb-client`.
- Respaldo de BD: botón "Respaldo" en el header del dashboard. Doble candado: admin + TOTP
  (RFC 6238 casero en `utils/totp.ts`, secreto en `backend/backups/totp.json`, fuera de
  git). Resetear TOTP = borrar ese archivo por SSH (a propósito: la web no puede).
  Recordatorio con punto rojo a los 7 días sin copia. mysqldump vía `MYSQLDUMP_PATH` o PATH.
- Catálogo PDF (`utils/catalogoPdf.ts`, jsPDF lazy-loaded): botón "Descargar catálogo PDF"
  **solo admin**, en el dashboard → pestaña Perfumes (toolbar, `DescargarCatalogoButton`).
  Antes era beneficio público para registrados; se movió a herramienta interna del admin.
  Marca de agua, notas con colores. SEO: slugs generados de nombre (`toSlug`), no hay
  columna slug — se compara contra slug generado.
- Reseñas públicas (`components/resenas/`): sección "Opiniones del producto" con resumen +
  distribución por estrellas + modal (`ResenasModal`) que filtra por estrellas y visor de
  fotos tipo carrusel (`VisorImagenes`, montado sobre el `Dialog` de shadcn para que el
  clic afuera cierre solo el visor y no el modal; flechas AFUERA de la imagen estilo ML).
- **Footer** (`components/Footer.tsx`, en `App.tsx`, oculto en dashboard/contactame) con
  navegación, enlaces legales y CTA de WhatsApp. **Página legal** (`/legal`, `LegalPage.tsx`,
  lazy): 3 secciones con ancla (`#terminos`, `#datos`, `#marcas`). El aviso de **marcas e
  imágenes** es clave: las fotos de producto son REFERENCIALES (sacadas de otras webs), las
  marcas son de sus titulares, muchos productos son contratipos, y el negocio no está
  afiliado. Datos de datos personales: Ley 1581/2012, contacto por WhatsApp (NO se inventó
  NIT/dirección/razón social: agregar solo si el dueño los tiene). `/legal` va en el sitemap.
- **Devoluciones (`/legal#devoluciones`)** — investigado, NO improvisar:
  - **Garantía legal** (Ley 1480/2011, arts. 7-8-11): cubre producto equivocado,
    dañado/derramado/incompleto, envase o atomizador defectuoso, no entregado. Solución:
    reposición o devolución del dinero. **Los costos de transporte de la garantía los asume el
    vendedor** (art. 11). Plazo legal máximo para hacerla efectiva: 30 días hábiles
    (Decreto 735/2013).
  - **Término anunciado: 90 días** (`GARANTIA` en `config/negocio.ts`, editar ahí). El art. 8
    deja que el vendedor ANUNCIE el término y solo a falta de anuncio son 12 meses. Se eligió
    90 porque es **el mismo piso que la ley fija para productos usados** — número defendible,
    no inventado. Bajarlo a ~30 días se acerca a "limitar la responsabilidad legal", que el
    **art. 43 numerales 1 y 2 declara ineficaz de pleno derecho**; el ahorro no compensa el
    riesgo. `avisoEntregaDias` (5 hábiles) es OTRO plazo: avisar que el pedido llegó mal para
    poder reclamarle a la transportadora — NO recorta la garantía por defecto de fábrica.
  - **El retracto (art. 47) NO aplica a perfumes**: el numeral 7 exceptúa los "bienes de uso
    personal" y la SIC clasificó ahí los cosméticos (concepto rad. 12-27958). Por eso la página
    dice que no se aceptan devoluciones por cambio de opinión — y aclara que eso **no toca la
    garantía legal** (que es irrenunciable). No suavizar esto sin hablarlo con el dueño: es la
    diferencia entre una política defendible y una promesa que cuesta plata.
  - Se menciona la reversión del pago (art. 51) y la SIC como autoridad.
- **Seguridad (auditoría 2026-07-25)**: `utils/uploadsUrl.ts` → `sanearUploadsConservados`
  filtra las URLs `conservar[]` de reseñas/premios para aceptar SOLO archivos de nuestro
  `/uploads` (evita inyectar URLs externas y host-poisoning; reconstruye con la baseUrl). Los
  endpoints de moderación validan `estado` (400 si es inválido). En producción, si falta
  `BACKEND_URL`, el arranque avisa (las URLs de /uploads no deben depender del header Host).
- **Los errores internos NUNCA salen al navegador** (`utils/errorSeguro.ts`): un error de
  Prisma trae la ruta del archivo, el fragmento de código y el host de la base. Con MySQL
  apagado, el login mostraba en pantalla `auth.repository.ts:8:15` y `localhost:3306`.
  `mensajeSeguro(err)` distingue el mensaje de negocio (escrito por nosotros, se muestra tal
  cual) del interno (Prisma, `E*` de red → se registra en el log y afuera va un texto
  genérico). Lo usan `error.middleware.ts` y los 7 controladores con try/catch propio.
  **Regla: jamás `res.json({ error: err.message })` directo.**
- **Anti-abuso / costos (capas)**: (1) `express-rate-limit` global 300/15min + auth 10/15min;
  (2) `express-slow-down` (`speedLimiter` en app.ts) ralentiza progresivamente tras 150
  peticiones/15min; (3) `uploadLimiter` (`middleware/limiters.ts`, 25/15min) en las subidas
  de fotos (reseñas/premios) que consumen `sharp`/CPU. OJO: el rate limiting de la app NO
  frena un DDoS real (el tráfico ya llegó); la defensa de verdad es **Cloudflare** delante
  del dominio (cachea imágenes, absorbe floods, oculta la IP) + `limit_req`/`fail2ban` en
  nginx. Con Cloudflare, nginx DEBE usar `CF-Connecting-IP` como IP real o el limiter
  agrupa a todos en un solo cubo. Deploy: el **backend suma `express-slow-down`** → `npm install`.
- **Rendimiento**: el spinner (`PerfumeSpinner.css`) anima con `transform`/`opacity`
  (compositado en GPU), no `clip-path`/`filter`. Ver sección Rendimiento para el resto.
- **Ordenamiento del catálogo** (`/perfumes`): `?sort=` → `destacados` (nuevos primero,
  default), `precio_asc`, `precio_desc`, `nombre`. Ojo: el precio efectivo sale de la
  cascada, no de una columna; se ordena por `perfumes.precio` (respaldo), aceptable porque
  casi todo cuesta lo mismo. Mapeo en `perfume.repository.ts` (`ORDEN_CATALOGO`).
- **Favoritos** (`favoritos`): corazón en cards y detalle (solo logueados). Contexto
  `ListasProvider`/`useListas` (carga ids una vez, toggle optimista). Página `/mis-favoritos`.
  Endpoints `/api/favoritos` (ids), `/detalle` (perfumes), `POST /:id` (toggle).
- **Avísame cuando vuelva** (`avisos_stock`): en el detalle de un perfume AGOTADO el cliente
  logueado pide aviso. NO hay correos automáticos: el admin ve la demanda con el contacto
  (pestaña **Reposiciones**, `AvisosTab`, botón WhatsApp por persona + "marcar avisados").
  Endpoints `/api/avisos`. `useListas` también trae los ids de avisos.
- **Sobre nosotros** (`sobre_nosotros_config`, fila única): página pública `/nosotros`
  configurable desde el dashboard (pestaña **Sobre nosotros**, `SobreNosotrosTab`: título,
  historia, imagen, activo). Endpoint público `/api/nosotros` (solo si `activo`).
- **Blog** (`posts`): público `/blog` + `/blog/:slug`; admin en pestaña **Blog** (`BlogTab`)
  con editor de texto propio (`EditorHtml.tsx`, contentEditable + toolbar, sin dependencia
  pesada). El HTML **SIEMPRE se sanea en el backend** con `sanitize-html` (`blog.repository.ts`
  → `sanearHtml`): solo etiquetas de formato seguras, sin scripts/estilos/on*. Nunca se
  confía en el cliente. Estilos del contenido: `.blog-contenido` en `index.css`. Deploy:
  el **backend suma `sanitize-html`** → `npm install` antes del build.
- **Referidos** (`users.codigo_referido` + `referido_por`, self-relation): portal `/invita`
  (link + amigos invitados y si compraron), registro con `?ref=CODIGO` (`RegisterPage` →
  `vincularReferido`). **Anti-trampa ("gente viva")**: `referido_por` es INMUTABLE y solo se
  fija AL REGISTRARSE → dos amigos con cuenta ya creada nunca pueden referirse entre sí (el
  recíproco es imposible); no se permite auto-referido (mismo id/correo); y el PREMIO NO es
  automático ni al registrarse: se gana solo cuando el amigo hace su **primera compra
  pagada** (venta real que el admin procesa) → crear cuentas falsas no da nada gratis. El
  admin premia manualmente viendo la lista (sin recompensa automática = sin exploit).

## Rendimiento (servidor económico: ahorrar llamadas y recursos)

- Frontend: `infrastructure/api/cachedFetch.ts` — caché en memoria 4 min + deduplicación
  de peticiones simultáneas. Ya lo usan lookups, combos, destacados y anuncios públicos.
  NO cachear: búsquedas/filtros, portal del usuario, dashboard admin.
- Backend: caché en memoria (`utils/cache.ts`) para catálogo y anuncios públicos;
  compression activo; imágenes con caché 30d immutable.
- Al agregar features: preguntar siempre "¿esto puede servirse del caché o generar en el
  navegador?" antes de crear endpoints nuevos.
- **Bundle**: code-splitting por página (React.lazy en `AppRouter`). Lo pesado ya es lazy:
  catálogo PDF (jsPDF+html2canvas ~600 kB) solo al generarlo, Dashboard (~180 kB) solo admin.
  Bundle principal ~76 kB gzip. Imágenes con `loading="lazy"` + `decoding="async"`; la foto
  del detalle además `fetchPriority="high"` (LCP). Preconnect a `fimgs.net` en `index.html`.
- **Medición (2026-07-25)**: en producción el catálogo re-maqueta al redimensionar en
  ~0.7 ms y 0 long-tasks; la sensación de "pesado al redimensionar" es SOLO el dev server
  (Vite sin minificar + React dev con doble render). No perseguir ese fantasma en dev.

## Gotchas (dolores ya vividos — no repetirlos)

- **Encoding**: TODOS los .ts/.tsx son UTF-8 **sin BOM**. JAMÁS usar `Get-Content`/
  `Set-Content` de PowerShell sin encoding explícito sobre código fuente (corrompió todo el
  proyecto una vez: "Colección"→"ColecciÃ³n"). Para ediciones masivas usar
  `[System.IO.File]::ReadAllText/WriteAllText` con UTF8 sin BOM.
- **Clases Tailwind que "no aplican" en el navegador del dueño**: usar clases estándar; para
  restricciones críticas (max-height de dropdowns, paddings de íconos) preferir estilo
  inline. Pedirle Ctrl+Shift+R antes de perseguir fantasmas.
- **Prisma en producción**: histórico de `db push` — si `prisma migrate deploy` falla por
  historial, aplicar el SQL de la migración directo con mysql. Migraciones manuales viven
  en `backend/prisma/migrations/`.
- **nginx**: config en `/etc/nginx/sites-available/celestialparfums.com` (3 bloques; el
  principal es el server de 443 sin www). Ya tiene `client_max_body_size 10m` (sin eso los
  uploads >1MB devolvían HTML 413 y el frontend explotaba parseando JSON) y CSP para
  imágenes. El backend fuerza `charset=utf-8` en JSON (app.ts).
- **Cloudflare (2026-07-26)**: el dominio vive detrás de Cloudflare (proxied, DNS gestionado
  ahí — el registrador Namecheap solo apunta los nameservers). SSL/TLS en modo **Full
  (strict)**, Always Use HTTPS y Bot Fight Mode activos. `nginx.conf` (bloque `http {}`,
  ANTES de los `server {}`) tiene `real_ip_header CF-Connecting-IP` + `set_real_ip_from`
  con los rangos de Cloudflare (IPv4 e IPv6) — sin esto, todo el tráfico se ve como si
  viniera de la IP de Cloudflare y el rate limiting agrupa a todos los visitantes en un
  solo cubo. `limit_req_zone`/`limit_conn_zone` (10r/s, zona `api`) definidos ahí mismo;
  se aplican con `limit_req`/`limit_conn` dentro de `location /api/` del sitio. Si
  Cloudflare rota sus rangos de IP, hay que actualizar `set_real_ip_from` (lista oficial:
  cloudflare.com/ips-v4 y /ips-v6). Pendiente opcional: firewall del VPS restringido a
  solo IPs de Cloudflare en 80/443 (mayor protección, no aplicado aún).
- **Anti-abuso en la app** (`backend/src/app.ts` + `middleware/limiters.ts`). Regla de oro:
  **los límites son para VISITANTES ANÓNIMOS, nunca para el admin.**
  - `globalLimiter`: corte duro por IP — 300/15min anónimo, 1200 con sesión, y **el ADMIN
    queda EXENTO** (`skip: esAdminRequest`). Así una importación masiva, un respaldo o una
    jornada larga en el dashboard jamás lo dejan fuera de su propia tienda.
  - `speedLimiter` (`express-slow-down`): solo anónimos en producción, tras 600 peticiones,
    máx 2s de retraso.
  - `authLimiter` (10/15min en login/registro) y `uploadLimiter` (25/15min en subidas con
    `sharp`) siguen aplicando a todos: son la puerta de entrada y el gasto de CPU.
  - **`cookieParser()` va ANTES de los limitadores** en `app.ts`; si se mueve después, no se
    puede leer la sesión y el admin volvería a contar como anónimo.
  Deploy: el backend suma `express-slow-down` → `npm install`.
- **GOTCHA ya sufrido (2026-07-28): un limitador mal calibrado se siente como "la web está
  lentísima"**. La primera versión del `speedLimiter` (150 peticiones/15min, hasta 5s de
  retraso) castigaba al propio dueño: una sesión de dashboard hace decenas de llamadas y
  todas salían de la misma IP → cada respuesta tardaba **5 segundos exactos**. Síntoma
  delator: TODOS los endpoints tardan lo mismo y ese tiempo es justo el `maxDelayMs`;
  confirmarlo mirando el header `RateLimit-Remaining`. Por eso ahora el slow-down **NO
  aplica en desarrollo ni a usuarios con sesión** (`skip`), y quien tiene sesión tiene un
  techo mucho más alto. Al tocar límites, pensar SIEMPRE en el admin trabajando, no solo
  en el bot. **Y toda vista que cargue datos debe usar try/catch/finally**: si la petición
  falla (429, sin conexión…), el `finally` apaga el spinner y se muestra un error con botón
  de reintentar. Sin eso la pantalla se queda "Cargando…" para siempre y parece que la app
  se colgó (pasó en las pestañas del módulo de cotizaciones).
- **NADA de `PUT`**: el CORS del backend (`app.ts`) solo permite
  `['GET','POST','PATCH','DELETE']`. Un `PUT` desde el navegador muere en el **preflight**
  (`Method PUT is not allowed by Access-Control-Allow-Methods`) y el botón "no hace nada"
  — con `curl` sí funciona (curl no hace preflight), así que probar solo por consola NO
  detecta el fallo. Para reemplazar un conjunto completo, usar `PATCH`. Pasó con
  `/costeo/formulas/:id/accesorios`.
- **Puertos zombis locales**: si 4000/5173 quedan ocupados tras pruebas,
  `Get-NetTCPConnection -LocalPort N` → `Stop-Process`.
- **MySQL de XAMPP que arranca y se muere a los segundos (2026-08-04)**: NO era la base del
  proyecto. Las tablas de PERMISOS de la base de sistema `mysql` (motor **Aria**, no InnoDB)
  estaban corruptas: `proxies_priv` inflada a **5,35 MB** cuando pesa 8 KB, más `db` y
  `columns_priv`. Al leer los permisos, mysqld chocaba con una página con CRC malo y
  **abortaba el proceso** — por eso alcanzaba a decir "ready for connections" y moría después.
  - **Síntoma delator**: en el log de Windows (no en `mysql_error.log`) sale
    `InnoDB: Tried to read 16384 bytes at offset N, but was only able to read 0`. Divide ese
    offset por **8192** (página Aria) y te da la página dañada; aquí 5275648/8192 = 644, justo
    en el rango que reportó el reparador. El prefijo dice "InnoDB" pero el archivo era Aria.
  - **Diagnóstico en 1 comando**: `mysqlcheck --all-databases --check`. Y para aislar:
    arrancar con `--skip-grant-tables --port=3307`; si así SÍ vive, el problema son los permisos.
  - **Arreglo**: `REPAIR TABLE mysql.db, mysql.columns_priv, mysql.proxies_priv, …` →
    `FLUSH PRIVILEGES`. Ojo: el reparador DESCARTA las filas ilegibles ("Number of rows changed
    from 3 to 0"), así que hay que volver a otorgar lo que vivía ahí — aquí se perdió el permiso
    de phpMyAdmin y se restauró con `GRANT … ON phpmyadmin.* TO 'pma'@'localhost'`.
    `root` no se ve afectado: sus privilegios viven en `mysql.global_priv`, no en `mysql.db`.
  - **Causa de fondo y prevención**: TODOS los arranques del log decían "Starting crash
    recovery" — nunca hubo un apagado limpio. Aria no siempre sobrevive a eso y el daño se
    acumula. **Detener MySQL siempre desde el panel de XAMPP** (o `mysqladmin shutdown`), nunca
    matando el proceso ni apagando Windows con MySQL prendido.
  - La base `perfumes_db` NO se tocó: las 94 tablas quedaron sin errores y los datos intactos.
- **`prisma generate` falla con EPERM** si el dev server (ts-node-dev) está corriendo:
  tiene tomado `query_engine-windows.dll.node`. Detener node antes de compilar.
- **Límite de 10 logins cada 15 min** (`authLimiter` en app.ts): las pruebas E2E que
  hacen login repetido se bloquean. Reiniciar el backend limpia el contador (está en
  memoria); mejor: un solo login por script y reusar la sesión.
- **helmet** controla el CSP real (app.ts línea ~61), no solo nginx.
- **La base de producción es MariaDB 10.11, NO MySQL** (VPS Ubuntu 24.04 en DonWeb; el
  servicio se llama `mariadb`, no `mysql`). JAMÁS instalar `mysql-client` en el servidor:
  apt desinstala MariaDB server por conflicto de paquetes (pasó el 2026-07-21 y tumbó la
  base en producción; los datos en /var/lib/mysql sobrevivieron). El mysqldump correcto es
  el que trae `mariadb-client`.

## Deploy (runbook)

```bash
# Local: commit + push (mensajes cortos estilo "avances" o descriptivos)
# Servidor:
cd /var/www/celestial-parfums && git pull
cd backend
npx prisma migrate deploy   # solo si hay migración nueva; plan B: SQL directo
npm run build && pm2 restart celestial-backend
cd ../frontend
npm install                 # solo si hubo dependencias nuevas
npm run build               # nginx sirve frontend/dist directamente
```

Migraciones pendientes de aplicar en producción al escribir esto:
- `anuncios.max_descuento` + `anuncios.max_canjes`
- `creditos.venta_id` (+ FK única a ventas)
- `ventas.presentacion` VARCHAR(20)→VARCHAR(100) (los Excel reales traen textos
  largos tipo "1 de 30 ml y 2 de 60 ml"; el importador además recorta a 100)
- `venta_perfume.cantidad` SMALLINT UNSIGNED NOT NULL DEFAULT 1 (unidades por
  fragancia dentro de una venta)
- `20260722120000_precios_por_presentacion`: tabla `precios`, `perfume_presentacion.precio`
  y `perfumes.esencia_premium`. La migración SIEMBRA la lista con el precio más común de
  cada categoría+presentación y deja como excepción a los que no coincidan → **nadie
  cambia de precio al aplicarla**. Después hay que corregir a mano en Catálogo → Precios
  las tallas que hoy no tienen dato real (50ml = 45.000 y 100ml = 70.000).
- `20260722140000_credito_fecha_limite`: `creditos.fecha_limite` (acuerdo de pago). La
  migración retro-completa los créditos existentes con fecha + 1 mes.
- `20260723120000_recompensas`: tablas `recompensa_config` (siembra la config por defecto:
  5 sellos, perfume 10ml gratis) y `recompensa_usuario`.
- `20260723140000_recompensa_colores`: `recompensa_config.color_fondo/color_lineas/color_texto`
  (colores de la tarjeta, con defaults negro+dorado).
- `20260724120000_resenas_ganadores`: tablas `resenas` (reseñas con estado de moderación) y
  `recompensa_entrega` (fotos de premios entregados para la galería). El **backend suma la
  dependencia `sharp`** → en el deploy del backend correr `npm install` antes del build.
- `20260726120000_favoritos_avisos_blog_nosotros_referidos`: tablas `favoritos`,
  `avisos_stock`, `posts`, `sobre_nosotros_config` + columnas `users.codigo_referido` y
  `users.referido_por`. El backend suma `sanitize-html` y `express-slow-down` → `npm install`.
- `20260727120000_cotizaciones_mayoristas`: tablas `insumos_costo`, `formulas_volumen`,
  `escalas_precio`, `cotizacion_config`, `plantillas_cotizacion`, `cotizaciones` y
  `cotizacion_items` (módulo B2B). Sin migraciones extra, pero el **frontend suma `sonner`**
  (toasts) → en el deploy del frontend correr `npm install` antes del build.
- `20260729120000_cotizacion_esencia_y_tipo`: `formulas_volumen.esencia_insumo_id` (cada
  tamaño elige su esencia) + `cotizaciones.tipo` y `cotizaciones.lista_precios`.
- ~~`20260730120000_cotizacion_accesorios`~~: **YA APLICADA en producción** (verificado el
  2026-08-01 contra el dump del servidor: `insumos_costo.alcance`, `formula_accesorios` y
  `cotizaciones.extras_pedido` ya existen). Quedan pendientes solo las 7 de abajo.
- `20260731120000_devoluciones`: tablas `devoluciones` y `devolucion_perfume`. Ya incluye las
  columnas de la fase C (`origen`, `user_id`, `imagenes`), así que el portal del cliente no
  necesitará otra migración. Sin dependencias nuevas.
- `20260801120000_inventario_compras`: `insumos_costo.precio` pasa a DECIMAL(12,4) y suma
  `stock`; `pagos_proveedor` suma `numero_factura` y `archivos`; tablas nuevas
  `compra_items`, `movimientos_inventario` y `producciones`; `devoluciones` suma
  `reposicion_formula_id`, `reposicion_cantidad`, `costo_reposicion` y `costo_envio`;
  `compra_items.unidad_compra` suma `l` (litros), `movimientos_inventario.tipo` suma
  `muestra`, `perfumes.insumo_esencia_id` y `producciones.perfume_id/envase_insumo_id`.
  Sin dependencias nuevas.
- `20260801140000_tallas_en_ml`: `presentaciones.ml` + `presentaciones.formula_volumen_id`
  (la talla pasa a ser un NÚMERO; el `nombre` queda como etiqueta), siembra el envase y la
  fórmula de 75 ml y 6 ml, y enlaza cada talla con su receta por número.
- `20260801150000_lineas_de_venta`: `venta_perfume` cambia de clave — `id` autoincremental,
  `ml` y única `(venta_id, perfume_id, ml)`. Conserva las filas.
- `20260801160000_consumo_por_venta`: `ventas.costo_mercancia`.
- `20260801170000_tipos_de_producto`: `perfumes.tipo_producto` (fabricado|comprado|
  fraccionado), `insumo_producto_id` y `ml_utiles`.
- `20260801180000_envase_por_perfume_talla`: `perfume_presentacion.envase_insumo_id` y
  `accesorios` (el frasco de un 1.1 cambia según la referencia).
- `20260801190000_rellenar_talla_historica`: copia la talla desde el texto de la venta
  (`ventas.presentacion`) a cada línea. **La talla histórica NUNCA se perdió**: estaba en un
  texto para toda la venta, no por producto. Solo rellena cuando el texto es inequívoco;
  `200/250 ML` y `Combo Personalizado` se quedan en NULL a propósito (adivinar metería un
  dato falso). Verificado sobre producción: 426 de 434 líneas quedaron con talla, 8 sin
  ella, y ni el dinero ni el número de líneas se movieron.

**Verificado el 2026-08-01**: la base local se reemplazó por el dump real de producción y
las 8 migraciones pendientes se aplicaron EN ORDEN sobre esos datos, sin perder una fila
(212 perfumes, 261 ventas, 434 líneas, 22 usuarios). Después `prisma db push` respondió
"in sync" sin cambios → las migraciones producen exactamente el esquema de Prisma. Ese es
el orden exacto del deploy.

**GOTCHA de migraciones (2026-08-01)**: `INSERT ... SELECT * FROM (SELECT 'a','b',…) AS t`
usa los LITERALES como nombres de columna de la tabla derivada. Si un valor se repite
(pasó con `'unidad'` en unidad y en alcance) MySQL corta con **"Duplicate column name"** y
la migración no corre. **Aliasea siempre cada columna** (`SELECT 'x' AS n, …`). Este fallo
NO se ve con `prisma db push` (nunca ejecuta los .sql): solo aparece corriendo las
migraciones de verdad — por eso vale la pena probarlas contra una copia de producción antes
de subir.

## Reportes (dashboard → sección Reportes)

- **Tres pestañas, no una** (`rep_ventas`, `rep_compras`, `rep_clientes`): son preguntas
  distintas — cuánto vendí, cuánto gasté y quién me compra. Endpoints `/api/reportes/:tipo`
  (`reporte.repository.ts` + `reporte.router.ts`, todo `requireAdmin`: llevan costos, deudas
  y ranking de clientes).
- **Nada se guarda**: todo se recalcula del historial en cada llamada, como el motor de cupo
  y la tarjeta de recompensas. Un acumulado guardado se desincroniza el primer día que el
  dueño corrija una venta vieja.
- `GraficoBarras.tsx` es el gráfico REUTILIZABLE (barras por mes, apiladas si hay 2+ series).
  Reglas que NO se negocian: **un solo eje** (dos medidas de escala distinta = dos gráficos),
  leyenda siempre visible con 2+ series, tabla equivalente en el `<details>` "Ver los
  números", y los valores en texto normal (el color identifica, no informa).
  Paleta `SERIE_A` `#8661cc` / `SERIE_B` `#c78200`, validada contra fondo blanco (banda de
  luminosidad, croma, daltonismo y contraste). **El iris de marca `#524276` NO sirve para
  barras**: muy oscuro y de croma bajo, el validador lo rechaza.
- Piezas compartidas en `dashboard/reportes/comun.tsx` (`useReporte` con reintentar,
  `ReporteShell`, `Panel`, `Ranking`).
- El **ticket promedio** se mide solo sobre ventas pagadas: meter lo pendiente infla la cifra
  con plata que no ha entrado. En compras se aclara que el gasto **no es pérdida** (lo no
  vendido sigue en bodega) — sin eso, ver "gasté más de lo que vendí" asusta sin motivo.
- Ventas tiene un enlace a Reportes, pero el gráfico ya NO vive ahí: en esa pestaña se
  registra y se busca.

## Estado al cerrar el 2026-08-01 (leer antes de seguir)

**Base local = copia de producción.** Se importó el dump real del servidor y se le
aplicaron las 8 migraciones. Ojo: el export de TablePlus venía **cortado** a mitad de la
última fila de `ventas`; la copia reparada está en `Documents\celestial_db_REPARADO_2026-08-01.sql`.
A la venta 1267 (Esteban Madera) se le completaron `pagada=1` y `user_id=NULL` a mano —
si el dueño dice otra cosa, corregirla.

**NADA de esto está en producción todavía.** El deploy pendiente incluye el arreglo de
Prisma (`@prisma/client`), las 8 migraciones y todo el módulo de inventario. Antes de
subir: respaldo por SSH y verificar que el archivo pese cientos de KB, no 20 bytes.

**Hecho en UX (sesión 2026-08-01), después de que el dueño lo reclamara:**
- **Inventario**: faltaba el botón para registrar que LLEGÓ material — solo había salida y
  producción, y las compras vivían escondidas bajo "Proveedores". Ahora hay
  **"Registrar llegada"** (enlaza a `/dashboard/pagos?nueva=1`, que abre el formulario
  solo). Los botones de Excel se bajaron a una fila aparte en pequeño: competían con las
  acciones reales y no se distinguía cuál era la importante.
- **Crear insumo al vuelo** dentro de la compra (`DetalleCompra.tsx`): llega una esencia o
  un envase nuevo y se da de alta ahí mismo, sin salir de la factura. Va **primero** en la
  lista del buscador (al final hay que hacer scroll y nadie ve que existe). **No pide
  precio**: lo fija esa misma compra vía costo promedio.
- **Fórmulas**: la receta era un párrafo corrido ("esencia 15 · diluyente 14.3 · …") y
  ahora es una rejilla de 4 casillas etiquetadas, con envase y esencia en su propia línea
  y aviso ámbar si falta elegir la esencia.

**Pendientes concretos:**
1. **Rediseño del dashboard, en 3 olas** (el dueño señaló 9 pantallas el 2026-08-01).
   Diseño y plan escritos en `docs/superpowers/`. **Ola 1 HECHA** (cimientos de la tabla +
   Clasificaciones + Usuarios, rama `rediseno-dashboard-ola1`; ver la sección "La tabla del
   dashboard"). **Ola 2 HECHA** (Ventas y Créditos) y **Ola 3 HECHA** (Inventario,
   Proveedores, Insumos y precios, Costos de producción, Tamaños y fórmulas, más los tres
   Reportes con su selector de periodo). Todo en la rama `rediseno-dashboard-ola2`.
   **El rediseño está completo**; lo que queda son mejoras de fondo, no de forma.
2. **8 líneas de venta sin talla**: las ventas 1179, 1180, 1181 y 1249 dicen "200/250 ML"
   (no se sabe si fue el de 200 o el de 250) y la 1219 es un "Combo Personalizado" con dos
   tallas en una línea. Solo el dueño puede decir cuál era.
3. Separar "200/250ML" en dos tallas reales y sembrar el stock inicial.
4. La skill **`catalogo-recompra`** existe en la cuenta de claude.ai del dueño pero NO en
   disco, así que Claude Code no la ve (`Unknown skill`). Para usarla hay que copiarla a
   `C:\Users\Estaduardo\.claude\skills\catalogo-recompra\SKILL.md`. No decirle que "no
   existe": existe, simplemente no llega hasta acá.

## Cómo trabajamos (preferencias del dueño)

- Verificar visualmente con screenshots (Playwright + msedge headless) los cambios de UI;
  probar flujos E2E cuando tocan dinero (descuentos, cupones, ventas).
- Cerrar popups de anuncios en los screenshots (botón "Entendido").
- Antes de features de negocio: aterrizar el diseño en texto, dar opciones A/B/C con
  recomendación, y él decide. Le gusta entender el porqué (explicar como a un socio).
- Nada de datos inventados en la UI (tiempos de entrega, garantías): preguntar primero.
- Marketing/conversión: es tienda WhatsApp-first en LatAm; la fricción mínima y la
  confianza personal valen más que checkout tradicional.
