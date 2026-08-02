-- La VENTA consume los insumos y congela lo que costo.
--
-- Se arma contra pedido (no por lotes), asi que la venta es el momento en que
-- el material sale de verdad. De aqui nace el COSTO DE MERCANCIA VENDIDA:
-- ingresos - costo = ganancia real. Antes "Ingresos del mes" era facturacion,
-- no ganancia.
--
-- Reglas acordadas con el dueno:
--  - Descuenta AL REGISTRAR la venta, no al marcarla pagada: el perfume ya
--    salio aunque sea a credito.
--  - Si no alcanza el stock NO se bloquea la venta (ya ocurrio en la vida
--    real); el stock queda en negativo y la pestana lo muestra en ambar.
--  - Un perfume sin esencia asignada NO descuenta y suma 0 al costo: usar una
--    esencia generica descuadraria ese insumo y daria un costo falso.
--  - Editar o borrar una venta DEVUELVE el material al inventario.

ALTER TABLE `movimientos_inventario`
  MODIFY COLUMN `tipo` ENUM('compra','produccion','garantia','ajuste','merma','muestra','venta') NOT NULL;

ALTER TABLE `ventas`
  ADD COLUMN `costo_mercancia` DECIMAL(12, 2) NOT NULL DEFAULT 0;
