-- Módulo "Contáctame" (linktree): configuración global + links.

CREATE TABLE `contacto_config` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `avatar_url` TEXT NULL,
    `nombre` VARCHAR(100) NOT NULL DEFAULT 'Celestial Parfums',
    `descripcion` TEXT NULL,
    `fondo_tipo` ENUM('color', 'imagen') NOT NULL DEFAULT 'color',
    `fondo_valor` VARCHAR(500) NULL,
    `boton_forma` ENUM('redondo', 'cuadrado') NOT NULL DEFAULT 'redondo',
    `boton_color_fondo` VARCHAR(20) NOT NULL DEFAULT '#ffffff',
    `boton_color_texto` VARCHAR(20) NOT NULL DEFAULT '#2f2a3d',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `contacto_links` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` ENUM('boton', 'red') NOT NULL DEFAULT 'boton',
    `nombre` VARCHAR(100) NOT NULL,
    `url` TEXT NOT NULL,
    `emoji` VARCHAR(20) NULL,
    `forma` ENUM('redondo', 'cuadrado') NULL,
    `color_fondo` VARCHAR(20) NULL,
    `color_texto` VARCHAR(20) NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `contacto_links_tipo_activo_idx` ON `contacto_links`(`tipo`, `activo`);
