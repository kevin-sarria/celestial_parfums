# Deploy, servidor y migraciones

> ## ⚠️ En el servidor: `migrate deploy`, NUNCA `migrate dev`
>
> Se parecen y hacen cosas opuestas. **`migrate dev` propone borrar la base entera** cuando algo no
> cuadra ("You may use prisma migrate reset… All data will be lost"). Pasó el 2026-08-29 en
> producción; no se aceptó, pero faltó un enter. **`migrate deploy` solo aplica lo que falta y
> nunca borra nada.**
>
> Hay un freno de mano (`backend/scripts/solo-base-local.cjs`): `npm run prisma:migrate` se niega a
> correr si la base es `celestial_db`. El detalle en [`gotchas.md`](gotchas.md).
>
> **El orden es obligatorio**: `git pull` → **`migrate deploy`** → `npm run build` → `pm2 restart`
> → **build del frontend**. Subir código sin su migración deja el sistema PEOR que sin desplegar
> (ver el recuadro de más abajo), y saltarse el build del frontend deja al dueño mirando la versión
> vieja mientras todo parece correcto.

## Despliegue automático (GitHub Actions, desde el 2026-10-02)

**Decisión del dueño: opción B.** Cada push a `main` corre todas las pruebas en GitHub (backend
contra MariaDB 10.11 como producción, frontend con lint, pruebas y build) y, **solo si pasan**,
despliega. Si una prueba falla, producción no se toca. También hay un botón "Run workflow" en la
pestaña Actions para volver a desplegar sin subir nada.

Piezas:

| Archivo | Qué hace |
|---|---|
| `.github/workflows/desplegar.yml` | Pruebas → si pasan, SSH al servidor → comprueba que la tienda responde |
| `deploy/celestial-desplegar` | La puerta, instalada en `/usr/local/bin`. Un despliegue a la vez (`flock`), `git merge --ff-only` y llama al script del repo. Vive fuera del repo porque un script que se reescribe mientras corre ejecuta pedazos del viejo y del nuevo |
| `deploy/desplegar.sh` | El runbook de abajo hecho script: **respaldo** (`/root/respaldos-deploy`, se queda con 20, aborta si pesa menos de 50 KB) → `npm ci` solo si cambió el lock → `migrate deploy` → build → `pm2 restart` → espera a que el backend responda → build del frontend en `dist-nuevo` y cambio de golpe (si el build muere, la tienda sigue con el anterior). Bitácora en `/var/log/celestial-deploy.log` |

**Seguridad: entra como root (decisión del dueño), pero la llave de GitHub solo puede desplegar.**
En `authorized_keys` va con `command="/usr/local/bin/celestial-desplegar",restrict`: el servidor
ignora lo que pida GitHub y ejecuta solo eso, sin terminal ni túneles. Si la llave se filtrara, lo
único que alguien podría hacer es desplegar lo que ya está en `main`. `SSH_KNOWN_HOSTS` fija la
huella del servidor: sin ella, cualquiera que se hiciera pasar por él recibiría la conexión.

### Instalarlo (una sola vez)

**En el servidor**, como root (reemplaza `TU_IP` por la IP del VPS y `22` si usas otro puerto):

```bash
cd /var/www/celestial-parfums && git pull
install -m 755 deploy/celestial-desplegar /usr/local/bin/celestial-desplegar

# Llave SOLO para GitHub, amarrada al despliegue
ssh-keygen -t ed25519 -N "" -C "github-despliegue" -f /root/llave-github
echo "command=\"/usr/local/bin/celestial-desplegar\",restrict $(cat /root/llave-github.pub)" >> /root/.ssh/authorized_keys

# Esto es lo que va en el secreto SSH_PRIVATE_KEY (todo, con BEGIN y END)
cat /root/llave-github

# Esto va en SSH_KNOWN_HOSTS (con puerto distinto de 22 se escribe [TU_IP]:PUERTO)
for f in /etc/ssh/ssh_host_*_key.pub; do echo "TU_IP $(cut -d' ' -f1,2 "$f")"; done

# Ya copiada a GitHub, la privada no tiene por qué quedarse en el servidor
rm /root/llave-github /root/llave-github.pub
```

