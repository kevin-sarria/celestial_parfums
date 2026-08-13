# Celestial Parfums — Traspaso a un agente nuevo

Este documento es la **puerta de entrada**. Léelo entero antes de tocar nada y después lee
`CLAUDE.md`, que es la memoria profunda del proyecto (1.800+ líneas con las reglas de
negocio, el porqué de cada decisión y los errores ya vividos).

> **Los dos archivos NO se duplican y no deben duplicarse.**
> `CONTEXT.md` (este) = **dónde está todo, en qué estado y cómo se trabaja aquí**. Cambia poco.
> `CLAUDE.md` = **qué se decidió, por qué, y qué trampas hay**. Crece con cada cambio.
> Si aprendes algo reutilizable mañana, va a `CLAUDE.md`. Si cambia la forma de arrancar el
> proyecto o su estado general, va aquí.

Última actualización: **2026-08-10**.

---

## 1. Qué es esto y para quién

E-commerce de perfumería en **Colombia**, moneda **COP**. Los pedidos se cierran **por
WhatsApp**: no hay pasarela de pagos ni checkout en línea. La web enseña y convence; la
venta se cierra hablando.

Casi todo el catálogo son **contratipos** (fragancias inspiradas en marcas reconocidas, no
originales). Eso tiene consecuencias legales que ya están resueltas en la página `/legal` y
que **no hay que suavizar** sin hablarlo con el dueño.

### El dueño: Kevin

- **No es técnico.** Explícale en español claro, sin jerga, y dale los comandos listos para
  copiar y pegar.
- Piensa muy bien su negocio. Cuando dice *"esto está mal"*, casi siempre tiene razón
  aunque no use las palabras técnicas. **Escúchalo antes de defender tu diseño.**
- Quiere entender el **porqué**, como se lo explicarías a un socio. No le presentes menús
  de opciones neutras: dale una recomendación con su razón y deja que decida.
- **Odia los datos inventados.** Si no sabes un tiempo de entrega, una garantía o una cifra,
  pregúntale. No la rellenes.
- Antes de una función de negocio: aterriza el diseño en texto, da opciones con
  recomendación, y él decide.

---

## 2. Cómo levantar el proyecto

```bash
# Base de datos: MySQL de XAMPP en Windows
"C:/xampp/mysql/bin/mysqld.exe" --defaults-file=C:/xampp/mysql/bin/my.ini --standalone
# Base local: perfumes_db (usuario root, sin contraseña). Producción: celestial_db

# Backend  → http://localhost:4000
cd backend && npm install && npm run dev

# Frontend → http://localhost:5173
cd frontend && npm install && npm run dev
```

### Comprobaciones antes de decir que algo funciona

```bash
cd backend  && npx tsc --noEmit                      # tipos del backend
cd frontend && npx tsc --noEmit -p tsconfig.app.json # tipos del frontend
cd frontend && npx eslint src                        # LÍNEA BASE: 47 errores, 3 avisos

cd backend  && npm test                              # 72 pruebas (necesita MySQL)
cd backend  && npm run test:unidad                   # 43, sin MySQL, medio segundo
cd backend  && npm run test:e2e                      # 11 recorridos en navegador
cd frontend && npm test                              # 63 pruebas
```

Las que tocan base corren contra **`perfumes_test`**, que se arma sola desde las migraciones.
`perfumes_db` no se abre nunca — hay un seguro que lo impide. Detalle en `CLAUDE.md` →
"Pruebas automatizadas".

**Los 47 errores del linter son la línea base heredada, no los introdujiste tú.** Anota el
número antes de empezar y compruébalo al final: si sube, ensuciaste algo.

### Para probar de verdad (obligatorio antes de dar algo por terminado)

El dueño exige verificación **visual y con datos reales**, no "compila". El patrón que se
usa en este proyecto:

1. Comentar `RECAPTCHA_SECRET_KEY` en `backend/.env` (si no, no se puede hacer login).
2. Crear un admin temporal en la base:
   ```sql
   INSERT INTO users (nombre,apellido,email,password,rol_id,activo,updated_at)
   VALUES ('Prueba','Temporal','prueba.temp@celestial.local',
           '$2b$10$Q68WDb3TGqcx4/3Ehmumwuulx4KIHIp6tjood0g..pXxOwo28JavW',1,1,NOW(3));
   -- la contraseña es Prueba123!
   ```
