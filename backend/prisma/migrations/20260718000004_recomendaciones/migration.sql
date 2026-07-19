-- "Tu perfume ideal": cálculo de recomendaciones guardado por usuario
CREATE TABLE `recomendaciones` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `filtros` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `recomendaciones_user_id_key` (`user_id`),
  CONSTRAINT `recomendaciones_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `recomendacion_items` (
  `recomendacion_id` INT NOT NULL,
  `perfume_id` INT NOT NULL,
  `orden` INT NOT NULL,
  `puntaje` TINYINT UNSIGNED NOT NULL,
  `razones` TEXT NOT NULL,
  PRIMARY KEY (`recomendacion_id`, `perfume_id`),
  INDEX `recomendacion_items_perfume_id_idx` (`perfume_id`),
  CONSTRAINT `recomendacion_items_recomendacion_id_fkey` FOREIGN KEY (`recomendacion_id`) REFERENCES `recomendaciones`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `recomendacion_items_perfume_id_fkey` FOREIGN KEY (`perfume_id`) REFERENCES `perfumes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
