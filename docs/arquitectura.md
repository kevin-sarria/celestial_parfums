# Arquitectura y estructura técnica

Cómo está armado el sistema: stack, carpetas, páginas, dashboard, rendimiento y seguridad.
Las reglas de negocio están en [`reglas-negocio.md`](reglas-negocio.md); el estilo visual en
[`diseno-ux.md`](diseno-ux.md).

## Stack

- `backend/`: Express + TypeScript + Prisma 6 + MySQL. Build: `npm run build`
  (prisma generate + tsc → `dist/`).
- `frontend/`: React + Vite + Tailwind **v4** + shadcn. Build: `npm run build` → `dist/`.
- Auth: JWT en cookies, roles (ADMIN = rol 1), Google OAuth, reCAPTCHA en login/registro.
- Local: MySQL de XAMPP (`C:\xampp\mysql\bin\mysql.exe`, base `perfumes_db`, user root sin
  password). Arrancar si no responde el puerto 3306. Producción: base `celestial_db`
  (MariaDB 10.11 en VPS Ubuntu 24.04).

**El cliente de Prisma se importa de `@prisma/client`, NUNCA de una carpeta dentro de
`src/`** (y el `generator` del schema NO lleva `output`). Con `output = "../src/generated/
prisma"` el proyecto funcionaba en local pero **se rompía en el servidor**: `tsc` solo
traduce los `.ts`, así que a `dist/` llegaban 7 archivos y quedaban fuera los otros 43 —
incluido el MOTOR de Prisma. En local no se notaba porque el dev server corre desde `src/`;
en producción `node dist/app.js` arrancaba sin motor. `node_modules` no lo compila nadie,
así que ahí el cliente queda entero. Verificado arrancando `dist/app.js` contra la base real.

## Páginas públicas (landing vs catálogo)

- **`/` = Landing de marketing** (`HomePage.tsx`), diseñada para CONVERTIR (embudo):
  `LandingHero.tsx` (propuesta de valor "las fragancias que amas, sin pagar de más" +
  buscador con ejemplos que NAVEGA a `/perfumes?q=` + micro-confianza) → **más vendidos**
  (prueba social primero) → nuevos → **combos con descuento** (sube el ticket) →
  `EnvioPagos.tsx` (reaseguro) → galería de ganadores → "cómo funciona" → **cierre con CTA
  de WhatsApp**. NO lleva sidebar de filtros ni grilla paginada. `/catalog` (solo admin) es
  su vista previa (`adminPreview`).
- **`/perfumes` = Catálogo completo** (`PerfumesPage.tsx` + hook `usePerfumes`): filtros +
  paginación + búsqueda server-side. Lee `?q=` (búsqueda del landing) y `?categoria=` (de
  "elegir mis perfumes" de un combo). Aquí vive la grilla pesada.
- **`/legal`** = información legal (`LegalPage.tsx`, lazy): 3 secciones con ancla
  (`#terminos`, `#datos`, `#marcas`) + devoluciones. Va en el sitemap.
- **Muestras de regalo = INTERNO, NO se muestran en la web** (`MUESTRAS_INTERNO` en
  `config/negocio.ts`, solo referencia). Son un detalle interno según disponibilidad de
  envases, no una promesa pública. En la web se promete envío + pago + asesoría por WhatsApp.
- Datos operativos del negocio (transportadoras, tiempos, métodos de pago, muestras,
  `GARANTIA`) en `config/negocio.ts` — editar ahí (candidato a volverse configurable desde
  el dashboard).
- **Footer** (`components/Footer.tsx`, en `App.tsx`, oculto en dashboard/contactame) con
  navegación, enlaces legales y CTA de WhatsApp.
- **Ordenamiento del catálogo** (`/perfumes`): `?sort=` → `destacados` (nuevos primero,
  default), `precio_asc`, `precio_desc`, `nombre`. Ojo: el precio efectivo sale de la
  cascada, no de una columna; se ordena por `perfumes.precio` (respaldo), aceptable porque
  casi todo cuesta lo mismo. Mapeo en `perfume.repository.ts` (`ORDEN_CATALOGO`).