3. Probar el flujo real en el navegador (Playwright con capturas).
4. **Revertir SIEMPRE**: borrar los datos de prueba, borrar el admin temporal y restaurar
   `.env`. Dejar la base como estaba.

> **La base local es una copia de PRODUCCIÓN.** Cualquier dato que crees y no borres es
> basura que el dueño verá el día del deploy. Revertir no es opcional.

---

## 3. El stack, en una página

| | Backend | Frontend |
|---|---|---|
| Base | Express + TypeScript | React 19 + Vite |
| Datos | Prisma 6 + MySQL (MariaDB en prod) | — |
| UI | — | Tailwind **v4** + shadcn |
| Build | `npm run build` → `dist/` | `npm run build` → `dist/` |
| Tamaño | ~131 archivos, ~13k líneas | ~197 archivos, ~27k líneas |

- **Auth**: JWT en cookies, roles (ADMIN = rol 1), Google OAuth, reCAPTCHA en login/registro.
- **El cliente de Prisma se importa de `@prisma/client`, NUNCA de una carpeta dentro de
  `src/`.** Con `output` apuntando a `src/` el proyecto funcionaba en local y **se rompía en
  el servidor**. Está explicado en `CLAUDE.md`; no lo revviertas.
- **Nada de `PUT`**: el CORS solo permite GET/POST/PATCH/DELETE. Un `PUT` muere en el
  preflight y el botón "no hace nada" — y con `curl` sí funciona, así que probar por consola
  no lo detecta.

### Mapa rápido del código

```
backend/src/
  routes/          # rutas Express, delgadas
  controller/      # try/catch + mensajeSeguro(err)  ← nunca exponer el error crudo
  services/        # orquestación + caché
  repositories/    # TODO el acceso a datos y las reglas de negocio duras
  schemas/         # Zod. La validación de verdad vive aquí
  utils/           # imágenes, uploads, TOTP, errores seguros
frontend/src/
  pages/dashboard/ # el panel del admin (lo más grande del proyecto)
  components/      # UI compartida (SmartTable, BuscadorSelect, Modal…)
  application/     # motores puros y contextos (costeo, carrito)
  domain/entities/ # tipos y esquemas Zod compartidos
```

---

## 4. Estado actual del proyecto

### Datos reales de PRODUCCIÓN (respaldo del 2026-08-11)

| | |
|---|---|
| Perfumes | **222** (2 despublicados) |
| Perfumes fabricados **sin esencia asignada** | **0** ✅ |
| Ventas / créditos / usuarios | 269 / 5 / 28 |
| Insumos (materiales) | 232 |
| Movimientos de inventario | 270 (223 ajustes · 12 de compra · 35 de venta) |
| Líneas de venta | 464 (12 sin talla) |
| Recetas por tamaño | 5 |
| Tablas | 49 |

> **La base local se atrasa rápido.** El 2026-08-11 iba una semana por detrás y reportaba
> como rotos cuatro pendientes que el dueño ya había cerrado en producción. **Pídele el
> respaldo antes de medir nada.** Para cargarlo: descomprimir, **quitar la primera línea**
> (los MariaDB nuevos escriben un `/*M!999999\- ...*/` que el cliente de XAMPP rechaza con
> `Unknown command '\-'`) y cargar con `mysql --default-character-set=utf8mb4`.

### Git

**Todo está subido a GitHub** (`origin/main`, repo `kevin-sarria/celestial_parfums`).
Verificado con `git ls-remote`. No hay trabajo local sin respaldar.

### Producción

**El dueño confirmó el 2026-08-10 que el servidor ya está al día**: las migraciones están
aplicadas y el despliegue hecho. (Dato del dueño, que es quien tiene el acceso SSH; desde el
entorno de desarrollo no se puede comprobar.)

Todas esas migraciones se probaron antes **en orden sobre una copia real de producción, sin
perder una sola fila**. Ese sigue siendo el orden correcto si alguna vez hay que rehacerlo.

Para quitar cualquier duda sobre qué hay aplicado de verdad, en el servidor:

```bash
cd /var/www/celestial-parfums/backend && npx prisma migrate status
```

