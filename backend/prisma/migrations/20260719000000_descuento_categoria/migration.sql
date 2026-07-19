-- Descuento general por categoría: 1 solo registro en vez de escribirlo en
-- cada perfume; el backend resuelve el % efectivo (mayor entre propio y categoría).
ALTER TABLE `categorias` ADD COLUMN `descuento` INTEGER NOT NULL DEFAULT 0;
