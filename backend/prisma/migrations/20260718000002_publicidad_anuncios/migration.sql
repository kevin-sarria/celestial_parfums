-- Módulo de publicidad: ventanas emergentes configurables + cupones de un uso
CREATE TABLE `anuncios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `titulo` VARCHAR(150) NOT NULL,
    `mensaje` TEXT NULL,
    `imagen_url` TEXT NULL,
    `tipo` ENUM('imagen', 'mensaje', 'descuento') NOT NULL DEFAULT 'mensaje',
    `audiencia` ENUM('todos', 'no_registrados', 'registrados') NOT NULL DEFAULT 'todos',
    `una_vez` BOOLEAN NOT NULL DEFAULT true,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `orden` INTEGER NOT NULL DEFAULT 0,
    `inicio` DATE NULL,
    `fin` DATE NULL,
    `descuento_pct` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `aplica_combos` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `anuncios_activo_idx`(`activo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `anuncio_categorias` (
    `anuncio_id` INTEGER NOT NULL,
    `categoria_id` INTEGER NOT NULL,

    PRIMARY KEY (`anuncio_id`, `categoria_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `descuento_usos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `anuncio_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `usado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `descuento_usos_anuncio_id_user_id_key`(`anuncio_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `anuncio_categorias` ADD CONSTRAINT `anuncio_categorias_anuncio_id_fkey` FOREIGN KEY (`anuncio_id`) REFERENCES `anuncios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `anuncio_categorias` ADD CONSTRAINT `anuncio_categorias_categoria_id_fkey` FOREIGN KEY (`categoria_id`) REFERENCES `categorias`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `descuento_usos` ADD CONSTRAINT `descuento_usos_anuncio_id_fkey` FOREIGN KEY (`anuncio_id`) REFERENCES `anuncios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `descuento_usos` ADD CONSTRAINT `descuento_usos_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
