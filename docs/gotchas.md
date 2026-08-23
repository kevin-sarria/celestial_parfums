# Gotchas (dolores ya vividos — no repetirlos)

Cada uno de estos costó horas. Si un síntoma se parece, empieza por aquí antes de investigar.

## Encoding y archivos

- **TODOS los .ts/.tsx son UTF-8 sin BOM.** JAMÁS usar `Get-Content`/`Set-Content` de PowerShell
  sin encoding explícito sobre código fuente (corrompió todo el proyecto una vez:
  "Colección"→"ColecciÃ³n"). Para ediciones masivas usar
  `[System.IO.File]::ReadAllText/WriteAllText` con UTF8 sin BOM.
- **Cargar un .sql con tildes desde la consola de Windows los CORROMPE.** `mysql.exe <
  migracion.sql` sin `--default-character-set=utf8mb4` reinterpreta el archivo con el codepage de
  la consola: 'Clásica' se guardó como 'Cl├ísica' (bytes E2949C C3AD en vez de C3A1). Peor todavía,
  `-e "UPDATE … 'Clásica'"` las convierte en '?'. **Siempre**: escribir el .sql en UTF-8 y ejecutar
  `mysql.exe --default-character-set=utf8mb4 -u root base < archivo.sql`; verificar con `SELECT
  HEX(nombre)`. Ojo: esto es solo al aplicar SQL A MANO en local — `prisma migrate deploy` usa su
  propia conexión utf8mb4 y no tiene el problema.

## Fechas (bugs ya corregidos — no reintroducirlos)

- **Inicio de mes en las estadísticas**: las columnas `@db.Date` se leen como medianoche **UTC**.
  Armar el corte con `setHours(0,0,0,0)` da medianoche LOCAL (05:00 UTC en Colombia) y **todo lo
  del día 1 queda fuera del mes** (ventas, abonos y devoluciones). En `getVentaTotales` se
  construye con `new Date(Date.UTC(a, m, 1))`.
- Las fechas "de calendario" (`ventas.dia`, `creditos.fecha`, `pagos.dia`, `anuncios.inicio/fin`)
  son `@db.Date`: el backend las manda como AAAA-MM-DD. Formatearlas con `new Date(s)` las lee
  como medianoche UTC y en Colombia (UTC-5) mostraba **el día anterior** (una venta del 22 salía
  como 21). Usar `fmtDate` de `dashboard/helpers.ts`, que parte la cadena; para marcas de tiempo
  reales (`created_at`) usar `fmtInstante`.
- **`Intl.DateTimeFormat` necesita `timeZone: 'UTC'`** al formatear un mes construido con
  `Date.UTC`. Sin eso, el día 1 se corre al mes anterior y "agosto" se lee "julio".
- **NUNCA usar `toISOString()` para una fecha de calendario**: da la fecha **UTC**, así que
  pasadas las 7 p.m. en Colombia un archivo salía fechado un día después que su portada. Usar
  `hoyLocal()` (`getFullYear/getMonth/getDate`). **Tercera vez que este error aparece.**
- **Los anuncios se apagaban un día antes** (2026-08-22, corregido). `whereVigentes()` comparaba
  `fin >= new Date()`, o sea una fecha de CALENDARIO contra un INSTANTE. Como Prisma lee un
  `@db.Date` a medianoche UTC, una campaña "hasta el 22" moría a las **7:00 p.m. del 21 hora
  Colombia** — y arrancaba con la misma anticipación. No se detectó antes porque no falla nada:
  simplemente el popup deja de salir, en silencio. Se encontró midiendo, no leyendo: los 4
  anuncios del dueño estaban activos y con fecha del día, y `/api/anuncios` devolvía `[]`.
  **Cuarta vez que este error aparece**, así que ahora la regla vive en UN solo sitio:
  `utils/fechas.ts` → `hoyEnColombia()`, que devuelve el día de hoy como fecha de calendario a
  medianoche UTC, justo en la forma en que Prisma lee las columnas `@db.Date`. Tiene 7 pruebas de
  aritmética (`fechas.test.ts`) que fijan los bordes: 11:59 p.m. del 22 sigue siendo el 22, y a
  las 00:00 del 23 ya no. **Si aparece otra comparación de fechas con la base, usar ese ayudante**
  en vez de escribir la quinta versión — los cortes de `reporte.repository.ts`,
  `venta.repository.ts` y `devolucion.repository.ts` siguen con su solución propia y podrían
  adoptarlo el día que se toquen.