**En GitHub**: el repositorio → Settings → Environments → New environment → `produccion` →
Add environment secret, uno por uno: `SSH_HOST` (la IP, **no** el dominio: Cloudflare no deja
pasar SSH), `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS` y, si el puerto no es 22, `SSH_PORT`.

**Probarlo**: pestaña Actions → "Pruebas y despliegue" → Run workflow. Mientras falten los
secretos, el paso de desplegar sale en rojo con el aviso "Faltan los secretos"; las pruebas corren
igual.

**Si un despliegue sale en rojo**: el registro de Actions dice en qué paso se detuvo, y en el
servidor está entero en `/var/log/celestial-deploy.log`. Lo de antes de ese paso ya se aplicó; el
respaldo de la base está en `/root/respaldos-deploy/`. Si fue el `--ff-only`, alguien editó
archivos a mano en el servidor: `git status` en `/var/www/celestial-parfums` dice cuáles.

## Runbook (a mano)

```bash
# Local: commit + push
# Servidor:
cd /var/www/celestial-parfums && git pull
cd backend
npx prisma migrate deploy   # solo si hay migración nueva; plan B: SQL directo
npm run build && pm2 restart celestial-backend
cd ../frontend
npm install                 # solo si hubo dependencias nuevas
npm run build               # nginx sirve frontend/dist directamente
```

**Antes de tocar producción: respaldo por SSH y verificar que el archivo pese cientos de KB, no
20 bytes.**

**Al terminar, comprobar que el frontend nuevo es el que se está sirviendo** — no fiarse de recargar
el navegador, que enseña lo mismo tanto si la caché miente como si el `dist` está viejo:

```bash
curl -s -I https://celestialparfums.com/ | grep -i last-modified
```

Si esa hora no es la de hace un momento, **el `npm run build` del frontend no entró** (puede haber
muerto por memoria sin decirlo). Ver [`gotchas.md`](gotchas.md).

> ### ⚠️ El paso que se saltó una vez y costó una semana (2026-08-29)
>
> **`git pull` sin `migrate deploy` deja el sistema PEOR que sin desplegar.** El código nuevo pide
> columnas que la base todavía no tiene, y Prisma las pide **en cada consulta de esa tabla**: no
> falla la función nueva, falla la pantalla entera. Pasó con
> `20260825120000_editar_producciones`: Producciones y el aviso de "lotes por enlazar" quedaron
> muertos, y el dueño pasó días creyendo que la función de los 1.1 estaba mal hecha.
>
> **Cómo se detecta en un minuto**, sin adivinar:
>
> ```bash
> cd /var/www/celestial-parfums/backend && npx prisma migrate status
> ```
>
> O desde una copia del respaldo, en local:
> `SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 3;`
> Si la última no es la última carpeta de `backend/prisma/migrations/`, **el deploy quedó a
> medias**.

Para despejar dudas sobre qué hay aplicado de verdad: `npx prisma migrate status` en el servidor.
Vale la pena por el **histórico de `db push`** de este proyecto — puede pasar que el esquema esté
bien pero `_prisma_migrations` no lo refleje, y entonces un `migrate deploy` falla por historial
aunque no falte nada. En ese caso, aplicar el SQL de la migración directo con mysql.

## Entorno de producción

- **VPS Ubuntu 24.04 en DonWeb.** Base **MariaDB 10.11, NO MySQL** — el servicio se llama
  `mariadb`. **JAMÁS instalar `mysql-client` en el servidor**: apt desinstala MariaDB server por
  conflicto de paquetes (pasó el 2026-07-21 y tumbó la base; los datos en `/var/lib/mysql`
  sobrevivieron). El mysqldump correcto es el que trae `mariadb-client`.
- **nginx**: config en `/etc/nginx/sites-available/celestialparfums.com` (3 bloques; el principal
  es el server de 443 sin www). Ya tiene `client_max_body_size 10m` (sin eso los uploads >1MB
  devolvían HTML 413 y el frontend explotaba parseando JSON) y CSP para imágenes. El backend fuerza
  `charset=utf-8` en JSON (app.ts).
