-- El kit del combo: los accesorios que trae cada combo por defecto (ola 2 de los regalos).
-- Tabla nueva; no toca ninguna fila existente.
CREATE TABLE `combo_contenido` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `combo_id` INTEGER NOT NULL,
    `perfume_id` INTEGER NOT NULL,
    `cantidad` SMALLINT UNSIGNED NOT NULL,

    INDEX `combo_contenido_perfume_id_idx`(`perfume_id`),
    UNIQUE INDEX `combo_contenido_combo_id_perfume_id_key`(`combo_id`, `perfume_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `combo_contenido` ADD CONSTRAINT `combo_contenido_combo_id_fkey` FOREIGN KEY (`combo_id`) REFERENCES `combos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `combo_contenido` ADD CONSTRAINT `combo_contenido_perfume_id_fkey` FOREIGN KEY (`perfume_id`) REFERENCES `perfumes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
