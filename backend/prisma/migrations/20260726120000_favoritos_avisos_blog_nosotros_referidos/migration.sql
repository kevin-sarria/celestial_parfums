-- Favoritos, avisos de stock, blog, "sobre nosotros" y referidos.
-- Local se aplicó con `prisma db push`; en producción aplicar este SQL
-- (o `prisma migrate deploy` si el historial lo permite).

-- Referidos: código propio + quién lo invitó (self-relation).
ALTER TABLE `users`
  ADD COLUMN `codigo_referido` VARCHAR(20) NULL,
  ADD COLUMN `referido_por` INT NULL;
CREATE UNIQUE INDEX `users_codigo_referido_key` ON `users`(`codigo_referido`);
CREATE INDEX `users_referido_por_idx` ON `users`(`referido_por`);
ALTER TABLE `users`
  ADD CONSTRAINT `users_referido_por_fkey`
  FOREIGN KEY (`referido_por`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Favoritos (lista de deseos).
CREATE TABLE `favoritos` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `perfume_id` INT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `favoritos_user_id_perfume_id_key`(`user_id`, `perfume_id`),
  INDEX `favoritos_user_id_idx`(`user_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `favoritos_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `favoritos_perfume_id_fkey` FOREIGN KEY (`perfume_id`) REFERENCES `perfumes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4;

-- "Avísame cuando vuelva".
CREATE TABLE `avisos_stock` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `perfume_id` INT NOT NULL,
  `notificado` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `avisos_stock_user_id_perfume_id_key`(`user_id`, `perfume_id`),
  INDEX `avisos_stock_perfume_id_notificado_idx`(`perfume_id`, `notificado`),
  PRIMARY KEY (`id`),
  CONSTRAINT `avisos_stock_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `avisos_stock_perfume_id_fkey` FOREIGN KEY (`perfume_id`) REFERENCES `perfumes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4;

-- Blog.
CREATE TABLE `posts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `titulo` VARCHAR(200) NOT NULL,
  `slug` VARCHAR(220) NOT NULL,
  `resumen` VARCHAR(300) NULL,
  `contenido` TEXT NOT NULL,
  `portada` VARCHAR(255) NULL,
  `publicado` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `posts_slug_key`(`slug`),
  INDEX `posts_publicado_created_at_idx`(`publicado`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- Config "Sobre nosotros" (fila única).
CREATE TABLE `sobre_nosotros_config` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `titulo` VARCHAR(200) NOT NULL DEFAULT 'Sobre nosotros',
  `historia` TEXT NOT NULL,
  `imagen` VARCHAR(255) NULL,
  `activo` BOOLEAN NOT NULL DEFAULT true,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;