- "NUEVO" en cards: automático, por antigüedad del registro (`NUEVO_DIAS` en
  `perfume.mapeo`, hoy 7 días). El mismo valor decide qué sale en "Nuevos" del home.
- **Cómo se LEE un perfume vive aparte del repositorio** (`perfume.mapeo.ts`, 2026-08-14):
  `perfumeInclude`, la cascada de precios, el agotado automático y `mapPerfume`. Son dos
  oficios distintos —ahí no se consulta ni se escribe nada, todo es puro y síncrono— y el
  repositorio se había ido a 912 líneas. Quien toque una regla del catálogo entra ahí; quien
  toque una consulta, al repositorio.
- **Gotcha de la API**: `GET /api/parfums` sin paginar responde `{ data: { data: [...] } }`
  (anidado); con `?page=` responde `{ data: [...], total }` y **limit tope 100**. Para listas
  completas (ej. el selector de productos) usar el no paginado y desenvolver ambas formas.

## La capa HTTP del frontend (`infrastructure/api/`, 2026-08-14)

**Ninguna pantalla vuelve a escribir una URL ni a saber con qué librería se pide.**

| Archivo | Qué es |
|---|---|
| `http.ts` | **El único archivo que importa axios.** Instancia con `baseURL` (`VITE_API_URL` + `/api`), cookies, interceptor de 401 (renueva y reintenta UNA vez) y de 403 (cierra sesión). |
| `urls.ts` | Todas las rutas, agrupadas por dominio. Lo que lleva parámetro es una **función**. |

Nació de medirlo: había **151 llamadas repartidas en 49 componentes, 25 con `fetch` suelto y 129
rutas escritas a mano**. Cambiar de librería, o que el backend renombrara un endpoint, obligaba a
salir a buscar por todo el frontend.

Decisiones que conviene no deshacer:

- **`http` NO lanza excepciones**: devuelve `{ ok, cuerpo, error, status }`. Axios lanza en un 400,
  y eso obligaría a envolver 150 llamadas en try/catch; la que se olvidara **rompería la pantalla
  en vez de avisar**, justo al revés de la regla del proyecto (ningún handler ignora la respuesta).
  Con esto, el patrón de siempre —`if (!res.ok) toast.error(res.error)`— se mantiene.
- **La URL base va en la instancia, no en cada ruta.** Repetir la variable de entorno 129 veces
  sería mudar el problema de sitio.
- **El interceptor no sabe de React.** `AuthProvider` le registra qué hacer cuando la sesión
  caduca (`registrarSesionCaducada`). Antes eso vivía dentro de `guardedFetch`, y por eso **cada
  pantalla tenía que recibir la función de red como prop**; las migradas ya no la reciben.
- **Se migra por pantallas completas, nunca a medias.** Lo que todavía no está en `urls.ts` sigue
  con el `guardedFetch` viejo, que es fetch nativo. Convivencia temporal y a la vista, no
  permanente: cuando caiga la última pantalla se borran `client.ts` y `useGuardedFetch`.

**Estado** (2026-08-14): migradas *Producción e inventario* (Inventario, Producciones, Pedido
sugerido y sus 4 modales), **Ventas** (listado, formulario, crear persona y crear producto al
vuelo), **Perfumes** (ficha, publicar/agotar, lista de precios), **Créditos** (cartera, abonos,
perfil de cupo), **Proveedores** (compras con sus líneas, IVA por proveedor, alta de empresa) y
**Clasificaciones** (las cuatro listas + la carga inicial del dashboard), **Devoluciones**,
**Usuarios**, **Reposiciones (avisos)** y **Reseñas**.
Van 68 rutas centralizadas y **67 llamadas migradas de 151**; quedan 84.

