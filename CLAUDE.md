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

- `backend/`: Express + TypeScript + Prisma 6 + MySQL. Cliente Prisma generado en
  `src/generated/prisma` (NUNCA editar ni convertir su encoding). Build: `npm run build`
  (prisma generate + tsc → `dist/`).
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

### Fechas (bug ya corregido — no reintroducirlo)
- Las fechas "de calendario" (`ventas.dia`, `creditos.fecha`, `pagos.dia`, `anuncios.inicio/fin`)
  son `@db.Date`: el backend las manda como AAAA-MM-DD. Formatearlas con `new Date(s)`
  las lee como medianoche UTC y en Colombia (UTC-5) mostraba **el día anterior**
  (una venta del 22 salía como 21). Usar `fmtDate` de `dashboard/helpers.ts`, que parte
  la cadena; para marcas de tiempo reales (`created_at`) usar `fmtInstante`.

### Importadores/exportadores
- Son genéricos por entidad: basta agregar la entidad a `IMPORT_SPECS` (columnas + notas)
  y sus ramas en `exportEntity`/`importEntity`. El router, la plantilla, el modal y el
  botón Exportar del frontend ya funcionan solos (`<ExportButton entity="..." />`).
- Entidades: perfumes, aromas, ocasiones, categorias, presentaciones, combos, descuentos,
  ventas, creditos, proveedores, publicidad y **precios** (la lista categoría×presentación;
  importar ACTUALIZA la combinación existente, sirve para subir precios en bloque).
- La plantilla de perfumes lleva `precios_presentacion` (`30ML=60000, 100ML=150000`, solo
  excepciones) y `esencia_premium` (si/no).
- Publicidad: exporta/importa las CAMPAÑAS, nunca los códigos ya emitidos (son de cada
  persona). Importar siempre CREA (no actualiza): subir dos veces el archivo duplica.
  En anuncios que no son de tipo `descuento` las columnas de cupón se guardan en cero
  (un mensaje no puede colar un descuento).
- `bustImportCache()` limpia `parfums:` y `anuncios:`.

### Otros
- Imagen de fondo de la página Contáctame: se sube con `POST /api/contacto/fondo`
  (igual que el avatar); deja `fondo_tipo='imagen'` y borra del disco la imagen anterior.
  `saveConfig` también borra el fondo viejo si cambió.
- "NUEVO" en cards: automático, por antigüedad del registro (`NUEVO_DIAS` en
  perfume.repository, hoy 7 días). El mismo valor decide qué sale en "Nuevos" del home.
- Al borrar/reemplazar imagen de perfume/combo/anuncio se borra el archivo físico de
  uploads (`utils/imagenes.ts`) — servidor pequeño, cero huérfanos.
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
- **Seguridad (auditoría 2026-07-25)**: `utils/uploadsUrl.ts` → `sanearUploadsConservados`
  filtra las URLs `conservar[]` de reseñas/premios para aceptar SOLO archivos de nuestro
  `/uploads` (evita inyectar URLs externas y host-poisoning; reconstruye con la baseUrl). Los
  endpoints de moderación validan `estado` (400 si es inválido). En producción, si falta
  `BACKEND_URL`, el arranque avisa (las URLs de /uploads no deben depender del header Host).
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
- `20260730120000_cotizacion_accesorios`: `insumos_costo.alcance` (unidad|pedido), tabla
  puente `formula_accesorios` (accesorios por defecto de cada tamaño) y
  `cotizaciones.extras_pedido` (JSON).

## Cómo trabajamos (preferencias del dueño)

- Verificar visualmente con screenshots (Playwright + msedge headless) los cambios de UI;
  probar flujos E2E cuando tocan dinero (descuentos, cupones, ventas).
- Cerrar popups de anuncios en los screenshots (botón "Entendido").
- Antes de features de negocio: aterrizar el diseño en texto, dar opciones A/B/C con
  recomendación, y él decide. Le gusta entender el porqué (explicar como a un socio).
- Nada de datos inventados en la UI (tiempos de entrega, garantías): preguntar primero.
- Marketing/conversión: es tienda WhatsApp-first en LatAm; la fricción mínima y la
  confianza personal valen más que checkout tradicional.
