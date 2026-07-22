-- El enlace venta-perfume solo admitia una vez cada fragancia; ahora cada
-- enlace lleva su cantidad (un combo de 3 puede incluir 2 del mismo perfume).
ALTER TABLE `venta_perfume` ADD COLUMN `cantidad` SMALLINT UNSIGNED NOT NULL DEFAULT 1;
