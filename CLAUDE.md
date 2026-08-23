# Celestial Parfums — Contexto para Claude

E-commerce de perfumería (Colombia, COP) con pedidos por WhatsApp (sin pagos en línea).
Dueño: Kevin — no técnico; explícale en español claro, sin jerga, y dale los comandos listos.

> **¿Llegas nuevo?** `CONTEXT.md` es el mapa (cómo levantarlo, dónde está cada cosa, cómo se
> trabaja aquí) y está escrito para cualquier agente. Este archivo es la **memoria profunda**:
> las reglas que SIEMPRE aplican, más el índice de la documentación detallada en `docs/`.

## Stack (resumen)

- `backend/`: Express + TypeScript + Prisma 6 + MySQL. Build: `npm run build` → `dist/`.
- `frontend/`: React + Vite + Tailwind **v4** + shadcn. Build: `npm run build` → `dist/`.
- Auth: JWT en cookies, roles (ADMIN = rol 1), Google OAuth, reCAPTCHA en login/registro.
- Local: MySQL de XAMPP (`C:\xampp\mysql\bin\mysql.exe`, base `perfumes_db`, root sin password).
  Producción: MariaDB 10.11, base `celestial_db`, VPS Ubuntu detrás de Cloudflare.

## Documentación por temas (`docs/`)

**Lee el archivo que corresponda ANTES de tocar su área.** No están cargados
automáticamente: ábrelos con Read cuando el trabajo los toque.

| Archivo | Qué contiene | Léelo cuando… |
|---|---|---|
| [`docs/pendientes.md`](docs/pendientes.md) | Dónde quedamos, qué sigue, decisiones esperando al dueño | **Siempre al empezar una sesión** |
| [`docs/arquitectura.md`](docs/arquitectura.md) | Stack, páginas públicas, dashboard, `SmartTable`, notificaciones, reportes, import/export, rendimiento, seguridad | Toques estructura, rutas, endpoints o el dashboard |
| [`docs/diseno-ux.md`](docs/diseno-ux.md) | Design system, desplegables, modales, toasts, maquetación de pestañas, formularios | Toques cualquier pantalla |
| [`docs/reglas-negocio.md`](docs/reglas-negocio.md) | Precios, descuentos, combos, cupones, créditos, devoluciones y garantías, publicado/agotado, cupo, recompensas, reseñas, referidos | Toques dinero, catálogo o el portal del cliente |
| [`docs/inventario-costeo.md`](docs/inventario-costeo.md) | Costo promedio, compras, IVA por proveedor, esencias, gamas, consumo por venta, pedido sugerido, cotizaciones B2B | Toques inventario, costos o mayoreo |
| [`docs/pruebas.md`](docs/pruebas.md) | Cómo se prueba, la base `perfumes_test`, los recorridos en navegador | Escribas o corras pruebas |
| [`docs/deploy-migraciones.md`](docs/deploy-migraciones.md) | Runbook, entorno de producción, historial completo de migraciones | Vayas a desplegar o crear una migración |
| [`docs/gotchas.md`](docs/gotchas.md) | Dolores ya vividos: encoding, fechas, CORS, límites, MySQL, respaldos | Algo falle de forma rara — **empieza aquí** |
| [`docs/historial-cambios.md`](docs/historial-cambios.md) | Qué se construyó y en qué orden, y qué se probó y se descartó | Necesites saber por qué algo está como está |

## Skills del proyecto (leerlas antes de trabajar)

