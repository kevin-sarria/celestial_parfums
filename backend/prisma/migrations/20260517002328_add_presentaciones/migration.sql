-- CreateTable
CREATE TABLE `presentaciones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(20) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `presentaciones_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `perfume_presentacion` (
    `perfume_id` INTEGER NOT NULL,
    `presentacion_id` INTEGER NOT NULL,

    PRIMARY KEY (`perfume_id`, `presentacion_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `perfume_presentacion` ADD CONSTRAINT `perfume_presentacion_perfume_id_fkey` FOREIGN KEY (`perfume_id`) REFERENCES `perfumes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `perfume_presentacion` ADD CONSTRAINT `perfume_presentacion_presentacion_id_fkey` FOREIGN KEY (`presentacion_id`) REFERENCES `presentaciones`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