## Red y API

- **NADA de `PUT`**: el CORS del backend (`app.ts`) solo permite `['GET','POST','PATCH','DELETE']`.
  Un `PUT` desde el navegador muere en el **preflight** (`Method PUT is not allowed by
  Access-Control-Allow-Methods`) y el botón "no hace nada" — con `curl` sí funciona (curl no hace
  preflight), así que **probar solo por consola NO detecta el fallo**. Para reemplazar un conjunto
  completo, usar `PATCH`.
- **Toda vista que cargue datos debe usar try/catch/finally**: si la petición falla (429, sin
  conexión…), el `finally` apaga el spinner y se muestra un error con botón de reintentar. Sin eso
  la pantalla se queda "Cargando…" para siempre y parece que la app se colgó.
- **Ningún handler de mutación puede ignorar la respuesta.** Los tres `handleLookup*` de
  `DashboardPage` hacían `await guardedFetch(...)` **sin mirar `res.ok`**: si el backend rechazaba,
  no aparecía nada y nadie sabía por qué. Patrón obligatorio:
  ```ts
  const res = await guardedFetch(url, {...});
  if (!res.ok) { const j = await res.json().catch(() => null);
                 toast(j?.error ?? 'No se pudo guardar'); return; }
  ```
  Mostrar el mensaje que manda el backend: ya viene redactado en español y explica la causa.
- **Límite de 10 logins cada 15 min** (`authLimiter`): las pruebas que hacen login repetido se
  bloquean. Reiniciar el backend limpia el contador (está en memoria); mejor: un solo login por
  script y reusar la sesión.

## Un limitador mal calibrado se siente como "la web está lentísima"

La primera versión del `speedLimiter` (150 peticiones/15min, hasta 5s de retraso) castigaba al
propio dueño: una sesión de dashboard hace decenas de llamadas desde la misma IP → cada respuesta
tardaba **5 segundos exactos**.

- **Síntoma delator**: TODOS los endpoints tardan lo mismo y ese tiempo es justo el `maxDelayMs`.
  Confirmarlo mirando el header `RateLimit-Remaining`.
- Por eso el slow-down **NO aplica en desarrollo ni a usuarios con sesión**, y el admin está exento
  del limitador global. **Al tocar límites, pensar SIEMPRE en el admin trabajando, no solo en el
  bot.**

## Subir fotos desde el navegador (bug ya corregido)

`e.target.files` es un **FileList VIVO** del input. El patrón
`setFotos(f => [...f, ...Array.from(files)]); input.value = ''` **pierde las fotos**: el updater de
React se ejecuta después, y para entonces limpiar el input ya vació la lista. Hay que **copiar el
array ANTES** de llamar a `setState`. Estaba en los 3 subidores (reseñas, fotos de premio y
devoluciones); síntoma: se elige la foto, a veces se ve la miniatura, pero el POST viaja sin el
campo `imagenes`.

## Un componente declarado DENTRO de otro se remonta en cada tecla

Lo reportó el dueño en Pedido sugerido: *"al cambiar el número de ml de una esencia a pedir
hace como una recarga de página molesta"*. `ReposicionTab` declaraba `const Tabla = (...) => …`
**dentro** de su propio cuerpo y la pintaba como `<Tabla />`.

- En cada render del padre, `Tabla` es una **función nueva**. React compara por identidad de
  tipo, ve otro componente distinto y **desmonta y vuelve a montar todo el subárbol**.
- Síntoma exacto: se teclea "999" y queda el valor sugerido, porque el `<input>` se destruye a
  media escritura y el foco se pierde tras la primera pulsación. Medido: se escribía `999` y
  quedaba `200`.