Las cuatro clasificaciones comparten juego de rutas, así que `urls.clasificaciones(tipo)` las
genera en vez de escribirlas cuatro veces — y el tipo `Clasificacion` hace que TypeScript
compruebe que nadie invente una quinta.

Orden de migración: **por pantallas que se usan a diario primero**, y cada una entera. Las que
tocan dinero se migran con su recorrido en navegador ya escrito — `venta.e2e.test.ts` registra una
venta completa por pantalla y comprueba que el inventario se movió, así que la migración de Ventas
se verificó sola.

**Ojo con el typecheck**: `npx tsc --noEmit` en `frontend/` **no comprueba nada** — el `tsconfig`
raíz tiene `files: []` y delega en referencias. Lo real es `npx tsc -p tsconfig.app.json --noEmit`
o `npm run build`.

## El menú lateral vive aparte (`MenuLateral.tsx`, 2026-08-14)

**El estado de "abierto/cerrado" pertenece al menú, no a la página.** Cuando vivía en
`DashboardPage`, cada toque del cajón repintaba la página entera —tabla incluida— justo mientras
se deslizaba la animación.

Medido antes y después, sobre la pantalla de Perfumes, abriendo y cerrando tres veces:

| | Al abrir | Al cerrar |
|---|---|---|
| Antes | 76-90 ms | 53-62 ms |
| Después | **0** | **0** |

Un fotograma dura 16 ms: un tirón de 80 ms se come cinco seguidos, y el dueño lo describió como
*"parpadea mucho"*. La pista que resolvió el caso fue medir en una pantalla LIGERA
(Presentaciones, 2 filas): ahí no había tirones, así que el culpable no era el cajón sino la
pantalla de atrás repintándose sin motivo.

- El mapa de apartados (`TAB_META`, `NAV_SECTIONS`) salió a `navegacion.ts` porque lo usan la
  página y el menú: dejarlo en cualquiera de los dos cerraba un círculo de imports.
- **Regla general que deja el caso**: el estado que solo usa un trozo de la pantalla se guarda en
  ese trozo. Subirlo "por comodidad" convierte cada clic en un repintado de todo lo que cuelgue
  debajo.
- Cubierto por `menuLateral.e2e.test.ts`, escrito ANTES de la mudanza: hasta entonces el menú
  —el único camino real entre apartados— no tenía ni una prueba.

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

### El menú está partido en dos: plata y operación (2026-08-10)

Lo señaló el dueño cuando "Ventas y créditos" llegó a ocho pestañas: *"una cosa es la parte
contable —lo que se vende, lo que sale, lo que se devuelve— y otra muy diferente las
fórmulas y demás, que no es el core de las ventas sino más de operaciones o de reglas"*.

- **Ventas y créditos** → ventas, créditos, devoluciones, proveedores. Todo es PLATA que
  entra o sale.
- **Producción e inventario** → inventario, pedido sugerido, producciones, tamaños y
  fórmulas, costos de producción. Todo es OPERACIÓN: qué tengo, qué pido, qué armé, con qué
  receta y cuánto me cuesta.
- Criterio para futuras pestañas: **si la pregunta es "cuánto dinero", va al primero; si es
  "cómo lo hago o con qué", al segundo.** Un grupo de ocho pestañas mezcladas obliga a
  leerlas todas para encontrar una.

## La tabla del dashboard (`SmartTable`)

La usan ~10 pestañas, así que **todas sus capacidades son props OPCIONALES**: una pestaña
que no pase nada renderiza exactamente igual que siempre. Al tocarla, mantener esa regla.

- `numerada`: columna **#** con la **posición visible**, no el id. Sigue de corrido entre
  páginas (la 2 empieza en 26) y **se renumera al reordenar** — es un número para leer y
  para decir "revisa el 14", no un código permanente. El `id` sigue siendo la llave real de
  `rowKey` y de las rutas `PATCH`/`DELETE`; el `#` nunca viaja al servidor.
