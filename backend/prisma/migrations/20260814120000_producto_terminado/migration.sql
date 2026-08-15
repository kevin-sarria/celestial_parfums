-- Producto terminado: los frascos que ya están armados.
--
-- Hasta hoy producir DESCONTABA los materiales y vender los descontaba OTRA VEZ,
-- así que un frasco armado por adelantado gastaba su esencia dos veces: costo del
-- mes inflado, ganancia falsa y stock en negativo. Esta migración crea dónde
-- guardar esos frascos; el reparto (primero lo armado, luego la receta) va en el
-- código.
--
-- NO toca ni una fila existente: todo nace en 0, que es exactamente lo que hay hoy.

-- 1) Cuántos frascos armados hay de cada perfume en cada talla, y a qué costo.
--    Es una PROYECCIÓN del libro de abajo, igual que insumos_costo.stock.
ALTER TABLE `perfume_presentacion`
  ADD COLUMN `stock` DECIMAL(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN `costo_promedio` DECIMAL(12,4) NOT NULL DEFAULT 0;

-- 2) El libro. Tabla aparte de movimientos_inventario porque allí `insumo_id` es
--    obligatorio y lo dan por hecho todas las consultas que ya existen.
CREATE TABLE `movimientos_terminado` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `perfume_id` INT NOT NULL,
  `presentacion_id` INT NOT NULL,
  `tipo` ENUM('compra','produccion','garantia','ajuste','merma','muestra','venta') NOT NULL,
  `cantidad` DECIMAL(12,3) NOT NULL,
  `costo_unitario` DECIMAL(12,4) NOT NULL,
  `fecha` DATE NOT NULL,
  `referencia_id` INT NULL,
  `nota` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `movimientos_terminado_perfume_id_presentacion_id_idx` (`perfume_id`, `presentacion_id`),
  INDEX `movimientos_terminado_tipo_idx` (`tipo`),
  CONSTRAINT `movimientos_terminado_perfume_id_fkey`
    FOREIGN KEY (`perfume_id`) REFERENCES `perfumes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `movimientos_terminado_presentacion_id_fkey`
    FOREIGN KEY (`presentacion_id`) REFERENCES `presentaciones`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3) "Este producto solo se vende si ya está armado" (los 1.1).
--
--    Va en el PERFUME y no colgado del nombre de su categoría: la categoría es un
--    dato que el dueño edita, y el día que la renombre la regla dejaría de
--    aplicarse en silencio. DEFAULT FALSE: los 229 perfumes que ya existen se
--    siguen comportando exactamente igual que hoy.
ALTER TABLE `perfumes`
  ADD COLUMN `solo_armado` BOOLEAN NOT NULL DEFAULT FALSE;