- **Regla: un componente nunca se declara dentro de otro.** Si necesita datos del padre, se los
  pasa por props. La tabla salió a `reposicion/TablaPedido.tsx`.
- La prueba tiene que teclear **dígito a dígito** (`keyboard.type`), no `fill()`: con un solo
  evento de cambio el fallo no aparece. Cubierto por `pedidoSugerido.e2e.test.ts`.

## Guardar una ficha borraba los frascos armados (2026-08-14, ya corregido)

`editPerfume` rehacía los enlaces perfume→talla en cada guardado: `deleteMany` de todos y
`create` de los nuevos. Funcionó tres años porque esa fila solo llevaba un precio.

Desde que `perfume_presentacion` guarda también **el producto terminado** (`stock` y
`costo_promedio`), borrarla y recrearla significa que **cambiarle la descripción a un perfume le
borra los frascos que hay en la caja** — plata desapareciendo sin aviso y sin rastro.

- Ahora las tallas se **sincronizan**: `deleteMany` solo de las que se van y `upsert` de las que
  quedan, tocando únicamente los campos que manda el formulario.
- **Quitar una talla que todavía tiene frascos armados se RECHAZA** con un mensaje que dice
  cuántos hay. Dejarlo pasar tiraría a la basura producto que existe.
- Lección general: **cuando una tabla de enlace pasa a guardar inventario, todo `deleteMany` que
  la toque se vuelve destructivo.** Buscar quién más la rehace antes de agregarle una columna
  de stock. Cubierto por `perfume.edicion.bd.test.ts`.

## Selects con valores libres (bug ya corregido)

