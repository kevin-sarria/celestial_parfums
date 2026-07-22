# Celestial Parfums — Contexto para Claude

E-commerce de perfumería (Colombia, COP) con pedidos por WhatsApp (sin pagos en línea).
Dueño: Kevin — no técnico; explícale en español claro, sin jerga, y dale los comandos listos.

**Mantén este archivo actualizado**: cada vez que hagas un cambio relevante (regla de
negocio, migración, convención nueva, gotcha descubierto) agrégalo aquí en la sección
que corresponda. Este documento es la memoria del proyecto entre sesiones y modelos.

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

### Matcher de perfumes (`backend/src/utils/perfumeMatcher.ts`)
- Conservador: solo enlaza con candidato ÚNICO; ambigüedad = sin enlazar (fallo barato).
- Alias (`one`→`1`, `aqua`→`acqua`) y tolerancia a typos de 1 letra SOLO en palabras de 5+.
- Con separadores (,;+/" y ") se enlaza cada parte; el texto completo es plan B.
- Tests de casos reales: correr el matcher contra "One Million" debe dar vacío (ambiguo),
  nunca enlazar al Elixir.

### Otros
- "NUEVO" en cards: automático, perfumes con <30 días (`NUEVO_DIAS` en perfume.repository).
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

## Cómo trabajamos (preferencias del dueño)

- Verificar visualmente con screenshots (Playwright + msedge headless) los cambios de UI;
  probar flujos E2E cuando tocan dinero (descuentos, cupones, ventas).
- Cerrar popups de anuncios en los screenshots (botón "Entendido").
- Antes de features de negocio: aterrizar el diseño en texto, dar opciones A/B/C con
  recomendación, y él decide. Le gusta entender el porqué (explicar como a un socio).
- Nada de datos inventados en la UI (tiempos de entrega, garantías): preguntar primero.
- Marketing/conversión: es tienda WhatsApp-first en LatAm; la fricción mínima y la
  confianza personal valen más que checkout tradicional.
