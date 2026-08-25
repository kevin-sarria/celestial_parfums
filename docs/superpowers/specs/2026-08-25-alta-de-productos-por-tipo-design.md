# Dar de alta un producto: un formulario por tipo, y tres puertas para el 1.1

**Fecha:** 2026-08-25
**Nace de** una queja del dueño con nombre y apellido: *"me pareció pésima la gestión del
formulario para ingresar los perfumes, los 1.1 y los accesorios"*, y de una barrera real —
**tiene 5 frascos 1.1 que no puede meter al sistema**.
**Se apoya en** [`2026-08-24-maceracion-y-envasado-design.md`](2026-08-24-maceracion-y-envasado-design.md):
el alta desde el lote que aquí se detalla es la misma que allí vive en *Envasé frascos*.

## El problema, medido en el código

`FichaPerfumeModal.tsx` es UN formulario para las tres familias, con ~16 campos. Y la pregunta
que decide cuáles aplican —**"¿Cómo consigues este producto?"**— está en la **línea 147**, después
de doce campos:

| Orden en pantalla | Campo | ¿Le sirve a un perfumero? |
|---|---|---|
| 1-2 | Nombre, precio | Sí |
| 3 | Descripción | Sí |
| 4-5 | Duración, proyección | **No** |
| 6-7 | Género, categoría | **No** |
| 8 | Imagen | Sí |
| 9-10 | Tipos de aroma, ocasiones | **No** |
| **11** | **¿Cómo consigues este producto?** | **Es la pregunta que debía ir primera** |
| 12-14 | Insumo / ml aprovechados / esencia | Según el tipo |

Para dar de alta una bolsa de organza hay que pasar por la duración y la proyección de una bolsa
de organza. El resultado está medido en la base real: **229 perfumes, cero accesorios con ficha,
cero 1.1** (respaldo del 2026-08-24). No es que no los venda —los vende— es que darlos de alta
cuesta tanto que no lo hace.

**El patrón bueno ya existe en la casa.** `AltaInsumoEnCompra.tsx` (dar de alta un insumo sin
salir de la factura) pregunta **"¿Qué es?" primero** y solo entonces muestra lo que aplica: la
gama y el género aparecen si es esencia, y no si es un frasco. Este diseño lleva ese patrón al
catálogo. El dueño lo dijo mejor: *"no sé por qué no pensaste de esa manera"*.

## Lo que decidió el dueño (2026-08-25)

1. **La primera pregunta decide el formulario**, no es un campo más.
2. **Un 1.1 puede ser preparado por él o comprado ya hecho.** Los dos son 1.1: envase premium,
   precio propio y solo se venden si hay unidades. Cambia de dónde sale su costo.
3. **Alta desde donde está armando**, con pre-registro apagado hasta que él lo encienda — el mismo
   patrón del alta de esencias desde la factura.
4. **Varios en la misma tanda** ("crear y añadir otro") **y por Excel**, aunque hoy sean 5.
5. **Sus 1.1 viejos NO deben descontar esencia al registrarse**: al contar el inventario contó solo
   el líquido suelto, no el que ya estaba embotellado. Descontarlo otra vez dejaría las esencias
   en negativo por un gasto ya restado.

## Parte 1 — Tres puertas, tres formularios

```
NUEVO PRODUCTO — ¿qué vas a dar de alta?

┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐
│  🧪 Una fragancia  │ │   ✨ Un 1.1        │ │  📦 Algo que       │
│     que fabrico    │ │                    │ │     compro hecho   │
│  Contratipo o      │ │  Lo armas antes de │ │  Splash, perfumero,│
│  decant. Se arma   │ │  venderlo, con su  │ │  bolsa, tarjeta    │
│  al vender         │ │  envase premium    │ │                    │
└────────────────────┘ └────────────────────┘ └────────────────────┘
```

Y dentro del 1.1, la pregunta que lo termina de definir:

```
✨ UN 1.1  →  ¿este lo preparas tú o lo compras hecho?
             ( ) Lo preparo yo    ( ) Lo compro ya hecho
```

### Qué campos pide cada uno