- `paginadoLocal`: pagina en el navegador las pestañas que cargan todas las filas de una
  (Usuarios, Clasificaciones). Se ignora si ya se pasó `pagination` (la de servidor). Por
  defecto **25**, a propósito distinto del `DEFAULT_PAGE_SIZE = 10` de `helpers.ts`: ese
  aplica cuando cada página cuesta una petición; aquí las filas ya están en memoria. El
  corte se hace **sobre `processed`** (ya filtrado y ordenado), nunca sobre `rows`.
- **Volver a la página 1** al buscar, filtrar u ordenar se hace **en el evento**
  (`volverAlPrincipio`), no en un `useEffect`: el linter de react-hooks rechaza `setState`
  dentro de un efecto porque encadena renders. Sin esto, filtrar de 200 a 3 registros deja
  al usuario mirando una página 7 vacía.
- `tarjetaMovil`: debajo de 640px la fila se pinta como tarjeta táctil resumida que se
  expande al tocarla (`FilaTarjeta.tsx`), en vez del scroll horizontal. El papel de cada
  columna se declara con `movil: 'titulo' | 'meta' | 'estado' | 'destacado' | 'detalle'`;
  **sin marcar es `detalle`** (solo se ve al expandir), y si ninguna se declara `titulo`
  manda la primera columna.
- `accionesMovil`: acciones con TEXTO para la tarjeta (`✎ Editar`), porque `renderActions`
  devuelve botones de solo icono pensados para una fila estrecha y con el pulgar el icono
  solo es ambiguo. Si falta, cae a `renderActions`.
- `useMediaQuery(query)` (`components/table/useMediaQuery.ts`): lo usan el paginador
  compacto (520px) y la tarjeta (639px).
- **Clasificaciones** (aromas, ocasiones, categorías, presentaciones, gamas) salen todas de
  `LookupTab`: alta y edición por modal con **"Guardar y agregar otro"**, aviso de duplicado
  calculado en el front (normalizando tildes y mayúsculas) antes de gastar una petición, y
  `nuevo`/`editar` como textos completos ("Nueva categoría", "Nuevo aroma") en vez de
  derivar el género gramatical, que se escribe mal.
- `BloqueCampos` (`dashboard/ui.tsx`) agrupa campos con título dentro de un formulario largo.

## Ventas y Créditos comparten pieza (`pedido/`)

Las dos pantallas hacían **lo mismo** con dos implementaciones desalineadas.

- **`pedido/lineasPedido.ts`** (antes `creditoLineas.ts`): cálculos puros. La `LineaPedido`
  lleva la talla **por partida doble a propósito**: `presentacion` es la etiqueta con la que
  se busca el precio y `ml` el número con el que el inventario sabe qué receta descontar.
  Las dos salen juntas de `perfume.precios[]`, así que **no se pueden desincronizar**.
  `presentacion`/`ml` en null = producto sin talla (una gorra).
- **El servidor manda `ml` dentro de `precios[]`** (`resolverPrecios`). Se decidió eso en vez
  de que el navegador adivine el número leyendo el texto: de ese número depende qué insumo se
  descuenta, y "200/250ML" o "Combo Personalizado" no tienen número que adivinar.
- **`ArmadorPedido`**: agregar el mismo producto con la misma talla suma unidades; cambiar la
  talla hasta dejar dos líneas iguales **las fusiona**. Sin eso la misma referencia aparece
  dos veces y el conteo miente.
- **`ResumenPedido`**: productos − combo − cupón = total. Las líneas que valen cero no se
  pintan. En Ventas el total es un **"Sugerido"** con botón `usar`: el valor se sigue
  tecleando a mano porque es la plata que entró de verdad; el sistema propone, no impone.
- **El campo "Cantidad" suelto de Ventas desapareció**: se deriva de las líneas
  (`unidadesDeLineas`). Era un dato duplicado y el día que no coincidiera ganaba el número
  tecleado.