- **Cloudflare**: el dominio vive detrás de Cloudflare (proxied, DNS gestionado ahí — el
  registrador Namecheap solo apunta los nameservers). SSL/TLS en modo **Full (strict)**, Always Use
  HTTPS y Bot Fight Mode activos.
  - `nginx.conf` (bloque `http {}`, **ANTES** de los `server {}`) tiene `real_ip_header
    CF-Connecting-IP` + `set_real_ip_from` con los rangos de Cloudflare (IPv4 e IPv6). **Sin esto,
    todo el tráfico se ve como si viniera de la IP de Cloudflare y el rate limiting agrupa a todos
    los visitantes en un solo cubo.**
  - `limit_req_zone`/`limit_conn_zone` (10r/s, zona `api`) definidos ahí mismo; se aplican con
    `limit_req`/`limit_conn` dentro de `location /api/` del sitio.
  - Si Cloudflare rota sus rangos, actualizar `set_real_ip_from` (cloudflare.com/ips-v4 y /ips-v6).
  - Pendiente opcional: firewall del VPS restringido a solo IPs de Cloudflare en 80/443.
- **Pendiente (recomendado 2026-09-28): que nginx no conteste la portada en lugar de un archivo
  que no existe.** Hoy `/assets/LoQueSea.js` inexistente devuelve **200 con el HTML** de la tienda
  (el `try_files … /index.html` del SPA), Cloudflare lo guarda 4 horas (`max-age=14400`) y el HTML
  sale **sin `Cache-Control`**, así que el iPhone reusa la portada vieja por horas. Juntas, esas tres
  cosas tumbaron el panel del dueño en su iPhone justo después de desplegar (ver `gotchas.md`). El
  frontend ya se recupera solo, pero lo correcto es cortarlo en la puerta. Dentro del `server` de
  443, antes del `location /` del SPA:

  ```nginx
  # Un archivo de /assets que no existe es un 404, nunca la portada
  location ^~ /assets/ {
      try_files $uri =404;
      expires 30d;
  }
  # La portada y el service worker nunca se guardan: siempre la versión nueva.
  # (Cloudflare retenía sw.js 4 h y los teléfonos seguían con el v1.)
  location = /index.html {
      expires -1;
  }
  location = /sw.js {
      try_files $uri =404;
      expires -1;
  }
  ```

  **`expires` y NO `add_header`, a propósito (seguridad):** en nginx, un `add_header` dentro de un
  `location` hace que ese bloque deje de heredar TODOS los `add_header` del `server` —CSP, HSTS y
  demás cabeceras de seguridad— sin avisar. `expires` pone el `Cache-Control` sin tocar esa
  herencia. El `^~` hace que `/assets/` gane sobre cualquier `location ~* \\.js$` que ya exista. El
  `/` del SPA cae en `= /index.html` por su `try_files`, así que no hay que tocarlo.

  Aplicar con respaldo y prueba:
  `sudo cp /etc/nginx/sites-available/celestialparfums.com ~/nginx-respaldo-$(date +%F).conf`,
  editar, `sudo nginx -t && sudo systemctl reload nginx`, y comprobar que
  `curl -sI https://celestialparfums.com/assets/NoExiste.js` da 404 y que la portada trae
  `Cache-Control: no-cache`. Los nombres de `/assets/` llevan huella (`index-DG1f8QhM.js`): por eso
  pueden guardarse 30 días sin riesgo.

## Dependencias que exigen `npm install` en el deploy

- Backend: `sharp`, `sanitize-html`, `express-slow-down`.
- Frontend: `sonner`.

## Historial de migraciones (orden exacto de aplicación)

Se conserva porque es la referencia si alguna vez hay que reconstruir una base desde cero.
Están aplicadas en producción **hasta `20260814120000_producto_terminado`** (desplegado el
2026-08-17). Las dos últimas —`regalo_automatico` y `regalos_y_extras`— están en `main` y en las
bases locales, y **esperan el próximo deploy**.

Primeras (sin carpeta con nombre):
- `anuncios.max_descuento` + `anuncios.max_canjes`
- `creditos.venta_id` (+ FK única a ventas)
- `ventas.presentacion` VARCHAR(20)→VARCHAR(100)
- `venta_perfume.cantidad` SMALLINT UNSIGNED NOT NULL DEFAULT 1

