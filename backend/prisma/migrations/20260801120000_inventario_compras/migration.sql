-- Inventario: stock y costo promedio ponderado de los insumos, detalle de las
-- compras a proveedores (con soportes) y libro de movimientos.

-- Mas precision en el costo: el promedio ponderado da fracciones y redondear a
-- 2 decimales en cada compra iria torciendo el costo poco a poco.
ALTER TABLE `insumos_costo`
  MODIFY COLUMN `precio` DECIMAL(12, 4) NOT NULL,
  ADD COLUMN `stock` DECIMAL(12, 3) NOT NULL DEFAULT 0;

-- La compra a proveedor pasa a ser tambien el documento de entrada al inventario
ALTER TABLE `pagos_proveedor`
  ADD COLUMN `numero_factura` VARCHAR(60) NULL,
  ADD COLUMN `archivos` JSON NULL;

CREATE TABLE `compra_items` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `pago_id` INTEGER NOT NULL,
  `insumo_id` INTEGER NOT NULL,
  `cantidad` DECIMAL(12, 3) NOT NULL,
  `unidad_compra` ENUM('ml', 'g', 'unidad') NOT NULL DEFAULT 'unidad',
  `subtotal` DECIMAL(12, 2) NOT NULL,
  `costo_unitario_final` DECIMAL(12, 4) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `compra_items_pago_id_idx` (`pago_id`),
  INDEX `compra_items_insumo_id_idx` (`insumo_id`),
  CONSTRAINT `compra_items_pago_id_fkey`
    FOREIGN KEY (`pago_id`) REFERENCES `pagos_proveedor`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `compra_items_insumo_id_fkey`
    FOREIGN KEY (`insumo_id`) REFERENCES `insumos_costo`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `movimientos_inventario` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `insumo_id` INTEGER NOT NULL,
  `tipo` ENUM('compra', 'produccion', 'garantia', 'ajuste', 'merma') NOT NULL,
  `cantidad` DECIMAL(12, 3) NOT NULL,
  `costo_unitario` DECIMAL(12, 4) NOT NULL,
  `fecha` DATE NOT NULL,
  `referencia_id` INTEGER NULL,
  `nota` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `movimientos_inventario_insumo_id_fecha_idx` (`insumo_id`, `fecha`),
  INDEX `movimientos_inventario_tipo_idx` (`tipo`),
  CONSTRAINT `movimientos_inventario_insumo_id_fkey`
    FOREIGN KEY (`insumo_id`) REFERENCES `insumos_costo`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `producciones` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `fecha` DATE NOT NULL,
  `formula_volumen_id` INTEGER NOT NULL,
  `cantidad` INTEGER NOT NULL,
  `costo_unitario` DECIMAL(12, 4) NOT NULL,
  `costo_total` DECIMAL(12, 2) NOT NULL,
  `nota` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `producciones_fecha_idx` (`fecha`),
  INDEX `producciones_formula_volumen_id_fkey` (`formula_volumen_id`),
  CONSTRAINT `producciones_formula_volumen_id_fkey`
    FOREIGN KEY (`formula_volumen_id`) REFERENCES `formulas_volumen`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Costo real de una garantia: producto repuesto (a COSTO de produccion, no a
-- precio de venta) y el envio que por ley asume el vendedor.
ALTER TABLE `devoluciones`
  ADD COLUMN `reposicion_formula_id` INTEGER NULL,
  ADD COLUMN `reposicion_cantidad` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `costo_reposicion` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `costo_envio` DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- Litros como unidad de compra: SIN esto, "20 L" de alcohol entraba como 20 ml
-- y el costo por ml quedaba mil veces inflado.
ALTER TABLE `compra_items`
  MODIFY COLUMN `unidad_compra` ENUM('ml', 'g', 'l', 'unidad') NOT NULL DEFAULT 'unidad';

-- Muestras del mostrario y minis de regalo: salen del inventario pero son
-- COSTO DE MARKETING, no pérdida. Van aparte de las mermas.
ALTER TABLE `movimientos_inventario`
  MODIFY COLUMN `tipo` ENUM('compra', 'produccion', 'garantia', 'ajuste', 'merma', 'muestra') NOT NULL;

-- Cada fragancia se hace con SU esencia (Eternity, Khamrah…): promediarlas
-- todas en una sola "Esencia" daba un costo que no era el de ninguna.
ALTER TABLE `perfumes` ADD COLUMN `insumo_esencia_id` INTEGER NULL;
ALTER TABLE `perfumes`
  ADD INDEX `perfumes_insumo_esencia_id_fkey` (`insumo_esencia_id`),
  ADD CONSTRAINT `perfumes_insumo_esencia_id_fkey`
    FOREIGN KEY (`insumo_esencia_id`) REFERENCES `insumos_costo`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Qué fragancia y qué envase se usaron en cada lote
ALTER TABLE `producciones`
  ADD COLUMN `perfume_id` INTEGER NULL,
  ADD COLUMN `envase_insumo_id` INTEGER NULL,
  ADD INDEX `producciones_perfume_id_fkey` (`perfume_id`),
  ADD CONSTRAINT `producciones_perfume_id_fkey`
    FOREIGN KEY (`perfume_id`) REFERENCES `perfumes`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Punto de pedido por insumo: cuando el stock baja de aqui, hay que reponer.
-- En 0 la alerta queda apagada (no todo insumo la necesita).
ALTER TABLE `insumos_costo` ADD COLUMN `stock_minimo` DECIMAL(12, 3) NOT NULL DEFAULT 0;
