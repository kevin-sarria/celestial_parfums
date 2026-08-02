-- Devoluciones y reclamos de garantia, siempre ligados a una venta.
-- La plata devuelta se descuenta de los ingresos del mes en que se resuelve
-- (ver getVentaTotales en venta.repository.ts).

CREATE TABLE `devoluciones` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `venta_id` INTEGER NOT NULL,
  `user_id` INTEGER NULL,
  `origen` ENUM('admin', 'cliente') NOT NULL DEFAULT 'admin',
  `fecha` DATE NOT NULL,
  `motivo` ENUM('llego_danado', 'llego_equivocado', 'llego_incompleto', 'envase_defectuoso', 'no_llego', 'otro') NOT NULL,
  `detalle` TEXT NULL,
  `estado` ENUM('pendiente', 'en_revision', 'resuelta', 'rechazada') NOT NULL DEFAULT 'pendiente',
  `solucion` ENUM('reposicion', 'devolucion_dinero', 'ninguna') NULL,
  `monto_devuelto` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `fecha_resolucion` DATE NULL,
  `notas` TEXT NULL,
  `imagenes` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `devoluciones_venta_id_idx` (`venta_id`),
  INDEX `devoluciones_estado_idx` (`estado`),
  INDEX `devoluciones_fecha_idx` (`fecha`),
  INDEX `devoluciones_user_id_fkey` (`user_id`),
  CONSTRAINT `devoluciones_venta_id_fkey`
    FOREIGN KEY (`venta_id`) REFERENCES `ventas`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `devoluciones_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `devolucion_perfume` (
  `devolucion_id` INTEGER NOT NULL,
  `perfume_id` INTEGER NOT NULL,
  `cantidad` SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`devolucion_id`, `perfume_id`),
  INDEX `devolucion_perfume_perfume_id_idx` (`perfume_id`),
  CONSTRAINT `devolucion_perfume_devolucion_id_fkey`
    FOREIGN KEY (`devolucion_id`) REFERENCES `devoluciones`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `devolucion_perfume_perfume_id_fkey`
    FOREIGN KEY (`perfume_id`) REFERENCES `perfumes`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
