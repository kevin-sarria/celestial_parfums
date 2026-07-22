-- Precio por presentacion: lista estandar por categoria + excepcion por perfume
-- + distintivo de contratipos ultra nicho (nunca entran en combos).

-- 1. Lista de precios del negocio: una fila por categoria y presentacion.
CREATE TABLE `precios` (
  `id`              INT NOT NULL AUTO_INCREMENT,
  `categoria_id`    INT NOT NULL,
  `presentacion_id` INT NOT NULL,
  `precio`          DECIMAL(10,2) NOT NULL,
  `created_at`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `precios_categoria_id_presentacion_id_key` (`categoria_id`, `presentacion_id`),
  INDEX `precios_presentacion_id_idx` (`presentacion_id`),
  CONSTRAINT `precios_categoria_id_fkey` FOREIGN KEY (`categoria_id`)
    REFERENCES `categorias`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `precios_presentacion_id_fkey` FOREIGN KEY (`presentacion_id`)
    REFERENCES `presentaciones`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Excepcion por perfume: lo que vale ESE perfume en ESA presentacion.
ALTER TABLE `perfume_presentacion` ADD COLUMN `precio` DECIMAL(10,2) NULL;

-- 3. Distintivo de contratipo hecho con la esencia de mayor calidad.
ALTER TABLE `perfumes` ADD COLUMN `esencia_premium` BOOLEAN NOT NULL DEFAULT false;

-- 4. Arranque sin cambiar ni un precio de los que hoy ve el cliente:
--    la lista se siembra con el precio mas comun de cada categoria+presentacion.
INSERT INTO `precios` (`categoria_id`, `presentacion_id`, `precio`, `updated_at`)
SELECT t.categoria_id, t.presentacion_id, t.precio, NOW(3)
FROM (
  SELECT p.categoria_id, pp.presentacion_id, p.precio, COUNT(*) AS cuantos,
         ROW_NUMBER() OVER (
           PARTITION BY p.categoria_id, pp.presentacion_id
           ORDER BY COUNT(*) DESC, p.precio ASC
         ) AS puesto
  FROM perfumes p
  JOIN perfume_presentacion pp ON pp.perfume_id = p.id
  WHERE p.categoria_id IS NOT NULL
  GROUP BY p.categoria_id, pp.presentacion_id, p.precio
) t
WHERE t.puesto = 1;

-- 5. Los perfumes que no coincidan con el precio de su lista conservan el suyo
--    como excepcion (nadie cambia de precio por esta migracion).
UPDATE perfume_presentacion pp
JOIN perfumes p        ON p.id = pp.perfume_id
LEFT JOIN precios pr   ON pr.categoria_id = p.categoria_id
                      AND pr.presentacion_id = pp.presentacion_id
SET pp.precio = p.precio
WHERE pr.id IS NULL OR pr.precio <> p.precio;