**Duda resuelta el 2026-08-11**: se cargó el respaldo de producción en local y
`npx prisma migrate status` respondió **"48 migrations found — Database schema is up to
date!"**. O sea que el histórico de `db push` NO dejó deuda: `_prisma_migrations` refleja
la realidad y el próximo `migrate deploy` no va a fallar por historial. Si alguna vez
vuelve a haber dudas, esta es la comprobación (y ya no hace falta el SSH: basta cargar el
respaldo en local y correrla ahí).

**Antes de tocar producción: respaldo por SSH y verificar que el archivo pese MB, no bytes.**
(Hubo un bug grave en el que el respaldo bajaba vacío y parecía válido; está documentado.)

### Lo que quedó a medias y por qué

**El grueso se cerró entre el 10 y el 11 de agosto** y lo cerró el dueño a mano: ya no
quedan perfumes sin esencia (eran 25), las 4 gamas tienen su mínimo, el género de las
esencias está lleno salvo 3, y **el sistema empezó a moverse solo**: 12 líneas de compra
alimentando el costo promedio y 2 ventas que descontaron material y congelaron su costo
($34.582 y $22.105). Lo que sigue abierto:

1. **12 líneas de venta sin talla**, de las cuales **4 son rellenables**: las ventas 1269
   ("30ML") y 1272 ("50ML") dicen la talla sin ambigüedad en el texto de la venta, pero sus
   líneas quedaron sin el número — cayeron en el hueco entre la migración que rellenó las
   históricas y el despliegue del consumo. Las otras 8 (ventas 1179, 1180, 1181, 1249 y
   1219) son ambiguas de verdad y solo el dueño sabe si fue el de 200 o el de 250 ml.
   **Rellenar la talla NO recupera el descuento de inventario** (el consumo no es
   retroactivo, por diseño): sirve para que el histórico quede completo.
2. **3 esencias sin género** (eran 189). Se llenan desde el Excel *Lista de materiales*.
3. **Los precios premium al mayoreo se venden por debajo del costo** (−56% a −87%).
   **Decidido el 2026-08-11: se mantienen así por ahora.** No es un pendiente, es un
   riesgo aceptado a conciencia — las clásicas y las árabes lo subsidian. Se vuelve a
   plantear solo si sube la esencia premium o si llega un mayorista que pida casi puro
   premium.
4. La gama **"Diseñador" tiene mínimo configurado y cero esencias**: o se le cuelgan
   esencias o se borra.

---

## 5. Cómo se trabaja en este proyecto

Estas no son preferencias de estilo: son reglas que nacieron de errores concretos que
costaron tiempo o dinero. Cada una está explicada con su caso real en `CLAUDE.md`.

### Reglas de código

- **Refactoriza siempre que puedas.** Extrae helpers, reutiliza lo que ya existe, deja el
  código más limpio de como lo encontraste.
- **Ningún archivo debería pasar de ~500 líneas.** Si crece, pártelo por responsabilidad
  antes de seguir agregándole.
- **Ningún handler de mutación puede ignorar la respuesta.** Nada de `if (!res.ok) return;`
  mudo: el dueño no mira la consola. Toast con el mensaje del servidor.
- **Jamás `res.json({ error: err.message })`**: usa `mensajeSeguro(err)`. Un error de Prisma
  filtra rutas de archivos y el host de la base.
- **`toISOString()` NUNCA para una fecha de calendario.** Da la fecha UTC y en Colombia
  (UTC-5) corre el día. Este error ha aparecido **tres veces** en el proyecto.
- **`@container`, no `sm:`, dentro de modales y tarjetas.** Los prefijos de Tailwind miden
  la VENTANA, y un modal mide 540 px aunque la pantalla tenga 1400.
- **Ningún desplegable de lista larga puede ser un `<select>` nativo.** 6+ opciones o una
  lista que crece → `BuscadorSelect`. 2-5 fijas → `NativeSelect`.

### El estándar de "terminado"

> **Compilar no es funcionar.** El dueño detecta la diferencia y la señala.

Antes de decir que algo quedó listo:
1. Probar el caso real **con datos reales**, no inventados.
2. Probar lo que puede salir mal (el duplicado, el valor vacío, el permiso que falta).
3. Mirar la pantalla con capturas.
4. **Decir explícitamente qué NO verificaste** y por qué.

**Un campo nuevo de un insumo no está terminado hasta que viaja por el Excel.** El dueño
trabaja en cantidad desde ahí; ponerlo solo en un formulario lo deja inservible. (Esta regla
nació de fallar exactamente así, dos veces seguidas.)