| Campo | Fragancia | 1.1 preparado | 1.1 comprado | Perfumero / bolsa / splash |
|---|---|---|---|---|
| Nombre, precio, foto | ✓ | ✓ | ✓ | ✓ |
| Categoría | ✓ | 1.1 (fija) | 1.1 (fija) | opcional |
| Esencia (para costear) | ✓ | ✓ | — | — |
| Envase premium | — | ✓ | ✓ | — |
| Tallas y sus precios | ✓ | solo su talla | solo su talla | — |
| Duración, proyección, género | ✓ | ✓ | ✓ | — |
| Notas y ocasiones | ✓ | ✓ | ✓ | — |
| Qué insumo **es** este producto | — | — | ✓ | ✓ |
| **Campos en pantalla** | **~16** | **~12** | **~11** | **5** |

### Cómo se guarda cada puerta

El modelo de datos **no cambia**: las tres puertas escriben las columnas que ya existen.

| Puerta | `tipo_producto` | `solo_armado` | `es_accesorio` |
|---|---|---|---|
| Fragancia | `fabricado` | false | false |
| 1.1 preparado | `fabricado` | **true** | false |
| 1.1 comprado | `comprado` | **true** | false |
| Comprado / accesorio | `comprado` | false | según sea |

`solo_armado` es lo que manda a un producto a la pestaña **Productos** y lo que lo agota cuando no
hay frascos (`WHERE_FAMILIA`, `motivoAgotado`). Que sea independiente de `tipo_producto` es lo que
permite las dos clases de 1.1 sin inventar nada.

### Tres puertas, no una: por qué cambia la decisión anterior

El diseño del 2026-08-23 mandaba **puerta única** para el 1.1 (solo desde el lote), para no acabar
con "Bon Bon 1.1" y "Bon bon 1.1" como dos fichas. **Se cambia a propósito**: cerrar puertas no
evita duplicados, solo esconde el alta. Lo que sí los evita es **avisar del parecido al crear**:

> Al guardar un producto cuyo nombre normalizado (sin tildes, sin mayúsculas, sin espacios de
> más) coincida con uno existente, se muestra *"Ya tienes «Bon Bon 1.1». ¿Es el mismo?"* con las
> dos salidas: usar el que existe, o crear uno nuevo igualmente. Nunca se bloquea.

