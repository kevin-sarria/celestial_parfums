-- Accesorios de costeo: alcance (por unidad vs por pedido), accesorios por
-- defecto de cada tamano y extras de pedido en la cotizacion.

ALTER TABLE `insumos_costo`
  ADD COLUMN `alcance` ENUM('unidad', 'pedido') NOT NULL DEFAULT 'unidad';

CREATE TABLE `formula_accesorios` (
  `formula_volumen_id` INTEGER NOT NULL,
  `insumo_id` INTEGER NOT NULL,
  PRIMARY KEY (`formula_volumen_id`, `insumo_id`),
  INDEX `formula_accesorios_insumo_id_idx` (`insumo_id`),
  CONSTRAINT `formula_accesorios_formula_volumen_id_fkey`
    FOREIGN KEY (`formula_volumen_id`) REFERENCES `formulas_volumen`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `formula_accesorios_insumo_id_fkey`
    FOREIGN KEY (`insumo_id`) REFERENCES `insumos_costo`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `cotizaciones`
  ADD COLUMN `extras_pedido` JSON NULL;