- **`GET /creditos/totales`**: cuánto te deben, cuánto está vencido y cuánto abonaron este
  mes. Hace falta un endpoint porque eso **no se puede calcular con la página que está en
  pantalla**. Usa el MISMO criterio de saldo que `mapCredito` para que la caja de arriba y la
  tabla de abajo nunca digan cosas distintas.
- Archivos: `VentasTab` 236 (+ `VentaForm` 453), `CreditosTab` 313 (+ `CreditoForm` 381).

## Centro de notificaciones (campana del header)

Nació porque la lista de material bajo mínimo se pintaba ENTERA encima de Inventario: **55
renglones** tapando la pantalla. Queja textual del dueño: *"se me hace muy feo ese mensaje
ultra largo […] que el mensaje sea muy breve"*.

- **Por qué se rompió, y es la lección que importa**: la banda se escribió cuando **solo 1 de
  226 materiales tenía mínimo configurado**. Con un renglón se veía perfecta. Al configurar
  los mínimos por gama saltó a 55 de golpe. **Una lista sin tope se prueba con los datos del
  día que funcione, no con los de hoy**: preguntarse "¿cuántas filas tendrá esto cuando el
  módulo esté bien usado?" es lo que evita el muro.
- **Y estaba duplicando una pantalla**: el detalle (cuánto pedir, a qué costo, copiar para
  WhatsApp) ya vive en `reposicion`. La banda no había que embellecerla, había que quitarla.
- **`notificacion.repository.ts`** junta en un solo sitio lo que estaba regado por el panel:
  créditos vencidos, stock en negativo, perfumes que no descuentan, garantías sin resolver,
  material en el mínimo, esencias sin perfume, reseñas por aprobar, clientes esperando
  reposición y días sin respaldo. Cada aviso es **UNA línea que empieza por el número**; el
  detalle vive en la pestaña a la que lleva.
- **El número sale de la MISMA función que usa la pantalla** (`calcularReposicion`), no de
  una consulta parecida escrita aparte. Si la campana dijera 55 y el pedido sugerido 53, no
  se podría confiar en ninguno. Igual con los créditos vencidos: se replica el criterio de
  saldo de `mapCredito`.
- **Nada se guarda, se recalcula** (como los sellos, el cupo y los promedios por gama): una
  notificación guardada seguiría avisando de algo que el dueño ya resolvió.
- **Si la carga falla se dice DENTRO del panel**, no con un toast: un aviso flotante en cada
  entrada al dashboard molestaría, pero dejar la campana muda haría creer que no hay nada
  pendiente, que es peor.
- El plural va escrito completo (`plural(n, 'material llegó', 'materiales llegaron')`).
- **Al agregar un aviso nuevo**: va en `calcularNotificaciones` con su `tab` y su tono
  (`urgente` = cuesta plata mientras nadie mira · `aviso` = hay que atenderlo pronto ·
  `info` = trabajo de rutina). **No** volver a pintar la lista completa en la pantalla.
- La barra de arriba quedó **con la campana y nada más**; el respaldo se movió al menú
  lateral (`enMenu` de `BackupSeguridad`). El recordatorio de los 7 días es una línea de la
  campana con **`tab: ''`** (el respaldo no es una pestaña: la línea no navega ni cierra el
  panel). `utils/estadoRespaldo.ts` guarda las rutas de `backups/ultima.json` y `totp.json`
  y sus lectores, porque las usan DOS sitios; con la ruta escrita en dos lados, el día que
  la carpeta se mueva uno falla en silencio diciendo "nunca has hecho copia" para siempre.

## Reportes (sección propia del dashboard)

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
- `ReporteShell` acepta `acciones` para los controles del reporte. En Ventas hay un selector
  de **3 / 6 / 12 meses** que recorta la serie **solo del gráfico**; el resto del reporte
  siempre son 12 meses y la etiqueta lo dice explícitamente en vez de mentir.
