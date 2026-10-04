# Cómo pensar aquí — guía práctica para cualquier IA que trabaje en Celestial Parfums

> **Para quién:** cualquier agente (Claude, otra IA, otra sesión) que vaya a tocar este proyecto.
> **Qué es:** el criterio. `CONTEXT.md` te dice cómo levantar el proyecto y dónde está cada cosa;
> `CLAUDE.md`, las reglas que no se rompen. Esto te dice **cómo decidir** cuando ninguna de las dos
> responde tu duda. Salió de errores reales de este proyecto, no de teoría.
>
> **Si solo lees una cosa:** *el dueño decide el negocio; tú decides cómo se construye; nada está
> terminado hasta que lo viste funcionar con datos reales; y lo que aprendiste se escribe.*

---

## 1. Quién es el cliente y qué espera

- **Kevin, el dueño, no es técnico.** Vende perfumes por WhatsApp y TikTok, en Colombia, en pesos.
  Usa el panel desde el computador y desde el celular, a veces en el mostrador.
- Háblale **en español claro, sin jerga**. "La lista de clientes", no "el componente de tabla".
  "Si el servidor rechaza el nombre, no te enteras", no "falta manejo de errores".
- **Resúmenes en tabla y cortos**: qué se hizo, qué falta, qué sigue. El porqué largo va a `docs/` y
  al mensaje del commit, no al chat.
- **Él es tu socio, no tu jefe de QA.** No le pidas que pruebe lo que tú puedes probar. Muéstrale el
  resultado ya verificado.

## 2. La regla que separa un buen trabajo de uno malo: quién decide qué

| Lo decide **el dueño** | Lo decides **tú** |
|---|---|
| Precios, márgenes, descuentos, cupones, combos | Cómo se estructura el código |
| Qué lleva cada venta (empaque, regalos) | Qué archivos crear, cómo nombrar funciones |
| Qué ve el cliente en la tienda | Cómo probarlo |
| Plazos, garantías, textos legales | Cómo arreglar un error que rompe una regla ya decidida |
| Qué se publica en la tienda y qué no | El diseño visual dentro del sistema de diseño existente |
| Prioridades: qué va primero | El orden técnico dentro de una tarea |

**Cuando la decisión es suya:** no adivines. Dale **opciones concretas (A/B/C) con tu
recomendación y el porqué**, con números de su negocio. Él elige. Usa una pregunta por decisión;
si son varias e independientes, júntalas en una sola tanda para no frenarlo.

**Cuando es tuya:** no le preguntes. Decide, hazlo bien y cuéntaselo en una línea.

**Zona gris:** si un arreglo técnico cambia lo que ve el cliente o lo que cuesta algo, pregunta.
Ejemplo real: un decant salía al precio de la botella. Era un error que contradecía una decisión
suya ya tomada, así que se arregló sin preguntar y se le avisó.

## 3. Antes de escribir código

1. **Lee `docs/pendientes.md`** y el `docs/` del área que vas a tocar (`CLAUDE.md` tiene el índice).
2. **Mira los datos reales**, no los de prueba. Hay respaldos de producción en la base local
   (`celestial_prod_AAAAMMDD`). Un "¿cuántas filas tendrá esto?" respondido con un número cambia el
   diseño. Ejemplos reales:
   - Antes de diseñar el empaque se midió que las 22 excepciones eran todas "1.1 sin nada", y eso
     simplificó todo.
   - Antes de publicar las alertas por velocidad se midió que habrían salido 7 avisos falsos, y se
     ajustó la regla.
3. **Busca si ya existe.** Este proyecto ya tiene casi todas las piezas: la línea de un producto
   (`lineaDe`), la tabla compartida (`SmartTable`), los avisos (`sonner`), la detección de combos, el
   costo de una talla. **Antes de crear algo, busca con grep.** Duplicar una regla garantiza que un
   día digan cosas distintas.
4. **Si es grande, pártelo.** "Rediseña el núcleo" no es una tarea; son 4 proyectos, cada uno con su
   diseño, su aprobación y su entrega. Propón el orden y explica por qué ese orden.
5. **Escribe el diseño antes del código** (`docs/superpowers/specs/AAAA-MM-DD-tema-design.md`), con
   las decisiones del dueño citadas tal cual. Cuando el trabajo se retome en otra sesión, ahí está
   todo.

## 4. Mientras construyes

- **Una regla vive en un solo sitio.** Si la pantalla y el servidor necesitan la misma cuenta,
  calcúlala en el servidor y pídela, o cópiala con un comentario en las dos copias y la misma prueba
  en las dos (así se hizo con la detección de combos y el empaque).
- **Lo que se puede recalcular, no se guarda.** Un valor guardado miente el día que alguien corrige
  un registro viejo.
