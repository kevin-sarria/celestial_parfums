-- Reseñas de clientes (compra verificada, moderadas) + galería de premios entregados.

CREATE TABLE `resenas` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `user_id`    INT NOT NULL,
  `perfume_id` INT NOT NULL,
  `rating`     TINYINT UNSIGNED NOT NULL,
  `comentario` TEXT NULL,
  `imagenes`   JSON NOT NULL,
  `estado`     ENUM('pendiente','aprobada','rechazada') NOT NULL DEFAULT 'pendiente',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `resenas_user_id_perfume_id_key` (`user_id`, `perfume_id`),
  INDEX `resenas_perfume_id_estado_idx` (`perfume_id`, `estado`),
  CONSTRAINT `resenas_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `resenas_perfume_id_fkey` FOREIGN KEY (`perfume_id`) REFERENCES `perfumes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `recompensa_entrega` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `user_id`    INT NOT NULL,
  `premio`     VARCHAR(200) NOT NULL,
  `imagenes`   JSON NOT NULL,
  `estado`     ENUM('pendiente','aprobada','rechazada') NOT NULL DEFAULT 'pendiente',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `recompensa_entrega_estado_idx` (`estado`),
  CONSTRAINT `recompensa_entrega_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