| Migración | Qué hace |
|---|---|
| `20260722120000_precios_por_presentacion` | Tabla `precios`, `perfume_presentacion.precio` y `perfumes.esencia_premium`. SIEMBRA la lista con el precio más común de cada categoría×presentación → **nadie cambia de precio al aplicarla** |
| `20260722140000_credito_fecha_limite` | `creditos.fecha_limite`; retro-completa los existentes con fecha + 1 mes |
| `20260723120000_recompensas` | `recompensa_config` (siembra 5 sellos, perfume 10ml gratis) y `recompensa_usuario` |
| `20260723140000_recompensa_colores` | Colores de la tarjeta (defaults negro+dorado) |
| `20260724120000_resenas_ganadores` | `resenas` y `recompensa_entrega`. **Backend suma `sharp`** |
| `20260726120000_favoritos_avisos_blog_nosotros_referidos` | `favoritos`, `avisos_stock`, `posts`, `sobre_nosotros_config` + `users.codigo_referido`/`referido_por`. **Backend suma `sanitize-html` y `express-slow-down`** |
| `20260727120000_cotizaciones_mayoristas` | `insumos_costo`, `formulas_volumen`, `escalas_precio`, `cotizacion_config`, `plantillas_cotizacion`, `cotizaciones`, `cotizacion_items`. **Frontend suma `sonner`** |
| `20260729120000_cotizacion_esencia_y_tipo` | `formulas_volumen.esencia_insumo_id` + `cotizaciones.tipo` y `lista_precios` |
| `20260730120000_cotizacion_accesorios` | `insumos_costo.alcance`, `formula_accesorios`, `cotizaciones.extras_pedido` |
| `20260731120000_devoluciones` | `devoluciones` y `devolucion_perfume` (ya con `origen`, `user_id`, `imagenes` del portal del cliente) |
| `20260801120000_inventario_compras` | `insumos_costo.precio` → DECIMAL(12,4) + `stock`; `pagos_proveedor` suma `numero_factura`/`archivos`; tablas `compra_items`, `movimientos_inventario`, `producciones`; `devoluciones` suma reposición y `costo_envio`; unidad `l`; tipo `muestra`; `perfumes.insumo_esencia_id` |
| `20260801140000_tallas_en_ml` | `presentaciones.ml` + `formula_volumen_id`; siembra envase y fórmula de 75 ml y 6 ml; enlaza talla ↔ receta por número |
| `20260801150000_lineas_de_venta` | `venta_perfume`: `id` autoincremental, `ml` y única `(venta_id, perfume_id, ml)`. Conserva las filas |
| `20260801160000_consumo_por_venta` | `ventas.costo_mercancia` |
| `20260801170000_tipos_de_producto` | `perfumes.tipo_producto`, `insumo_producto_id`, `ml_utiles` |
| `20260801180000_envase_por_perfume_talla` | `perfume_presentacion.envase_insumo_id` y `accesorios` |
| `20260801190000_rellenar_talla_historica` | Copia la talla desde `ventas.presentacion` a cada línea, **solo cuando el texto es inequívoco**. Verificado: 426 de 434 líneas con talla, 8 sin ella, sin mover dinero ni número de líneas |
| `20260809120000_perfume_publicado` | `perfumes.publicado` (**DEFAULT TRUE**) + índice. Al aplicarla no desaparece ninguno |
| `20260809140000_gama_esencia` | `insumos_costo.gama` (ENUM nullable) + siembra por precio (61 clásicas, 151 árabes, 4 premium) |
| `20260809160000_gamas_tabla` | La gama pasa de ENUM a la tabla `gamas_esencia` + `insumos_costo.gama_id` con FK ON DELETE SET NULL |
| `20260810120000_genero_esencia` | `insumos_costo.genero` (ENUM nullable) + siembra desde el nombre (21 dama, 6 caballero; 189 en NULL a propósito) |
| `20260810140000_minimos_por_gama` | `gamas_esencia.stock_minimo` + `insumos_costo.stock_minimo` admite NULL (= hereda el de su gama) y los ceros existentes pasan a NULL. **Ojo: cambia el significado de la columna** |
| `20260814120000_producto_terminado` | Tabla `movimientos_terminado`, `perfume_presentacion.stock`/`.costo_promedio` y `perfumes.solo_armado`. **El catálogo lee esas columnas en CADA consulta: sin aplicarla la tienda entera responde error** |
| `20260817120000_regalo_automatico` | `perfumes.regalo_automatico`. **Nunca llegó a producción**: la siguiente la borra. Se conserva para que aplicar en orden desde cero siga funcionando |
| `20260820120000_regalos_y_extras` | Quita `perfumes.regalo_automatico` y agrega `perfumes.es_accesorio` + `venta_perfume.regalo` (default 0). Ninguna ficha ni venta existente cambia de significado |
| `20260825120000_editar_producciones` | `producciones.costo_manual` e `historial` (JSON). **El código nuevo lee esas columnas al listar CUALQUIER lote: sin aplicarla, Producciones y el aviso de "lotes por enlazar" revientan enteros.** Se quedó sin aplicar en el deploy del 2026-08-29 y el dueño estuvo días sin poder crear una ficha 1.1 — ver el aviso del runbook |
| `20260829120000_alertas_inventario` | `insumos_costo.en_prueba` (default false) y la tabla `alertas_inventario`. Sin ella, Inventario y el pedido sugerido responden error: el backend lee `en_prueba` en cada consulta de materiales |
| `20260830120000_maceracion` | Tabla `maceraciones`, `producciones.maceracion_id` y el valor `maceracion` en el enum `MovimientoTipo`. Producir son dos momentos: macerar y envasar. **El enum se amplía con `MODIFY`, así que la migración es segura de repetir**, pero sin ella un `POST /inventario/maceraciones` revienta con "Data truncated for column 'tipo'" |
| `20260927120000_accesorios_11_ninguno` | Solo DATOS: `perfume_presentacion.accesorios = []` en las fichas 1.1 (`solo_armado`) que estaban en NULL. Desde ese día `[]` significa "ninguno" y NULL "los de la receta" (ver `inventario-costeo.md`). **No corrige los lotes ya armados**: después de desplegar, el dueño pulsa **Corregir** en el aviso de Producciones (en el respaldo del 22-sep eran 27 lotes, $54.300) |
| `20260928120000_abonos_dia_colombia` | Solo DATOS: pasa al día anterior los abonos que se anotaron entre las 7 p.m. y la medianoche de Colombia y quedaron con el día UTC (el siguiente). Solo toca los que anotó el sistema en ese momento (`fecha` = día UTC de `created_at` y hora UTC antes de las 5:00). En el respaldo del 22-sep: el 11 (28→27 ago) y el 20 (22→21 sep) |
| `20260929120000_perfumes_originales` | `insumos_costo.ml_botella` (INT NULL) y el valor `botella` en `compra_items.unidad_compra`. No toca filas existentes |
| `20260928140000_kit_del_combo` | Tabla nueva `combo_contenido` (el kit de accesorios de cada combo). No toca filas existentes |
| `20260830130000_devolucion_inventario` | `devoluciones.producto_devuelto` y `devoluciones.revendible` (ambas BOOLEAN NOT NULL DEFAULT false). Resolver una garantía ya mueve inventario y hace falta saber si el frasco volvió y si sirve. **El backend las lee al listar CUALQUIER devolución: sin ella, la pestaña Devoluciones y el portal del cliente responden error.** Los casos viejos quedan en false, que es lo que corresponde: de ellos no se sabe y nunca movieron nada |

**Verificado el 2026-08-01**: la base local se reemplazó por el dump real de producción y las
migraciones pendientes se aplicaron EN ORDEN sobre esos datos, sin perder una fila (212 perfumes,
261 ventas, 434 líneas, 22 usuarios). Después `prisma db push` respondió "in sync" → las
migraciones producen exactamente el esquema de Prisma.

**Probarlas contra una copia de producción antes de subir vale la pena**: hay fallos de SQL que
`prisma db push` nunca detecta porque no ejecuta los `.sql` (ver el gotcha de "Duplicate column
name" en [`gotchas.md`](gotchas.md)).