`ventas.presentacion` es TEXTO LIBRE (los Excel reales traen "30 ML" con espacio, "80 ML", "6 ML -
Perfumero Rec", "1 de 30 ml y 2 de 60 ml"). Estaba pintado con un `<select>` de lista quemada:
cuando el valor guardado no está entre las opciones, **el navegador muestra la PRIMERA y al guardar
pisa el dato original en silencio** — así se dañaron muchos registros. Ahora es `<input list=…>`
con `<datalist>`: sugiere sin encerrar. **Regla: un `<select>` solo sirve si el dato guardado
SIEMPRE está entre sus opciones.**

## El respaldo bajaba VACÍO — DOS causas (ya corregido)

- **Causa raíz**: se escuchaba `req.on('close')` para matar mysqldump si el cliente cancelaba, pero
  la PETICIÓN emite 'close' en cuanto termina de leerse su cuerpo (a los milisegundos). Se mataba
  el dump antes de que escribiera nada → salía por señal (código `null` en los logs de pm2) y el
  gzip se cerraba vacío. Ahora se escucha `res.on('close')` y solo se mata si `!res.writableEnded`.
  **Diagnóstico**: si `mysqldump` a mano funciona y el botón no, mirar el CÓDIGO en los logs —
  `null` = lo mataron, no falló.
- **Segunda causa (defensa en profundidad)**: la respuesta empezaba a enviarse en el evento
  `spawn`, antes de saber si mysqldump iba a funcionar. Cuando fallaba, el navegador recibía un
  `.gz` **válido y vacío de 20 bytes** — se ve como un respaldo y no tiene ni una tabla. Ahora **no
  se manda un solo byte hasta que mysqldump escupa el primero**, y si no produce datos responde 500
  con el stderr real. **Un respaldo que miente es peor que no tener respaldo.**

## El respaldo de producción no carga tal cual en XAMPP

MariaDB 10.11 escribe como PRIMERA línea del dump un `/*M!999999\- enable the sandbox mode */` y el
`mysql.exe` de XAMPP (más viejo) corta con `ERROR at line 1: Unknown command '\-'`. **No es
corrupción del respaldo**: se le quita esa línea (`tail -n +2 dump.sql > limpio.sql`) y carga
entero. Antes de creer que un respaldo vino malo, comprobar `gzip -t`, el número de `CREATE TABLE`
y que termine en `-- Dump completed on`. **Arreglado en el exportador** (2026-08-17,
`backup.router.ts`): ahora quita esa línea él mismo y entrega `.sql` sin comprimir, así que ya no
hace falta este paso a mano.

## Un `my.ini` suelto en el datadir rompía TODO comando `mysql.exe` local (2026-08-17)

Síntoma: hasta un `mysql -e "SELECT 1"` moría con
`unknown variable 'innodb_force_recovery=1'` — no era la consulta ni el respaldo, era que **el
cliente ni siquiera lograba arrancar**. Causa: quedó un `C:\xampp\mysql\data\my.ini` de 4 líneas
(seguramente de cuando se recuperó el crash de `prisma migrate diff` del 2026-08-14, ver más abajo)
con `innodb_force_recovery = 1` puesto bajo `[client]` — una variable que solo existe del lado
`[mysqld]`, así que romper ahí revienta cualquier cliente que lea ese archivo. **La base nunca
corrió en modo recuperación forzada** (`C:\xampp\mysql\bin\my.ini`, el que sí lee el servidor, no
tenía la línea) así que no hubo riesgo de datos — solo bloqueaba la terminal. Se movió a
`my.ini.bak-innodb-recovery` (no se borró) y los comandos volvieron a andar. Si `mysql.exe` da un
error de "unknown variable" que no tiene nada que ver con lo que pediste, sospechar de un archivo
de configuración suelto antes que de la base.

## `prisma migrate diff` REVIENTA el MySQL de XAMPP (2026-08-14)

Síntoma: `mysql.exe` conecta y responde perfecto, pero **Prisma no** (`P1001, Can't reach
database server`) — y a los segundos el servidor ya no está. Parece que la base está dañada.
No lo está.

- **Causa exacta**, leída del volcado en `mysql_error.log`: la consulta con la que Prisma lee
  el esquema mata al servidor. Es un `SELECT DISTINCT BINARY table_name … FROM
  information_schema.tables JOIN information_schema.columns ON BINARY …`, y en **MariaDB
  10.4.32** (la que trae XAMPP) provoca un **segfault**. El proceso sale con código **139**
  (128+11 = SIGSEGV) y deja un `mysqld.dmp` en `C:\xampp\mysql\data`.
- **Por eso el resto funciona**: las pruebas y la aplicación usan Prisma Client con consultas
  normales, que no tocan `information_schema` de esa forma. Solo revientan los comandos que
  INTROSPECCIONAN: `migrate diff --from-url`, `db pull` y `db push` contra esta base.
- **Producción no corre peligro**: allá es MariaDB 10.11.
- **Cómo verificar una migración sin `migrate diff`**: aplicarla sobre una copia real, comparar
  los conteos de filas antes y después, y revisar la estructura con `SHOW CREATE TABLE`. Es lo
  que se hizo con `20260814120000_producto_terminado`.
- **Las pruebas pueden dispararlo solas.** `prepararBase.ts` compara las migraciones aplicadas
  contra las carpetas del disco y, si no cuadran, **llama a `prisma migrate deploy`** — que es
  justo lo que tumba este MySQL. Por eso una migración aplicada a mano hay que **registrarla en
  `_prisma_migrations`** en las dos bases locales: si no, cada corrida de pruebas mata el servidor
  antes de empezar. Síntoma exacto (2026-08-22): `P1001` desde Prisma, o un `TRUNCATE` que muere
  con "Error in the underlying connector", y `mysqld` desaparecido sin escribir en el log. Se
  arranca otra vez (`mysqld.exe --defaults-file=C:\xampp\mysql\bin\my.ini --standalone`) y se
  sigue: hace *crash recovery* y las pruebas pasan.
- **No encadenar reintentos**: cada segfault es una muerte de golpe, y las muertes de golpe son
  justo lo que corrompe las tablas Aria del sistema (ver el apartado siguiente). Si Prisma no
  conecta, mirar primero si el servidor sigue vivo.

## "Todo el backend da error" tras trabajar en una migración (2026-08-14)

Síntoma: **cada endpoint del catálogo responde 400** con el mensaje genérico de `mensajeSeguro`
("No se pudo completar la operación"). Parece que se rompió media aplicación.

Causa real, con el error de Prisma en la mano:
`The column perfumes_db.perfume_presentacion.stock does not exist in the current database.`

- La migración se había aplicado a **`perfumes_test`** (para las pruebas) y a la copia de
  producción, pero **NO a `perfumes_db`**, que es a la que apunta el `.env` del dueño.
- Mientras el código no leía esas columnas, no se notaba. En cuanto `mapPerfume` pasó a mirar
  `stock` y `solo_armado`, **Prisma las pide en cada consulta** y todo el catálogo se cae de golpe.
- **Regla**: una migración que agregue columnas que el código lee SIEMPRE hay que aplicarla a las
  **tres** bases (test, la local del dueño y producción). Aplicar solo a `perfumes_test` deja un
  dev roto que parece un bug del código.
- El `mensajeSeguro` esconde la causa a propósito (está bien: no filtra la estructura de la base).
  Para ver el error de verdad, un `node` de dos líneas con `PrismaClient` contra la misma base
  dice exactamente qué columna falta.

### Aplicarla a mano en local (porque `migrate deploy` revienta el MySQL de XAMPP)

```bash
"C:/xampp/mysql/bin/mysql.exe" -u root --default-character-set=utf8mb4 perfumes_db \
  -e "source backend/prisma/migrations/<migracion>/migration.sql"
# y registrarla, o Prisma la creerá pendiente para siempre:
INSERT INTO perfumes_db._prisma_migrations
  (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
VALUES (UUID(), '<el checksum que ya tiene perfumes_test>', NOW(3), '<migracion>', NOW(3), 1);
```

## Consultar `information_schema` tumba el MySQL local

`SELECT ... FROM information_schema.columns WHERE TABLE_NAME='x'` (barrido de todos los esquemas)
y hasta un `SHOW COLUMNS FROM otra_base.tabla` **matan el servidor en el acto**: se pierde la
conexión y el proceso desaparece **sin escribir una línea** en `mysql_error.log`. Es la misma
causa por la que `prisma migrate diff` lo revienta (ver abajo).

- Para saber qué columnas tiene una tabla sin morir: `SELECT * FROM base.tabla LIMIT 1` — la
  cabecera del resultado las lista.
- Para comparar migraciones entre bases: `SELECT` normal sobre `_prisma_migrations`, que es una
  tabla corriente y no toca metadatos.
- Si se muere, arrancarlo otra vez es seguro: hace *crash recovery* y sigue. Pero cada muerte de
  golpe es una oportunidad de corromper las tablas Aria (ver abajo), así que no se hace a la
  ligera.

## MySQL de XAMPP que arranca y se muere a los segundos

**LA CAUSA RAÍZ ERA `innodb_log_file_size=5M`.** Reparar las tablas Aria era tratar el síntoma:
volvían a corromperse. El delator: el offset que fallaba, **5.275.648**, es exactamente **5 MB +
32 KB** — MySQL leía pasado el final de su registro, y leer más allá del final devuelve 0 bytes
(*"was only able to read 0"*). Por eso arrancaba bien y moría **al escribir**, y por eso salía el
MISMO offset en fechas distintas: es una constante de configuración, no un disco dañado al azar.
Cada muerte de golpe iba rompiendo las tablas de permisos.

- **Prueba controlada**: con la carpeta de datos limpia, cargar el dump **falló**; se cambió solo el
  tamaño a **128M** (y se borraron `ib_logfile0/1` para que los recree) y la misma carga **pasó
  completa**. Una sola variable de diferencia.
- **Antes de culpar al disco, mirar la aritmética del offset.** Se llegó a sospechar del SSD y de un
  evento de "disco extraído de forma imprevista" — que existía, pero era de OTRA unidad.
- **Daño colateral típico**: las tablas de PERMISOS de la base de sistema `mysql` (motor **Aria**,
  no InnoDB) se corrompen — `proxies_priv` inflada a 5,35 MB cuando pesa 8 KB, más `db` y
  `columns_priv`. El log de Windows (no `mysql_error.log`) dice `InnoDB: Tried to read 16384 bytes
  at offset N, but was only able to read 0`; el prefijo dice "InnoDB" pero el archivo era Aria.
- **Diagnóstico en 1 comando**: `mysqlcheck --all-databases --check`. Para aislar: arrancar con
  `--skip-grant-tables --port=3307`; si así SÍ vive, el problema son los permisos.
- **Arreglo**: `REPAIR TABLE mysql.db, mysql.columns_priv, mysql.proxies_priv, …` → `FLUSH
  PRIVILEGES`. Ojo: el reparador DESCARTA las filas ilegibles, así que hay que volver a otorgar lo
  que vivía ahí (se perdió el permiso de phpMyAdmin y se restauró con `GRANT … ON phpmyadmin.* TO
  'pma'@'localhost'`). `root` no se ve afectado: sus privilegios viven en `mysql.global_priv`.
- **Encenderlo sin el panel** (para no interrumpir al dueño cuando las pruebas avisan que MySQL
  está apagado):
  `Start-Process C:\xampp\mysql\bin\mysqld.exe -ArgumentList "--defaults-file=C:\xampp\mysql\bin\my.ini","--standalone"`.
  Para apagarlo, **`C:\xampp\mysql\bin\mysqladmin.exe -u root shutdown`** — nunca `Stop-Process`,
  por lo que dice el punto siguiente.
- **Prevención**: **detener MySQL siempre desde el panel de XAMPP** (o `mysqladmin shutdown`),
  nunca matando el proceso ni apagando Windows con MySQL prendido. Si hay que reconstruir, XAMPP
  trae una copia limpia del sistema en `C:\xampp\mysql\backup`. `REPAIR TABLE ... USE_FRM` rehace
  el índice de una tabla Aria cuando el normal se rinde.

## Otros

- **`prisma generate` falla con EPERM** si el dev server (ts-node-dev) está corriendo: tiene tomado
  `query_engine-windows.dll.node`. Detener node antes de compilar.
- **Puertos zombis locales**: si 4000/5173 quedan ocupados tras pruebas,
  `Get-NetTCPConnection -LocalPort N` → `Stop-Process`.
- **Clases Tailwind que "no aplican" en el navegador del dueño**: usar clases estándar; para
  restricciones críticas (max-height de dropdowns, paddings de íconos) preferir estilo inline.
  Pedirle Ctrl+Shift+R antes de perseguir fantasmas.
- **Al estilar una librería con Tailwind, comprobar el valor COMPUTADO** (`getComputedStyle`) en vez
  de confiar en que la clase se aplicó. En el toast, dos de tres ajustes no estaban haciendo nada.
- **`react-hooks/set-state-in-effect` analiza TODO el componente**: agregarle un `useState` de más
  hace que marque efectos que antes no marcaba, sin que nada esté mal.
- **`GET /api/parfums` sin paginar responde anidado** (`{ data: { data: [...] } }`); con `?page=`
  responde `{ data: [...], total }` y **limit tope 100**. Ese tope hizo que el catálogo PDF llevara
  **100 de 212 perfumes** y los otros 112 faltaran en silencio.
- **Una lista sin tope se prueba con los datos del día que funcione, no con los de hoy.** La banda
  de material bajo mínimo se escribió cuando solo 1 de 226 materiales lo tenía configurado; al
  configurarlos saltó a 55 renglones tapando la pantalla.
- **`INSERT ... SELECT * FROM (SELECT 'a','b',…) AS t`** usa los LITERALES como nombres de columna
  de la tabla derivada. Si un valor se repite, MySQL corta con **"Duplicate column name"** y la
  migración no corre. **Aliasea siempre cada columna** (`SELECT 'x' AS n, …`). Este fallo NO se ve
  con `prisma db push` (nunca ejecuta los .sql).
