-- La venta pasa a ser una LISTA DE LINEAS: producto + talla + cantidad.
--
-- Por que: la clave era (venta_id, perfume_id), asi que el MISMO perfume en dos
-- tallas no cabia — vender 1 Khamrah de 30 ml y otro de 100 ml era imposible.
-- La talla vivia en UN campo de texto para toda la venta ("1 de 30 ml y 2 de
-- 60 ml"), y con eso es imposible saber que receta aplicarle a cada producto,
-- o sea imposible descontar inventario bien.
--
-- Dos Khamrah de 30 ml siguen siendo UNA linea con cantidad 2, no dos filas.
-- `ml` en NULL = ventas historicas (no la guardaban) y productos sin talla
-- (una gorra). Esas NO descuentan inventario, a proposito.
--
-- CONSERVA LOS DATOS: solo cambia la clave, no borra filas.

ALTER TABLE `venta_perfume`
  DROP PRIMARY KEY,
  ADD COLUMN `ml` INTEGER NULL,
  ADD COLUMN `id` INTEGER NOT NULL AUTO_INCREMENT FIRST,
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `venta_perfume_venta_id_perfume_id_ml_key` (`venta_id`, `perfume_id`, `ml`),
  ADD INDEX `venta_perfume_venta_id_idx` (`venta_id`);