- La tarjeta "Ventas" dice cómo va el último mes contra el anterior (`variacionUltimoMes`).
  Devuelve null si el mes previo fue cero: un "+∞ %" no informa.
- El **ticket promedio** se mide solo sobre ventas pagadas: meter lo pendiente infla la cifra
  con plata que no ha entrado. En compras se aclara que el gasto **no es pérdida** (lo no
  vendido sigue en bodega) — sin eso, ver "gasté más de lo que vendí" asusta sin motivo.
- Los comparativos entre meses **no van en las cajas de las pestañas de registro**: van a
  Reportes, que es la pantalla de analizar, no la de registrar.

## Importadores / exportadores

- Son genéricos por entidad: basta agregar la entidad a `IMPORT_SPECS` (columnas + notas) y
  sus ramas en `exportEntity`/`importEntity`. El router, la plantilla, el modal y el botón
  Exportar del frontend ya funcionan solos (`<ExportButton entity="..." />`).
- **24 entidades** con export (y con import las que son configuración): perfumes, precios,
  aromas, ocasiones, categorias, presentaciones, combos, descuentos, publicidad, ventas,
  creditos, proveedores, insumos, inventario, movimientos, devoluciones, resenas, entregas,
  formulas, producciones, cotizaciones, usuarios, blog y avisos.
- **Criterio de qué se puede IMPORTAR**: solo configuración y datos que el dueño tecleó. El
  HISTÓRICO CONTABLE (producciones, cotizaciones emitidas, movimientos) se exporta pero se
  rechaza al importar — reescribirlo rompería la trazabilidad. El blog tampoco se importa: su
  HTML se sanea en el servidor y meterlo por Excel se saltaría ese filtro. Las cotizaciones
  exportan UNA FILA POR LÍNEA y **nunca** costos ni márgenes.
- **Regla: un campo nuevo de un insumo no está terminado hasta que viaja por el Excel**,
  porque ahí es donde el dueño trabaja en cantidad. Y va en **LAS DOS hojas** (`insumos` y la
  de CONTEO): la de conteo es la primera del menú y además **ahí se CREAN materiales**.
- `inventario` es la **hoja de conteo físico**: se exporta con lo que el sistema cree que
  hay, se escribe lo real en `cantidad_real` y al subirla cada fila pasa por `ajustarStock`
  (queda su movimiento auditable). Es la forma cómoda de sembrar el stock inicial.
  `movimientos` es **solo exportación**: importarlo descuadraría el stock.
- La plantilla de perfumes lleva `precios_presentacion` (`30ML=60000, 100ML=150000`, solo
  excepciones) y `esencia_premium` (si/no).
- Publicidad: exporta/importa las CAMPAÑAS, nunca los códigos ya emitidos (son de cada
  persona). Importar siempre CREA (no actualiza): subir dos veces el archivo duplica. En
  anuncios que no son de tipo `descuento` las columnas de cupón se guardan en cero.
- **Contenido de clientes (reseñas, fotos de premios): se EXPORTA todo, se IMPORTA solo la
  moderación** (`import/contenido.ts`). El importador exige el `id` de un registro existente
  y solo cambia `estado`; una fila sin id se rechaza con el motivo. Razón: una reseña solo
  existe si esa persona COMPRÓ el perfume, y un importador que las cree se salta esa barrera
  — sería publicidad engañosa (Ley 1480, sancionable por la SIC) y las estrellas dejarían de
  decirle al dueño qué fragancia gustó de verdad. El exportador sí hace falta: es el respaldo
  y la forma de responder un derecho de acceso a datos (Ley 1581).
- **Redes sociales va en JSON, no Excel** (`/api/contacto/export` e `/import`): su estructura
  (config + links con overrides de estilo) es irregular y en una hoja quedaría ilegible.
