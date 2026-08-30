-- Producir son DOS momentos: macerar (semanas) y envasar.
-- Diseño: docs/superpowers/specs/2026-08-24-maceracion-y-envasado-design.md

-- El material que se va al granel se anota con tipo propio. Sin esto, la
-- maceración 7 y el lote 7 serían indistinguibles al revertir por referencia.
ALTER TABLE `movimientos_inventario`
  MODIFY `tipo` ENUM('compra','produccion','garantia','ajuste','merma','muestra','venta','maceracion') NOT NULL;

CREATE TABLE `maceraciones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fecha` DATE NOT NULL,
    `perfume_id` INTEGER NOT NULL,
    `formula_volumen_id` INTEGER NULL,
    `ml_iniciales` DECIMAL(10, 2) NOT NULL,
    `costo_ml` DECIMAL(12, 6) NOT NULL,
    `costo_total` DECIMAL(12, 2) NOT NULL,
    `listo_estimado` DATE NULL,
    `cerrada_en` DATE NULL,
    `ml_merma` DECIMAL(10, 2) NULL,
    `nota` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `maceraciones_cerrada_en_idx`(`cerrada_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `maceraciones`
  ADD CONSTRAINT `maceraciones_perfume_id_fkey` FOREIGN KEY (`perfume_id`) REFERENCES `perfumes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `maceraciones_formula_volumen_id_fkey` FOREIGN KEY (`formula_volumen_id`) REFERENCES `formulas_volumen`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Null = armado directo, el camino de siempre.
ALTER TABLE `producciones` ADD COLUMN `maceracion_id` INTEGER NULL;
CREATE INDEX `producciones_maceracion_id_idx` ON `producciones`(`maceracion_id`);
ALTER TABLE `producciones`
  ADD CONSTRAINT `producciones_maceracion_id_fkey` FOREIGN KEY (`maceracion_id`) REFERENCES `maceraciones`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
