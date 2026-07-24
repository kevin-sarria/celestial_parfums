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

### Motor de cupo (`creditoPerfil.service.ts`, solo admin)
- Recalcula SIEMPRE desde el historial (no se guarda). Factor sobre `users.cupo_base`,
  acotado 0.5–2.0. Pago rápido (≥300k en 14 días) ×1.1; pago lento (>30 días sin abonar
  con saldo) ×0.9; veto a los 60 días sin mover.
- **Cupón vencido**: un crédito que usó cupón y sigue con saldo pasada su `fecha_limite`
  castiga el DOBLE (×0.8, evento `cupon_vencido`) y reemplaza al pago lento en ESE crédito
  (no se suman). Es "el factor tiempo en contra": descuento + plazo incumplido no salen gratis.

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
- Catálogo PDF (`utils/catalogoPdf.ts`, jsPDF lazy-loaded): solo usuarios registrados,
  marca de agua, notas con colores. SEO: slugs generados de nombre (`toSlug`), no hay
  columna slug — se compara contra slug generado.

## Rendimiento (servidor económico: ahorrar llamadas y recursos)

- Frontend: `infrastructure/api/cachedFetch.ts` — caché en memoria 4 min + deduplicación
  de peticiones simultáneas. Ya lo usan lookups, combos, destacados y anuncios públicos.
  NO cachear: búsquedas/filtros, portal del usuario, dashboard admin.
- Backend: caché en memoria (`utils/cache.ts`) para catálogo y anuncios públicos;
  compression activo; imágenes con caché 30d immutable.
- Al agregar features: preguntar siempre "¿esto puede servirse del caché o generar en el
  navegador?" antes de crear endpoints nuevos.

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

## Cómo trabajamos (preferencias del dueño)

- Verificar visualmente con screenshots (Playwright + msedge headless) los cambios de UI;
  probar flujos E2E cuando tocan dinero (descuentos, cupones, ventas).
- Cerrar popups de anuncios en los screenshots (botón "Entendido").
- Antes de features de negocio: aterrizar el diseño en texto, dar opciones A/B/C con
  recomendación, y él decide. Le gusta entender el porqué (explicar como a un socio).
- Nada de datos inventados en la UI (tiempos de entrega, garantías): preguntar primero.
- Marketing/conversión: es tienda WhatsApp-first en LatAm; la fricción mínima y la
  confianza personal valen más que checkout tradicional.