- **El servicio está partido por dominio** (era un archivo de ~830 líneas):
  `services/import.service.ts` es solo el REPARTIDOR (~78 líneas) y los dominios viven en
  `services/import/`: `core.ts` (helpers, plantillas, `sheetFromRows`, `entityRows`),
  `lookups.ts`, `catalogo.ts`, `ventas.ts`, `inventario.ts`, `contenido.ts`, `resto.ts` y
  `legacy.ts`. Para una entidad nueva: spec en `IMPORT_SPECS` + rama en el módulo de su
  dominio. Ninguno pasa de 290 líneas.
- `bustImportCache()` limpia `parfums:` y `anuncios:`.

## Rendimiento (servidor económico)

- Frontend: `infrastructure/api/cachedFetch.ts` — caché en memoria 4 min + deduplicación de
  peticiones simultáneas. Ya lo usan lookups, combos, destacados y anuncios públicos.
  NO cachear: búsquedas/filtros, portal del usuario, dashboard admin.
- Backend: caché en memoria (`utils/cache.ts`) para catálogo y anuncios públicos;
  compression activo; imágenes con caché 30d immutable.
- Al agregar features: preguntar siempre "¿esto puede servirse del caché o generar en el
  navegador?" antes de crear endpoints nuevos.
- **Bundle**: code-splitting por página (React.lazy en `AppRouter`). Lo pesado ya es lazy:
  catálogo PDF (jsPDF+html2canvas ~600 kB) solo al generarlo, Dashboard (~180 kB) solo admin.
  Bundle principal ~76 kB gzip. Imágenes con `loading="lazy"` + `decoding="async"`; la foto
  del detalle además `fetchPriority="high"` (LCP). Preconnect a `fimgs.net` en `index.html`.
- El spinner (`PerfumeSpinner.css`) anima con `transform`/`opacity` (compositado en GPU),
  no `clip-path`/`filter`.
- **Medición (2026-07-25)**: en producción el catálogo re-maqueta al redimensionar en ~0.7 ms
  y 0 long-tasks; la sensación de "pesado al redimensionar" es SOLO el dev server (Vite sin
  minificar + React dev con doble render). No perseguir ese fantasma en dev.

## Seguridad y anti-abuso

- **Los errores internos NUNCA salen al navegador** (`utils/errorSeguro.ts`): un error de
  Prisma trae la ruta del archivo, el fragmento de código y el host de la base. Con MySQL
  apagado, el login mostraba en pantalla `auth.repository.ts:8:15` y `localhost:3306`.
  `mensajeSeguro(err)` distingue el mensaje de negocio (escrito por nosotros, se muestra tal
  cual) del interno (Prisma, `E*` de red → se registra en el log y afuera va un texto
  genérico). Lo usan `error.middleware.ts` y los 7 controladores con try/catch propio.
  **Regla: jamás `res.json({ error: err.message })` directo.**
- `utils/uploadsUrl.ts` → `sanearUploadsConservados` filtra las URLs `conservar[]` de
  reseñas/premios para aceptar SOLO archivos de nuestro `/uploads` (evita inyectar URLs
  externas y host-poisoning; reconstruye con la baseUrl). Acepta PDF solo con `conPdf = true`
  (soportes de compra); en reseñas y premios sigue sin admitirlos. Los endpoints de
  moderación validan `estado` (400 si es inválido). En producción, si falta `BACKEND_URL`,
  el arranque avisa (las URLs de /uploads no deben depender del header Host).
- **Anti-abuso** (`backend/src/app.ts` + `middleware/limiters.ts`). Regla de oro: **los
  límites son para VISITANTES ANÓNIMOS, nunca para el admin.**
  - `globalLimiter`: corte duro por IP — 300/15min anónimo, 1200 con sesión, y **el ADMIN
    queda EXENTO** (`skip: esAdminRequest`). Así una importación masiva, un respaldo o una
    jornada larga en el dashboard jamás lo dejan fuera de su propia tienda.
  - `speedLimiter` (`express-slow-down`): solo anónimos en producción, tras 600 peticiones,
    máx 2s de retraso.
  - `authLimiter` (10/15min en login/registro) y `uploadLimiter` (25/15min en subidas con
    `sharp`) siguen aplicando a todos: son la puerta de entrada y el gasto de CPU.
  - **`cookieParser()` va ANTES de los limitadores** en `app.ts`; si se mueve después, no se
    puede leer la sesión y el admin volvería a contar como anónimo.
  - El rate limiting de la app NO frena un DDoS real (el tráfico ya llegó); la defensa de
    verdad es **Cloudflare** delante del dominio + `limit_req`/`fail2ban` en nginx.
