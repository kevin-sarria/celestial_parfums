-- Unificación: la tabla `clientes` desaparece; los usuarios (`users`) son la única
-- lista de personas. Los clientes sin cuenta se convierten en usuarios "ficha"
-- (sin_cuenta=1, email sintético, sin acceso) y ventas/créditos/solicitudes
-- pasan a apuntar a users.

-- 1) users gana los campos de la ficha
ALTER TABLE `users`
  ADD COLUMN `telefono` VARCHAR(20) NULL,
  ADD COLUMN `direccion` VARCHAR(255) NULL,
  ADD COLUMN `cupo_base` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `sin_cuenta` BOOLEAN NOT NULL DEFAULT false;

-- 2) clientes YA enlazados a una cuenta: copiar sus datos a la cuenta
UPDATE `users` u
JOIN `clientes` c ON c.`user_id` = u.`id`
SET u.`telefono`  = COALESCE(u.`telefono`, c.`telefono`),
    u.`direccion` = COALESCE(u.`direccion`, c.`direccion`),
    u.`cupo_base` = c.`cupo_base`;

-- 3) clientes SIN cuenta: crear su usuario ficha (no puede iniciar sesión:
--    activo=0 y hash de password inválido a propósito)
INSERT INTO `users` (`nombre`, `apellido`, `email`, `password`, `rol_id`, `activo`,
                     `telefono`, `direccion`, `cupo_base`, `sin_cuenta`, `created_at`, `updated_at`)
SELECT c.`nombre`, c.`apellido`,
       CONCAT('ficha-', c.`id`, '@sin-cuenta.local'),
       '!sin-acceso!', 2, 0,
       c.`telefono`, c.`direccion`, c.`cupo_base`, 1, c.`created_at`, NOW(3)
FROM `clientes` c
WHERE c.`user_id` IS NULL;

UPDATE `clientes` c
JOIN `users` u ON u.`email` = CONCAT('ficha-', c.`id`, '@sin-cuenta.local')
SET c.`user_id` = u.`id`
WHERE c.`user_id` IS NULL;

-- 4) ventas → users
ALTER TABLE `ventas` ADD COLUMN `user_id` INTEGER NULL;
UPDATE `ventas` v JOIN `clientes` c ON v.`cliente_id` = c.`id` SET v.`user_id` = c.`user_id`;
ALTER TABLE `ventas` DROP FOREIGN KEY `ventas_cliente_id_fkey`;
ALTER TABLE `ventas` DROP INDEX `ventas_cliente_id_idx`;
ALTER TABLE `ventas` DROP COLUMN `cliente_id`;
CREATE INDEX `ventas_user_id_idx` ON `ventas`(`user_id`);
ALTER TABLE `ventas` ADD CONSTRAINT `ventas_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 5) creditos → users
ALTER TABLE `creditos` ADD COLUMN `user_id` INTEGER NULL;
UPDATE `creditos` cr JOIN `clientes` c ON cr.`cliente_id` = c.`id` SET cr.`user_id` = c.`user_id`;
ALTER TABLE `creditos` MODIFY `user_id` INTEGER NOT NULL;
ALTER TABLE `creditos` DROP FOREIGN KEY `creditos_cliente_id_fkey`;
ALTER TABLE `creditos` DROP COLUMN `cliente_id`;
CREATE INDEX `creditos_user_id_idx` ON `creditos`(`user_id`);
ALTER TABLE `creditos` ADD CONSTRAINT `creditos_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6) solicitudes → users
ALTER TABLE `solicitudes_credito` ADD COLUMN `user_id` INTEGER NULL;
UPDATE `solicitudes_credito` s JOIN `clientes` c ON s.`cliente_id` = c.`id` SET s.`user_id` = c.`user_id`;
ALTER TABLE `solicitudes_credito` MODIFY `user_id` INTEGER NOT NULL;
ALTER TABLE `solicitudes_credito` DROP FOREIGN KEY `solicitudes_credito_cliente_id_fkey`;
ALTER TABLE `solicitudes_credito` DROP INDEX `solicitudes_credito_cliente_id_idx`;
ALTER TABLE `solicitudes_credito` DROP COLUMN `cliente_id`;
CREATE INDEX `solicitudes_credito_user_id_idx` ON `solicitudes_credito`(`user_id`);
ALTER TABLE `solicitudes_credito` ADD CONSTRAINT `solicitudes_credito_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- 7) adiós tabla clientes
ALTER TABLE `clientes` DROP FOREIGN KEY `clientes_user_id_fkey`;
DROP TABLE `clientes`;
