-- Tarjeta de recompensas (fidelidad): config global + progreso/override por cliente.

CREATE TABLE `recompensa_config` (
  `id`              INT NOT NULL AUTO_INCREMENT,
  `activo`          BOOLEAN NOT NULL DEFAULT true,
  `sellos_objetivo` INT NOT NULL DEFAULT 5,
  `premio`          VARCHAR(200) NOT NULL DEFAULT 'Un perfume de 10ml GRATIS',
  `min_compra`      DECIMAL(10,2) NOT NULL DEFAULT 0,
  `created_at`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Config inicial por defecto (5 sellos, perfume 10ml gratis).
INSERT INTO `recompensa_config` (`sellos_objetivo`, `premio`, `min_compra`, `updated_at`)
VALUES (5, 'Un perfume de 10ml GRATIS', 0, NOW(3));

CREATE TABLE `recompensa_usuario` (
  `user_id`             INT NOT NULL,
  `sellos_consumidos`   INT NOT NULL DEFAULT 0,
  `premios_entregados`  INT NOT NULL DEFAULT 0,
  `objetivo_override`   INT NULL,
  `premio_override`     VARCHAR(200) NULL,
  `min_compra_override` DECIMAL(10,2) NULL,
  `created_at`          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`          DATETIME(3) NOT NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `recompensa_usuario_user_id_fkey` FOREIGN KEY (`user_id`)
    REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
