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

## Runbook

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

**Verificado el 2026-08-01**: la base local se reemplazó por el dump real de producción y las
migraciones pendientes se aplicaron EN ORDEN sobre esos datos, sin perder una fila (212 perfumes,
261 ventas, 434 líneas, 22 usuarios). Después `prisma db push` respondió "in sync" → las
migraciones producen exactamente el esquema de Prisma.

**Probarlas contra una copia de producción antes de subir vale la pena**: hay fallos de SQL que
`prisma db push` nunca detecta porque no ejecuta los `.sql` (ver el gotcha de "Duplicate column
name" en [`gotchas.md`](gotchas.md)).