- **Las cifras históricas no se reescriben.** Una venta de marzo conserva su costo de marzo.
- **Toda pantalla nueva del panel se diseña con la skill `dashboard-interno-ux`**
  (`C:\Users\Estaduardo\.claude\skills\dashboard-interno-ux\`). Pregúntate siempre: *¿cuántas filas
  tendrá esto el día que esté bien usado?*
  - Si la respuesta es "muchas", va en la `SmartTable` paginada, con buscador, filtros y tarjeta en
    el celular. **Nunca una lista que crece sin tope.**
  - Esto ya se aprendió por las malas: el dueño rechazó una pantalla que pintaba una tarjeta por
    perfume (*"imagínate cuando tenga más de 100"*).
- **Las acciones en bloque no hacen lo peligroso.** El botón que pone precios a todos nunca **baja**
  un precio; eso se hace de a uno, a conciencia.
- **Ningún error se traga.** Toda acción que guarda muestra el mensaje del servidor si falla.
- **No mezcles tareas.** Si ves una mejora que nadie pidió, **anótala y propónla aparte**. No la
  metas en el mismo cambio, y menos si toca la tienda pública.
- **Si renombras algo que vive en una URL o en la base, piensa en lo viejo**: enlaces guardados,
  datos existentes, pestañas abiertas con la versión anterior.
- **Al reescribir algo compartido (la URL, un objeto, una lista), conserva lo que no es tuyo.**
  Error real: reescribir la dirección desde cero borraba las marcas de TikTok.

## 5. Cuándo algo está "terminado"

No está terminado cuando compila. Está terminado cuando cumple **todo** esto:

- [ ] Pruebas que fijan la regla nueva, y que **fallarían sin tu cambio**. Si puedes, compruébalo
      deshaciendo el arreglo un momento.
- [ ] `npm test` en backend y frontend en verde, y `tsc` sin errores.
- [ ] Los e2e de lo que tocaste, corridos. Si la corrida completa falla en sitios que no tocaste,
      córrelos solos antes de culpar o descartar.
- [ ] **La pantalla abierta en un navegador y mirada**, a 1366 px y a 390 px (celular). Mide en vez
      de opinar: "no se sale de 390 px", no "se ve bien".
- [ ] Si toca plata: verificado con números reales (por ejemplo, "un decant de 5 ml de una botella de
      $200.000 cuesta $15.500").
- [ ] **Las pruebas prueban la decisión, no el comportamiento viejo.** Si el diseño dice "la pestaña
      abre su tipo ya elegido" y tu prueba todavía elige el tipo a mano, la prueba te miente.
- [ ] Documentado: el porqué en `docs/`, lo hecho en `pendientes.md`, la migración en
      `deploy-migraciones.md`.
- [ ] Commit con un mensaje que explique el porqué, push y **despliegue comprobado en vivo** (que la
      tienda devuelva lo nuevo, que lo privado responda 401).

Si algo de la lista no se pudo hacer, **dilo explícitamente**. "Compila pero no lo vi en pantalla"
es honesto; "quedó listo" sin haberlo visto destruye la confianza.

## 6. Lo que NUNCA se hace

- Cambiar una regla de negocio sin preguntar.
- Inventar datos en la interfaz: tiempos de entrega, garantías, plazos.
- Mostrarle costos o márgenes a quien no es el dueño (ni a un visitante, ni a un empleado sin
  permiso).
- Correr `migrate dev` en el servidor, editar archivos o hacer commit en el servidor, o un
  `git pull` a mano allá. El despliegue es automático con cada push a `main`.
- Pegar secretos o llaves en el chat. Van solo en GitHub.
- Saltarse el reCAPTCHA o los hooks de git.
- Borrar o reescribir datos de producción sin respaldo. El despliegue saca uno antes de migrar;
  verifica que siga así.
- Dejar el trabajo a medias sin decirlo: sin commit, sin verificar, sin anotar en `pendientes.md`
  qué falta.

## 7. Cuando revises el trabajo de otro (u otra IA)

1. `git status` y `git diff`: qué cambió **de verdad**, no lo que dice el resumen.
2. Lee el diseño y compara **cada decisión** con el código. Las decisiones "aceptadas" que no se
   implementaron son el fallo más común.
3. Busca lo que se salió del alcance.
4. Corre todo y mira las pantallas.
5. Corrige, documenta qué se corrigió y por qué (en la spec, sección "Revisión") y publica.
6. Al dueño, en una tabla: qué estaba bien, qué estaba mal y qué se arregló. Lo que se salió del
   alcance se le pregunta antes de publicarlo.

## 8. Cuando algo falla raro

1. **`docs/gotchas.md` primero.** Probablemente ya pasó: encoding, fechas en UTC, la caché del
   catálogo de 5 minutos, roles en memoria, MySQL de XAMPP que no arranca.
2. Reproduce el fallo con una prueba **antes** de arreglarlo.
3. Busca la **causa raíz**, no el síntoma. Si el mismo error aparece en 7 tablas, el arreglo va en
   el sitio que comparten.
4. Cuando lo resuelvas y te haya costado, **escríbelo en `gotchas.md`** con el porqué.

## 9. Cómo se entrega

Al dueño, siempre en este orden:

1. Qué quedó, en una tabla corta con su estado (✅ hecho · ⏳ falta · 📋 pendiente).
2. Un ejemplo con sus números, si toca plata.
3. Lo que **él** tiene que hacer, si algo, paso a paso y con el nombre exacto del botón o la
   pantalla.
4. **Una** pregunta si hay una decisión suya pendiente, con opciones y tu recomendación.

## 10. Para que el equipo mejore con el tiempo

- **Lo que aprendiste hoy y sirve mañana se escribe**, en el sitio que le corresponde (ver
  "Cómo mantener esta documentación" en `CLAUDE.md`). Una corrección del dueño que no se escribe se
  repite en tres meses.
- **Si algo de esta guía resultó equivocado, corrígelo aquí mismo**, con fecha y razón. Esta guía es
  del equipo, no de quien la escribió.
- **Deja el código mejor que como lo encontraste**: si tocas un archivo de más de ~500 líneas,
  pártelo; si ves la misma lógica dos veces, únela.

---

*Escrita el 2026-10-04 al cerrar el rediseño del núcleo (empaque, precios de originales, alertas por
velocidad, catálogo por línea), a partir de lo que funcionó y de los errores que hubo que corregir.*
