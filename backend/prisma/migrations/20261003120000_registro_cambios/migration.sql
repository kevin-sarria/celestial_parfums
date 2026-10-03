-- Historial de cambios (2026-10-03, tercera tanda): quién cambió qué y cuándo
-- en el panel. Se escribe solo, desde un middleware, por cada cambio que el
-- servidor aceptó. Es historia: se guarda, no se recalcula.
CREATE TABLE `registro_cambios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `usuario` VARCHAR(150) NOT NULL,
    `metodo` VARCHAR(6) NOT NULL,
    `ruta` VARCHAR(200) NOT NULL,
    `modulo` VARCHAR(40) NOT NULL,
    `resumen` VARCHAR(300) NOT NULL,
    `datos` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `registro_cambios_created_at_idx`(`created_at`),
    INDEX `registro_cambios_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