Viven en **`C:\Users\Estaduardo\.claude\skills\`** (fuera del repositorio). La ruta va completa a
propósito: **no las des por cargadas.** El dueño trabaja con una cuenta cuya configuración está en
`.claude-perfumeria\`, que **no tiene carpeta `skills\`** — así que no se activan solas ni se
pueden invocar escribiendo `/celestial-sistema`. **Ábrelas como archivos** (Read sobre su
`SKILL.md` y sus `references/`); funcionan igual de bien leídas que invocadas.

- **`celestial-sistema`** — skill BASE. Funciona como un comité de departamentos (Desarrollo, QA,
  Contabilidad, Legal, Diseño, Marketing, Viabilidad): antes de dar algo por terminado se pasa por
  los que apliquen. Contiene la **auditoría viva** (`references/auditoria.md`) y la referencia de
  **tributación colombiana**. Al aprender algo que sirva mañana, se AMPLÍA esa skill; no se crea
  otra.
- **`dashboard-interno-ux`** — método para rediseñar pantallas internas ya existentes.
- **`arranque-guiado`** — método para diseñar los primeros pasos de un módulo que no sirve hasta
  que alguien lo configura.
- **`catalogo-recompra`** — disponible en la misma carpeta.

Este `CLAUDE.md` y `docs/` guardan lo decidido en ESTE negocio y por qué; las skills guardan el
criterio general reutilizable.

## Reglas inquebrantables

### Código

- **Refactoriza SIEMPRE que se pueda**: extrae helpers, reutiliza lógica existente (no dupliques),
  y deja el código más limpio que como lo encontraste tras cada cambio.
- **Ningún archivo debería superar ~500 líneas.** Si crece de más, pártelo en piezas con una sola
  responsabilidad (hooks, componentes, helpers, servicios) antes de seguir agregándole.
- **Una regla vive en UN solo sitio.** Duplicarla garantiza que un día digan cosas distintas y
  nadie sepa cuál manda.
- **El cliente de Prisma se importa de `@prisma/client`**, nunca de una carpeta dentro de `src/`
  (rompe producción — ver `docs/arquitectura.md`).
- **NADA de `PUT`**: el CORS solo permite `GET/POST/PATCH/DELETE`. Un PUT muere en el preflight del
  navegador aunque con `curl` funcione.
- **Ningún handler de mutación puede ignorar la respuesta.** Nada de `if (!res.ok) return;` mudo:
  siempre mostrar el mensaje del servidor con un toast.
- **Un componente nunca se declara dentro de otro.** En cada render es una función nueva y
  React desmonta y vuelve a montar todo el subárbol: se pierde el foco y lo que el usuario
  estaba escribiendo. Si necesita datos del padre, se los pasa por props.
- **Toda vista que cargue datos usa try/catch/finally**, o la pantalla se queda en "Cargando…"
  para siempre cuando algo falla.
- **Nunca `res.json({ error: err.message })` directo**: usar `mensajeSeguro(err)`.
- **TODOS los .ts/.tsx son UTF-8 sin BOM.** Jamás `Get-Content`/`Set-Content` de PowerShell sin
  encoding explícito sobre código fuente.
- **Nunca `toISOString()` para una fecha de calendario** (da UTC y corre el día en Colombia).
- **Lo que se puede recalcular, se recalcula; no se guarda.** Sellos, cupo, promedios por gama,
  agotado automático, notificaciones y reportes salen del historial en cada consulta. Un valor
  guardado queda mintiendo el día que el dueño corrija un registro viejo.
- **No vuelvas a pedir lo que el servidor ya te devolvió**: actualiza el estado con la respuesta,
  o haz que el endpoint devuelva el estado nuevo.

### Diseño

- Paleta **marfil + iris**, tipografías Fraunces / Manrope, **solo modo claro**, estética sobria.
- **NINGÚN `<select>` de HTML en toda la aplicación**: `BuscadorSelect` para 6+ opciones o listas
  que crecen; `SelectSimple` para 2-5 opciones fijas. Es el fallo que más se repite.
- **Toasts con sonner**, nunca uno propio, nunca `richColors`. `window.alert()` está deprecado.
- **Ninguna pantalla se entrega sin abrirla en un navegador y mirarla**, y **midiendo en vez de
  opinando** — "quedó más compacto" no se verifica, "pasó de 55 renglones a 41 píxeles" sí.

### Negocio

- **Las reglas de negocio las decide el dueño.** No cambiar ninguna sin preguntarle.
- **Nada de datos inventados en la UI** (tiempos de entrega, garantías, plazos legales): preguntar
  primero.
- **Lo que toca dinero se verifica con números reales**, no con "debería funcionar".
- **Antes de medir contra los datos, pídele el respaldo de producción al dueño**: la base local se
  atrasa rápido.

## Cómo trabajamos (preferencias del dueño)

- Verificar visualmente con screenshots (Playwright + msedge headless) los cambios de UI; probar
  flujos E2E cuando tocan dinero (descuentos, cupones, ventas).
- Cerrar popups de anuncios en los screenshots (botón "Entendido").
- Antes de features de negocio: aterrizar el diseño en texto, dar opciones A/B/C con recomendación,
  y él decide. Le gusta entender el porqué (explicar como a un socio).
- Marketing/conversión: es tienda WhatsApp-first en LatAm; la fricción mínima y la confianza
  personal valen más que un checkout tradicional.
- **Los resúmenes van en TABLA y muy breves** (2026-08-23, pedido textual: *"estilo
  cavernícola"*). Solo tres cosas: **qué se hizo, qué falta, qué sigue**, una línea cada una, con
  su estado (hecho / por confirmar / pendiente). **Nada de 20 párrafos**: no le sirven para
  decidir. El porqué de cada decisión sigue yendo a `docs/` y al mensaje del commit —ahí SÍ se
  escribe completo—, no al chat. Si hay algo que él deba decidir, una línea con la pregunta.

## Comandos

```bash
# Pruebas
cd backend  && npm test              # aritmética + base de datos (~40 s)
cd backend  && npm run test:unidad   # solo aritmética, sin MySQL (~0,5 s)
cd backend  && npm run test:bd       # solo las que tocan base
cd backend  && npm run test:e2e      # recorridos en navegador (~35 s)
cd frontend && npm test

# Deploy (en el servidor) — detalle en docs/deploy-migraciones.md
cd /var/www/celestial-parfums && git pull
cd backend && npx prisma migrate deploy && npm run build && pm2 restart celestial-backend
cd ../frontend && npm run build
```

---

## Cómo mantener esta documentación

**El contexto nuevo va al archivo de `docs/` que le corresponda, NO a este archivo.**

- ¿Regla de negocio, cupón, precio, garantía? → `docs/reglas-negocio.md`
- ¿Inventario, costo, esencia, cotización? → `docs/inventario-costeo.md`
- ¿Pantalla, componente, estilo? → `docs/diseno-ux.md`
- ¿Endpoint, ruta, estructura, rendimiento? → `docs/arquitectura.md`
- ¿Migración o paso de deploy? → `docs/deploy-migraciones.md`
- ¿Error raro que costó horas encontrar? → `docs/gotchas.md`
- ¿Prueba nueva o cambio en cómo se prueba? → `docs/pruebas.md`
- ¿Terminaste algo o cambió lo que sigue? → `docs/pendientes.md` (y lo hecho baja a
  `docs/historial-cambios.md`)

**Este `CLAUDE.md` solo se actualiza si aparece una REGLA GENERAL nueva** (algo que hay que tener
en cuenta siempre, en cualquier parte del proyecto) o si se crea un archivo nuevo en `docs/` que
haya que agregar al índice.

Al escribir, **guarda el porqué, no solo el qué**: la decisión sin su razón se vuelve a discutir
en tres meses. Y si algo queda obsoleto, **bórralo o corrígelo** en vez de dejar dos versiones
contradictorias.
