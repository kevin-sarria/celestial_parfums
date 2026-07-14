-- Enlace opcional de ventas con un cliente, y de clientes con una cuenta registrada (users).

-- Ventas -> Cliente (opcional)
ALTER TABLE `ventas` ADD COLUMN `cliente_id` INTEGER NULL;
CREATE INDEX `ventas_cliente_id_idx` ON `ventas`(`cliente_id`);
ALTER TABLE `ventas`
    ADD CONSTRAINT `ventas_cliente_id_fkey`
    FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Cliente -> User (opcional, uno a uno)
ALTER TABLE `clientes` ADD COLUMN `user_id` INTEGER NULL;
CREATE UNIQUE INDEX `clientes_user_id_key` ON `clientes`(`user_id`);
ALTER TABLE `clientes`
    ADD CONSTRAINT `clientes_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
