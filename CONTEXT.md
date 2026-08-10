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
```

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

### Datos reales en la base local (= copia de producción)

| | |
|---|---|
| Perfumes | **212** (todos publicados) |
| Perfumes fabricados **sin esencia asignada** | **25** ⚠️ |
| Ventas / créditos / usuarios | 261 / 5 / 22 |
| Insumos (materiales) | 226 |
| Movimientos de inventario | 222 (**todos son ajustes de conteo**; aún no hay consumo real) |
| Recetas por tamaño | 5 |
| Tablas | 49 |

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

Vale la pena mirarlo al menos una vez: este proyecto tiene **histórico de `db push`**, así
que puede darse el caso de que el esquema esté correcto pero la tabla `_prisma_migrations`
no lo refleje. Saberlo evita que el siguiente `migrate deploy` falle por historial y que
alguien crea que falta algo cuando no falta.

**Antes de tocar producción: respaldo por SSH y verificar que el archivo pese MB, no bytes.**
(Hubo un bug grave en el que el respaldo bajaba vacío y parecía válido; está documentado.)

### Lo que quedó a medias y por qué

1. **25 perfumes fabricados sin esencia enlazada.** Es el pendiente más caro: un perfume sin
   esencia **no descuenta nada del inventario al venderse y su costo entra en CERO**, así
   que la ganancia del mes sale inflada. Ya existe la herramienta para arreglarlo
   (Inventario → banda ámbar → *Emparejarlas*), pero **las decisiones son del dueño**: hay
   4 casos ambiguos que solo él puede resolver (Good Girl / Good Girl Blush, Mercedes Club
   Black / Club Night, y los dos Valentino Donna).
2. **189 esencias sin género** y **todas las gamas con mínimo en 0**. No es un fallo: son
   datos que el dueño va a ir llenando. La forma rápida es el Excel (*Lista de materiales*).
3. **8 líneas de venta históricas sin talla** (ventas 1179, 1180, 1181, 1249, 1219). Solo
   el dueño sabe si fue el de 200 o el de 250 ml.
4. **Márgenes negativos en premium al mayoreo** (−56% a −87% con la lista de precios
   actual). Está medido y documentado; **falta que el dueño decida** qué hacer.
5. **El pedido sugerido no tiene consumo real todavía** porque no hay salidas registradas.
   Funciona con el mínimo configurado y lo avisa en pantalla.

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

En orden de valor para el negocio:

1. **Enlazar los 25 perfumes sin esencia** (con el dueño al lado para los 4 ambiguos). Es
   plata que se está perdiendo hoy en cada venta.
2. **Decidir con el dueño los precios premium al mayoreo** (hoy se vende a pérdida).
3. Configurar los mínimos por gama para que el *Pedido sugerido* empiece a servir.
4. Llenar el género de las esencias en bloque desde el Excel (*Lista de materiales*).

**Antes de escribir una línea de código, lee `CLAUDE.md` completo.** Está escrito para que
alguien que llega hoy entienda no solo qué hace el sistema, sino por qué está hecho así y
qué se intentó antes que no funcionó.