Es la misma decisión que ya está tomada para el alta desde el lote ("si ya existe uno con ese
nombre, no se toca: se avisa y decide el dueño"), aplicada al catálogo entero.

## Parte 2 — Alta rápida desde donde se está armando

```
INVENTARIO ▸ Armé perfumes
¿Qué armaste?  [ 🔎 bon bon 1.1                            ▾ ]
               ┌────────────────────────────────────────────┐
               │ + Crear "Bon Bon 1.1" como producto nuevo  │ ← primero de la lista
               └────────────────────────────────────────────┘
                 ┌──────────────────────────────────────────┐
                 │ Lo preparo yo ●      Lo compro hecho ○   │
                 │ Envase   [ Frasco Bon Bon 1.1        ▾ ] │
                 │ Precio   [ 150000                      ] │
                 │ Esencia  [ Bon Bon                   ▾ ] │
                 │                                          │
                 │ Nace apagado. Le pones foto y lo         │
                 │ enciendes cuando quieras.                │
                 │   [Crear y seguir]  [Crear y añadir otro]│
                 └──────────────────────────────────────────┘
```

- **Cuatro casillas**, las mínimas para que el frasco tenga costo y precio. El resto de la ficha
  (foto, descripción, notas) se llena después, desde Productos.
- **Nace apagado** (`publicado: false`), que es lo que ya hacen todos los productos desde el
  2026-08-24. El dueño lo enciende cuando la ficha está lista.
- **"Crear y añadir otro"** deja el formulario limpio y el foco en el nombre, sin cerrar el modal:
  es lo que convierte cinco altas en una sola sentada.
- **"+ Crear …" va PRIMERO en la lista**, no al final: al final de una lista larga hay que
  buscarlo con scroll y nadie descubre que existe. Es la misma decisión que en `DetalleCompra`.
- **Por Excel**: la plantilla de `perfumes` gana las columnas `solo_armado`, `envase` y
  `esencia`, para cargar los 1.1 en tanda. La importación ya existe; son columnas nuevas en
  `import.spec.ts`, no un importador nuevo.

## Parte 3 — Los frascos que ya existen (carga inicial)

```
INVENTARIO ▸ Ya tengo frascos armados   (carga inicial)

Producto   [ Khamrah 1.1 ▾ ]   Talla [ 100 ML ▾ ]   Unidades [ 3 ]
¿Qué te costó cada uno?  [ 74.580 ]   ← propuesto; se puede corregir

⚠ Esto NO descuenta esencia ni envases: son frascos que ya existen y cuyo
   material salió de tu bodega hace tiempo.
```

**Es lo que hoy bloquea al dueño.** El único camino para que existan frascos armados es
*producir*, y producir descuenta esencia. Esa esencia ya se gastó hace semanas y —dato suyo del
2026-08-25— **no la contó** en el inventario: descontarla otra vez dejaría sus esencias en
negativo por un gasto ya restado.

- **El motor ya lo soporta**: `movimientos_terminado` acepta el tipo `ajuste`, con su
  `costo_unitario` (`inventario.terminado.ts`). Falta el endpoint y la pantalla, nada más.
- **El costo se propone calculado** (receta de la talla + envase elegido, a los promedios de hoy)
  y **se puede corregir**: el dueño sabe lo que le costó de verdad, y un costo inventado envenena
  la ganancia del mes.
- **Queda anotado como lo que es**: un movimiento de tipo `ajuste` con nota *"Carga inicial"*, no
  una producción. Un lote que nunca ocurrió no puede aparecer en Producciones.
- **Un 1.1 comprado hecho entra por aquí también**, con lo que le costó al proveedor. Se descartó
  hacerlo entrar como insumo por factura: lo que el sistema necesita saber es *cuántos frascos hay
  y qué costó cada uno*, y así la regla de disponibilidad —"solo se vende si hay unidades"— es la
  misma para los dos tipos de 1.1.

## Qué NO cambia

- El modelo de datos: ni una tabla ni una columna nueva. **Sin migración.**
- Las reglas de disponibilidad (`motivoAgotado`), el consumo por venta y el costeo.
- La ficha de edición de un producto ya creado sigue existiendo; lo que cambia es que muestra los
  campos de SU tipo.
- La tienda pública.

## Pruebas que tiene que dejar

**Con base:**
1. Cada puerta guarda su combinación (`fabricado/false`, `fabricado/true`, `comprado/true`,
   `comprado/false`) y cae en la pestaña correcta.
2. Un 1.1 creado desde el lote nace apagado y con su envase y su precio.
3. La carga inicial suma frascos **sin mover ni un ml de esencia ni un envase**.
4. La carga inicial deja el movimiento como `ajuste`, no como `produccion`.
5. Un nombre repetido (con tildes o mayúsculas distintas) avisa y no bloquea.
6. El Excel de perfumes carga un 1.1 con su envase y su esencia.

**En el navegador:**
7. Dar de alta un perfumero: se cuentan los campos en pantalla y son 5, no 16.
8. Crear dos 1.1 seguidos con "Crear y añadir otro" sin cerrar el modal.
9. Los 5 frascos viejos entran por la carga inicial y aparecen en *Frascos ya armados* con su
   costo, y las esencias quedan intactas.

## Archivos que toca

**Frontend**
- `tabs/perfumes/FichaPerfumeModal.tsx` (269 líneas): se parte en el selector de tipo y un cuerpo
  por familia. Ninguno debe pasar de ~200 líneas.
- `tabs/perfumes/useFichaPerfume.ts`: el tipo elegido decide el estado inicial.
- `tabs/inventario/ProduccionModal.tsx`: el alta rápida dentro del buscador, con "crear y añadir
  otro" (el patrón de `DetalleCompra` + `AltaInsumoEnCompra`).
- `tabs/inventario/CargaInicialArmados.tsx` **(nuevo)**.

**Backend**
- `repositories/inventario.terminado.ts`: función de carga inicial (usa `aplicarMovimientoTerminado`
  con tipo `ajuste`).
- `routes/inventario.router.ts` + su esquema: el endpoint nuevo.
- `repositories/perfume.repository.ts`: el aviso de nombre parecido al crear.
- `schemas/import.spec.ts`: las columnas nuevas del Excel de perfumes.

## Orden sugerido

1. **La carga inicial** (Parte 3): es lo que desbloquea hoy al dueño y lo más pequeño.
2. **El alta rápida desde el lote** (Parte 2): le quita la barrera para los que vengan.
3. **Los tres formularios** (Parte 1): el más grande, y el que conviene mirar con capturas antes
   y después.
