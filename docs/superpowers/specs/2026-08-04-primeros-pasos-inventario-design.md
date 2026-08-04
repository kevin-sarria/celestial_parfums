# Primeros pasos del inventario — diseño

Fecha: 2026-08-04. Decidido con el dueño tras su observación: *"el flujo lo siento muy
rígido e ineficiente; una persona que no entiende de tecnología poco entendería cómo hacer
las cosas"*.

Skill aplicada: `arranque-guiado`.

## El problema, medido

Estado real de la base al escribir esto:

| Dato | Valor |
|---|---|
| Materiales dados de alta | 11 |
| Materiales con existencias | **0** |
| Conteos físicos hechos | **0** |
| Líneas de compra registradas | **0** |
| Fórmulas de tamaño | 5 |
| Perfumes con esencia asignada | **0 de 212** |
| Lotes producidos | 0 |

El módulo está construido pero **nunca se arrancó**, y la pantalla no dice por dónde.
Peor: el dato que más pesa —la esencia de cada perfume— está en cero y **no se ve en
ninguna parte**. Sin él, ninguna venta descuenta material y los costos de producción son
aproximados sin avisar.

## 1. Dependencias reales (leídas del código)

```
Materiales (insumos_costo)
   ├──> Conteo inicial (movimiento tipo 'ajuste')
   ├──> Compras (compra_items ─> pagos_proveedor)
   ├──> Esencia por perfume (perfumes.insumo_esencia_id)
   └──> Envase por perfume+talla (perfume_presentacion.envase_insumo_id)

Fórmulas de tamaño (formulas_volumen)  ──┐
Esencia por perfume ─────────────────────┼──> Producción de un lote
Materiales con stock ────────────────────┘

Todo lo anterior ────────────────────────────> La venta descuenta inventario
```

### Orden OBLIGATORIO (invertirlo corrompe datos)

**Conteo inicial ANTES de la primera compra.** Verificado en `aplicarMovimiento`:

```
nuevoPromedio = stockActual > 0
  ? (stockActual*promedioActual + cantidad*costo) / (stockActual + cantidad)
  : costo          // <-- con stock 0, el promedio ES el de esa compra
```

Si compras primero, el promedio queda fijado al precio de esa compra. Cuando después
siembras el stock que ya tenías, el modal de Ajustar **prellena el costo con ese promedio**
(`setCostoAjuste(String(i.costo_promedio))`), así que tu material viejo entra al precio
equivocado. Resultado: costo subestimado y márgenes inflados, en silencio y para siempre.

Es el único orden obligatorio del módulo.

### Orden CONVENIENTE (solo comodidad — no bloquear)

Todo lo demás. Asignar esencias, fórmulas o envases en cualquier momento no daña nada:
simplemente hasta que estén, la venta no descuenta y el producto sale listado como
"pendiente por configurar".

## 2. La pieza: lista de progreso, no asistente modal

Vive **arriba en Inventario**, encima de las métricas. Se puede plegar. **Desaparece sola**
cuando los cuatro pasos están hechos.

```
┌────────────────────────────────────────────────────────────────────────┐
│  PRIMEROS PASOS                                          1 de 4    ▾   │
│  Haz esto una vez y el inventario empieza a trabajar solo.             │
│                                                                        │
│  ✓  1. Dinos qué materiales usas                      11 registrados   │
│                                                                        │
│  ○  2. Cuenta lo que tienes hoy                          [ Empezar ]   │
│        Hoy el sistema cree que tu bodega está vacía.                   │
│                                                                        │
│  ○  3. Registra tu primera compra                        [ Empezar ]   │
│        ⚠ Haz antes el paso 2. Si compras primero, el costo de lo que   │
│          ya tenías entra al precio equivocado y no se nota.            │
│                                                                        │
│  ○  4. Dile a cada perfume con qué esencia se hace         0 de 212    │
│        Sin esto, vender no descuenta material y el costo es a ojo.     │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

Decisiones y su porqué:

- **El paso 3 avisa, no bloquea.** Es el único orden obligatorio, pero bloquear es
  exactamente la rigidez de la que se quejó el dueño. El aviso dice la consecuencia en
  plata, no "requisito no cumplido".
- **Cada paso dice para qué sirve** en términos del negocio, no del sistema.
- **El paso 4 muestra `0 de 212`**: un contador convierte un pendiente invisible en uno
  medible.

## 3. El progreso sale de los DATOS, nunca de una bandera

Un `onboarding_completado` mentiría el día que se importe por Excel o se borre algo.
Cada paso se calcula:

| Paso | Se considera hecho cuando |
|---|---|
| 1. Materiales | `COUNT(insumos_costo) > 0` |
| 2. Conteo | existe un `movimientos_inventario` de tipo `ajuste` |
| 3. Compra | existe al menos una fila en `compra_items` |
| 4. Esencias | `COUNT(perfumes WHERE insumo_esencia_id IS NOT NULL) > 0` |

Consecuencia buscada: quien ya trabajó **nunca ve la lista**.

Endpoint nuevo: `GET /api/inventario/primeros-pasos` → los cuatro contadores. Uno solo,
porque son cuatro `COUNT` y pedirlos por separado son cuatro viajes.

## 4. Cada paso abre la pantalla real

Nada se reimplementa dentro de la lista:

| Paso | A dónde lleva |
|---|---|
| 1 | Insumos y precios (crear material) |
| 2 | Modal **Ajustar** de la primera fila sin stock |
| 3 | `/dashboard/pagos?nueva=1` (el mismo de "Registrar llegada") |
| 4 | Pantalla nueva de asignación masiva (ver abajo) |

## 5. Lo que falta construir: asignar esencias en bloque

El paso 4 no tiene hoy dónde hacerse cómodo: la esencia se asigna **perfume por perfume**
en su ficha del catálogo. Con 212 perfumes eso son 212 visitas — la definición de
ineficiente.

Propuesta: una pantalla de dos columnas donde se marcan varios perfumes y se les asigna
una esencia de una vez.

```
ASIGNAR ESENCIAS                            0 de 212 listos

Esencia a aplicar:  [ Esencia Khamrah        ▾ ]   [ Asignar a los 3 marcados ]

🔎 Buscar perfume…                            [ Solo los que faltan ✓ ]

 ☑  1 Million                    — sin esencia
 ☑  1 Million Lucky              — sin esencia
 ☑  Acqua di Gio Profondo        — sin esencia
 ☐  Eros                         — Esencia Clásica
```

Es la pieza que de verdad quita la sensación de rigidez: convierte 212 tareas en unas
pocas.

## Qué NO se hace

- **Nada de tours de globitos.** No dejan ningún dato guardado.
- **Nada de bloquear la aplicación.** La lista se puede ignorar entera.
- **No se toca el orden de las pantallas existentes.** Esto se suma; no reemplaza.

## Verificación exigida antes de dar por bueno

1. Base vacía → la lista aparece y el paso 1 es obvio.
2. Base ya trabajada → la lista **no** aparece.
3. Completar un paso por fuera (Excel o a mano) → ese paso se marca solo.
4. Intentar el paso 3 con el 2 pendiente → sale el aviso ámbar.
5. Asignar una esencia a 3 perfumes marcados → los 3 quedan, el contador sube.

Las 3 y la 5 son las que suelen fallar.
