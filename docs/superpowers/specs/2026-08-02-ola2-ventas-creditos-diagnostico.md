# Ola 2 — Ventas y Créditos: diagnóstico y decisiones (para retomar)

**Fecha**: 2026-08-02 · **Estado**: diagnóstico hecho y enfoque aprobado por Kevin.
Falta escribir el diseño completo, el plan y construirlo.

Continúa `docs/superpowers/specs/2026-08-01-rediseno-dashboard-ola1-design.md`.

## Punto de partida

Ola 1 **completa y verificada** en la rama `rediseno-dashboard-ola1` (9 commits).
Sin commitear: `CLAUDE.md`, mezclado con cambios pendientes de la sesión anterior.

## El hallazgo que ordena todo el trabajo

Ventas y Créditos hacen **lo mismo** (armar productos con talla y cantidad, calcular un
total, canjear un cupón) con **dos implementaciones distintas**, y cada una quedó buena en
lo que la otra no:

| | Ventas | Créditos |
|---|---|---|
| Precio por línea | ❌ | ✅ |
| Total en vivo mientras armas | ❌ | ✅ (`CreditosTab.tsx:524`) |
| Desglose del cupón | ❌ | ✅ |
| Guardarraíl anti doble descuento | ✅ (`VentasTab.tsx:561`) | ❌ |
| Precio de combo | ❌ | ✅ |

Son 1.172 líneas manteniendo por duplicado la misma regla de precios.

## Fallos concretos, en orden de lo que cuesta

1. **Ventas no muestra el total** mientras armas: el valor se teclea a ciegas.
2. **Campo "Cantidad" duplicado** (`VentasTab.tsx:512`) que compite con las líneas; hay
   hasta un aviso de discrepancia, prueba de que ya se sabía que iba a pasar.
3. **Borrar no avisa si falla** en las dos (`VentasTab.tsx:246`, `CreditosTab.tsx:273`):
   mismo fallo que se corrigió en Clasificaciones. Y quedan 3 `alert()` sueltos
   (enlazar perfumes, registrar abono, guardar cupo).
4. **Créditos no tiene ninguna métrica**: no se ve cuánto te deben ni cuánto está vencido.
5. **Las 3 métricas de Ventas compiten** entre sí y ninguna compara contra el mes pasado.
6. **`tarjetaMovil` apagado** en ambas (la pieza ya existe desde la Ola 1).
7. **Ninguna envuelve su carga en try/catch**: si falla, la lista sale vacía sin explicar.

## Lo que YA está bien y no se toca

- El editor de líneas de Créditos (precio por línea, "sin −X%", interruptor de combo).
  **Es el patrón bueno: Ventas lo copia, no al revés.**
- El guardarraíl anti doble descuento de Ventas.
- La paginación y búsqueda contra el servidor de ambas.

## Decisiones tomadas con Kevin

1. **Unificar** en un solo "armador de pedido" compartido. Más trabajo ahora, una sola
   regla de precios que mantener para siempre, y parte los dos archivos gigantes.
2. El **valor de la venta se sigue tecleando a mano** (es la plata que entró de verdad);
   el sistema calcula y **ofrece** el total con un botón "usar el sugerido", como ya hace
   Créditos con "Usar el calculado".
3. El campo "Cantidad" suelto **desaparece**: se deriva de las líneas.

## El punto delicado: la talla se guarda de dos formas

- **Créditos**: `presentacion` como TEXTO (`"30ML"`) — es con lo que se busca el precio.
- **Ventas**: `ml` como NÚMERO (`30`) — es con lo que se sabe qué receta descontar.

Las dos hacen falta. **Decisión: exponer `ml` desde el backend**, no adivinarlo con una
expresión regular en el navegador. El dato ya existe (`presentaciones.ml`, migración
`20260801140000_tallas_en_ml`) y ya viene en la consulta: es **una línea** en
`resolverPrecios` (`backend/src/repositories/perfume.repository.ts:33`).
Adivinarlo sería justo lo que CLAUDE.md advierte que no se haga, y "200/250ML" no tiene
número que adivinar.

## Esto SÍ toca el backend (a diferencia de la Ola 1)

1. `ml` dentro de `precios[]` — una línea en `resolverPrecios`.
2. Endpoint nuevo `GET /creditos/totales` — "cuánto te deben" no se puede calcular con la
   página que está en pantalla; daría un número falso.

Sin migraciones ni dependencias nuevas. **Al desplegar hay que compilar el backend.**

## Primer paso mañana

Escribir el diseño completo con bocetos (armador de pedido, resumen del pedido, las tres
secciones del formulario, las métricas de las dos pestañas), aprobarlo, y de ahí al plan.