- **helmet** controla el CSP real (app.ts línea ~61), no solo nginx.
- Imágenes → WebP: dependencia **`sharp`** (`utils/imagenWebp.ts`), `guardarWebp`
  redimensiona (máx 1400px, `fit: inside`) y comprime a calidad 78. Reseñas, fotos de premio
  y devoluciones lo usan vía `uploadMemoria` (multer memoryStorage, 10MB, solo imágenes).
  Soportes de compra (`utils/soporteArchivo.ts`): imágenes → WebP; **PDF se guarda tal cual**;
  `uploadSoportes` valida mimetype **y** extensión (con solo uno, un `.pdf` con otro contenido
  pasaría) y rechaza SVG (admite scripts).
- Al borrar/reemplazar imagen de perfume/combo/anuncio se borra el archivo físico de uploads
  (`utils/imagenes.ts`) — servidor pequeño, cero huérfanos.

## Respaldo de base de datos

- Botón "Respaldo" en el **menú lateral** del dashboard. Doble candado: admin + TOTP
  (RFC 6238 casero en `utils/totp.ts`, secreto en `backend/backups/totp.json`, fuera de git).
  Resetear TOTP = borrar ese archivo por SSH (a propósito: la web no puede). Recordatorio en
  la campana a los 7 días sin copia. mysqldump vía `MYSQLDUMP_PATH` o PATH.
- **Verificar en producción que el archivo pese MB, no bytes**, y que `MYSQLDUMP_PATH`
  apunte al de `mariadb-client`. El bug del respaldo vacío está documentado en
  [`gotchas.md`](gotchas.md).

## Catálogo PDF y proxy de imágenes

- `utils/catalogoPdf.ts` (jsPDF lazy-loaded): botón "Descargar catálogo PDF" **solo admin**,
  en dashboard → pestaña Perfumes. Marca de agua, notas con colores. SEO: slugs generados de
  nombre (`toSlug`), no hay columna slug — se compara contra slug generado.
- **Las fotos externas se traen por el servidor** (`GET /api/parfums/imagen-proxy?url=…`,
  solo admin): **210 de 212 fotos** del catálogo son enlaces a otras webs (fimgs.net y demás)
  y **ninguna salía**, porque para copiar una imagen a un lienzo el navegador exige permiso
  CORS del sitio que la aloja. Resultado medido: de ~0 a **211 de 212** incrustadas.
  - **Se descargan con `fetch` + `blob:`, NO poniéndoselas a un `<img>`**: la etiqueta con
    `crossOrigin` manda la petición ANÓNIMA (sin la cookie) y el proxy respondía 401.
  - `utils/imagenRemota.ts` es una **puerta peligrosa (SSRF)** y por eso valida: solo
    http/https, resuelve el dominio y **rechaza IPs privadas** (incluido el 169.254.169.254
    de los metadatos de la nube, que entrega credenciales), sigue los redirects **a mano
    revalidando cada salto**, exige content-type de imagen, y topa tamaño (8 MB) y tiempo.
    Verificado: los 5 intentos de SSRF y el `file://` se rechazan; sin sesión responde 401.
- **Nada de símbolos raros en el PDF**: Helvetica no tiene ♀ ♂ ⚥ y salían como "&Bp
  Caballero". Se imprime solo la palabra. Misma familia que el guion tipográfico `−`
  (U+2212), que tampoco existe. En la WEB sí se usan los símbolos.