### Lo que se mide, no se supone

Buena parte de las mejores decisiones de este proyecto salieron de mirar los datos primero:
descubrir que **solo hay 7 precios distintos** entre 216 esencias validó todo el sistema de
gamas; descubrir que **solo 27 de 216 esencias dicen el género en el nombre** justificó
crear la columna; descubrir que **1 de 226 materiales tenía mínimo configurado** explicó por
qué la alerta de stock no se usaba. **Consulta la base antes de diseñar.**

---

## 6. Las trampas que más muerden

Están todas detalladas en `CLAUDE.md`, pero estas son las que se repiten:

| Trampa | Síntoma | Dónde |
|---|---|---|
| Cargar `.sql` con tildes en Windows | 'Clásica' se guarda como 'Cl├ísica' | Usar `mysql --default-character-set=utf8mb4` |
| Encoding de PowerShell sobre código | "Colección" → "ColecciÃ³n" | Nunca `Get-Content`/`Set-Content` sin encoding |
| `prisma generate` con el dev server vivo | `EPERM` | Detener node antes |
| Límite de 10 logins / 15 min | Las pruebas E2E se bloquean | Un solo login y reusar sesión |
| MySQL de XAMPP que muere a los segundos | Tablas de permisos corruptas | `mysqlcheck --all-databases` |
| Filtrar sin decir qué se excluye | El PDF salió con 100 de 212 en silencio | **Siempre** decir cuántos y por qué |

---

## 7. Skills y documentos de apoyo

En `~/.claude/skills/` (fuera del repositorio, en la máquina del dueño) viven tres métodos
reutilizables. **Si trabajas desde otro entorno puede que no los tengas**; el criterio que
contienen está resumido en `CLAUDE.md`:

- **`celestial-sistema`** — comité de departamentos (desarrollo, QA, contabilidad, legal,
  diseño, marketing, viabilidad) + tributación colombiana (IVA, DIAN, POS).
- **`dashboard-interno-ux`** — método para rediseñar pantallas internas.
- **`arranque-guiado`** — método para módulos que no sirven hasta que alguien los configura.

Diseños y planes históricos: `docs/superpowers/specs/` y `docs/superpowers/plans/`.

---

## 8. Por dónde empezar mañana

> Actualizado el **2026-08-12**. Lo que decía antes (enlazar 25 perfumes sin esencia,
> configurar los mínimos por gama) **ya está hecho** — el dueño lo cerró el 10 y 11 de
> agosto. Si esta sección manda a hacer algo que ya funciona, es que se quedó vieja otra vez:
> compruébalo contra la sección 4 antes de trabajar.

En orden de valor para el negocio:

1. **Decidir el caso de borde del costo promedio** (lo único que dejó abierto la ola 2 de
   pruebas). Al borrar la única compra de un material, su costo se queda en el de la compra
   borrada en vez de volver al de partida. Arreglarlo exige una columna nueva
   (`precio_inicial`) y su migración, así que es decisión del dueño. Está medido y con dos
   pruebas puestas: ver `CLAUDE.md` → "Inventario y costo promedio".
   **Las dos olas de pruebas YA ESTÁN** (146 en total: aritmética, base de datos y cuatro
   recorridos en navegador). Lo que falta es cobertura de más módulos, no montar nada.
2. **Rellenar la talla de las 4 líneas de venta que sí se pueden** (ventas 1269 y 1272). Las
   otras 8 son ambiguas y solo el dueño sabe si fue el de 200 o el de 250 ml.
3. **3 esencias sin género** (eran 189). Se llenan desde el Excel *Lista de materiales*.
4. **La gama "Diseñador" tiene mínimo configurado y cero esencias**: o se le cuelgan esencias
   o se borra.
5. **Paso 3 del costeo por gama**: separar la pantalla — la receta se queda en *Tamaños y
   fórmulas* y los rangos de precio mayorista se van a *Mayoreo*. Hoy `formulas_volumen`
   mezcla tres cosas.

**Antes de escribir una línea de código, lee `CLAUDE.md` completo.** Está escrito para que
alguien que llega hoy entienda no solo qué hace el sistema, sino por qué está hecho así y
qué se intentó antes que no funcionó.
