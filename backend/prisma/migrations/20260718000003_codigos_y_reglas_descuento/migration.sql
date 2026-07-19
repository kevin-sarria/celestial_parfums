-- Reglas mínimas de aplicación en cupones (0 = sin mínimo)
ALTER TABLE `anuncios`
  ADD COLUMN `min_unidades` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN `min_monto` DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Presentación de los perfumes del combo (para la detección automática en el carrito)
ALTER TABLE `combos`
  ADD COLUMN `presentacion_id` INT NULL,
  ADD INDEX `combos_presentacion_id_idx` (`presentacion_id`),
  ADD CONSTRAINT `combos_presentacion_id_fkey` FOREIGN KEY (`presentacion_id`) REFERENCES `presentaciones`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Las ventas pueden quedar pendientes de pago; al marcarlas pagadas se canjea el código
ALTER TABLE `ventas`
  ADD COLUMN `pagada` BOOLEAN NOT NULL DEFAULT true;

-- Códigos únicos de descuento (reemplazan al registro simple de usos)
CREATE TABLE `descuento_codigos` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `codigo` VARCHAR(20) NOT NULL,
  `anuncio_id` INT NOT NULL,
  `user_id` INT NULL,
  `estado` ENUM('activo', 'canjeado', 'anulado') NOT NULL DEFAULT 'activo',
  `venta_id` INT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `canjeado_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `descuento_codigos_codigo_key` (`codigo`),
  UNIQUE INDEX `descuento_codigos_venta_id_key` (`venta_id`),
  INDEX `descuento_codigos_user_id_estado_idx` (`user_id`, `estado`),
  INDEX `descuento_codigos_anuncio_id_idx` (`anuncio_id`),
  CONSTRAINT `descuento_codigos_anuncio_id_fkey` FOREIGN KEY (`anuncio_id`) REFERENCES `anuncios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `descuento_codigos_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `descuento_codigos_venta_id_fkey` FOREIGN KEY (`venta_id`) REFERENCES `ventas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Usos históricos de cupones → códigos ya canjeados (se conserva el "un solo uso por persona")
INSERT INTO `descuento_codigos` (`codigo`, `anuncio_id`, `user_id`, `estado`, `created_at`, `canjeado_at`)
SELECT CONCAT('MIG-', LPAD(`id`, 6, '0')), `anuncio_id`, `user_id`, 'canjeado', `usado_en`, `usado_en`
FROM `descuento_usos`;

DROP TABLE `descuento_usos`;
