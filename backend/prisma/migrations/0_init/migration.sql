-- Initial migration — baseline from existing perfumes_db schema

CREATE TABLE `roles` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `nombre` VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `nombre` VARCHAR(100) NOT NULL DEFAULT '',
    `apellido` VARCHAR(100) NOT NULL DEFAULT '',
    `email` VARCHAR(150) NOT NULL UNIQUE,
    `password` VARCHAR(255) NOT NULL,
    `rol_id` INT NOT NULL,
    `activo` BOOLEAN DEFAULT FALSE,
    `verification_token` VARCHAR(255) DEFAULT NULL,
    `token_expiry` DATETIME DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`rol_id`) REFERENCES `roles`(`id`)
);

CREATE TABLE `categorias` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `nombre` VARCHAR(100) NOT NULL UNIQUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE `perfumes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `nombre` VARCHAR(150) NOT NULL,
    `descripcion` TEXT,
    `precio` DECIMAL(10,2) NOT NULL,
    `duracion` VARCHAR(50),
    `proyeccion` VARCHAR(50),
    `imagen_url` TEXT,
    `genero` ENUM('hombre', 'mujer') DEFAULT NULL,
    `categoria_id` INT DEFAULT NULL,
    `descuento` TINYINT UNSIGNED DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`categoria_id`) REFERENCES `categorias`(`id`) ON DELETE SET NULL
);

CREATE TABLE `tipos_aroma` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `nombre` VARCHAR(100) NOT NULL UNIQUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE `perfume_tipo_aroma` (
    `perfume_id` INT,
    `tipo_aroma_id` INT,
    PRIMARY KEY (`perfume_id`, `tipo_aroma_id`),
    FOREIGN KEY (`perfume_id`) REFERENCES `perfumes`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`tipo_aroma_id`) REFERENCES `tipos_aroma`(`id`) ON DELETE CASCADE
);

CREATE TABLE `ocasiones` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `nombre` VARCHAR(100) NOT NULL UNIQUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE `perfume_ocasion` (
    `perfume_id` INT,
    `ocasion_id` INT,
    PRIMARY KEY (`perfume_id`, `ocasion_id`),
    FOREIGN KEY (`perfume_id`) REFERENCES `perfumes`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`ocasion_id`) REFERENCES `ocasiones`(`id`) ON DELETE CASCADE
);

CREATE TABLE `combos` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `nombre` VARCHAR(150) NOT NULL,
    `descripcion` TEXT,
    `imagen_url` TEXT,
    `categoria_id` INT,
    `cantidad` INT NOT NULL,
    `precio` DECIMAL(10,2) NOT NULL,
    `descuento` TINYINT UNSIGNED DEFAULT 0,
    `activo` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`categoria_id`) REFERENCES `categorias`(`id`) ON DELETE SET NULL
);
