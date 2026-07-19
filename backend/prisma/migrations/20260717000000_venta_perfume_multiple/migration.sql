-- Una venta (combo) puede incluir VARIOS perfumes: se pasa del enlace único
-- ventas.perfume_id a la tabla puente venta_perfume, migrando los datos.
CREATE TABLE `venta_perfume` (
    `venta_id` INTEGER NOT NULL,
    `perfume_id` INTEGER NOT NULL,

    INDEX `venta_perfume_perfume_id_idx`(`perfume_id`),
    PRIMARY KEY (`venta_id`, `perfume_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `venta_perfume` ADD CONSTRAINT `venta_perfume_venta_id_fkey` FOREIGN KEY (`venta_id`) REFERENCES `ventas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `venta_perfume` ADD CONSTRAINT `venta_perfume_perfume_id_fkey` FOREIGN KEY (`perfume_id`) REFERENCES `perfumes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Conservar los enlaces ya inferidos
INSERT INTO `venta_perfume` (`venta_id`, `perfume_id`)
SELECT `id`, `perfume_id` FROM `ventas` WHERE `perfume_id` IS NOT NULL;

ALTER TABLE `ventas` DROP FOREIGN KEY `ventas_perfume_id_fkey`;
ALTER TABLE `ventas` DROP INDEX `ventas_perfume_id_idx`;
ALTER TABLE `ventas` DROP COLUMN `perfume_id`;
