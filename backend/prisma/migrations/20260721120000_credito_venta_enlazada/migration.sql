-- Venta enlazada al crédito: nace pendiente de pago junto con el crédito y se
-- marca pagada automáticamente cuando el último abono salda la deuda.
ALTER TABLE `creditos` ADD COLUMN `venta_id` INTEGER NULL;
ALTER TABLE `creditos` ADD UNIQUE INDEX `creditos_venta_id_key`(`venta_id`);
ALTER TABLE `creditos` ADD CONSTRAINT `creditos_venta_id_fkey` FOREIGN KEY (`venta_id`) REFERENCES `ventas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
