-- Enlace inferido venta -> perfume del catálogo (para "más vendidos")
ALTER TABLE `ventas` ADD COLUMN `perfume_id` INTEGER NULL;
CREATE INDEX `ventas_perfume_id_idx` ON `ventas`(`perfume_id`);
ALTER TABLE `ventas` ADD CONSTRAINT `ventas_perfume_id_fkey` FOREIGN KEY (`perfume_id`) REFERENCES `perfumes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Cupo de crédito base por cliente (el factor de comportamiento se calcula en runtime)
ALTER TABLE `clientes` ADD COLUMN `cupo_base` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- Solicitudes de crédito hechas desde el portal del cliente
CREATE TABLE `solicitudes_credito` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cliente_id` INTEGER NOT NULL,
    `monto` DECIMAL(10, 2) NOT NULL,
    `mensaje` TEXT NULL,
    `estado` ENUM('pendiente', 'aprobada', 'rechazada') NOT NULL DEFAULT 'pendiente',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `solicitudes_credito_cliente_id_idx`(`cliente_id`),
    INDEX `solicitudes_credito_estado_idx`(`estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `solicitudes_credito` ADD CONSTRAINT `solicitudes_credito_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
