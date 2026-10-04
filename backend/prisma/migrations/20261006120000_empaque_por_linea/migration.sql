-- EMPAQUE POR LÍNEA, TALLA Y COMBO (dueño, 2026-10-04).
-- Diseño: docs/superpowers/specs/2026-10-04-empaque-por-linea-design.md
--
-- La bolsa y el perfumero dejan de ir "por debajo" en la receta del tamaño y
-- en la talla del perfume: pasan a ser productos accesorio que la venta regala
-- a la vista, según la línea y la talla, o según el kit del combo.

-- 1. La configuración nueva
CREATE TABLE `empaque_linea` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `linea` ENUM('contratipo', 'uno_uno', 'decant', 'botella_completa', 'producto') NOT NULL,
  `presentacion_id` INTEGER NULL,
  `perfume_id` INTEGER NOT NULL,
  `cantidad` SMALLINT UNSIGNED NOT NULL DEFAULT 1,

  UNIQUE INDEX `empaque_linea_linea_presentacion_id_perfume_id_key`(`linea`, `presentacion_id`, `perfume_id`),
  INDEX `empaque_linea_perfume_id_idx`(`perfume_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `empaque_linea` ADD CONSTRAINT `empaque_linea_presentacion_id_fkey`
  FOREIGN KEY (`presentacion_id`) REFERENCES `presentaciones`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `empaque_linea` ADD CONSTRAINT `empaque_linea_perfume_id_fkey`
  FOREIGN KEY (`perfume_id`) REFERENCES `perfumes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Cada material que hoy va en una receta, como producto accesorio (oculto,
--    precio 0). Si ya existe un accesorio ligado a ese material, se reutiliza.
INSERT INTO `perfumes` (`nombre`, `precio`, `tipo_producto`, `es_accesorio`, `publicado`, `insumo_producto_id`, `updated_at`)
SELECT i.`nombre`, 0, 'comprado', 1, 0, i.`id`, NOW(3)
FROM `insumos_costo` i
WHERE i.`id` IN (SELECT DISTINCT `insumo_id` FROM `formula_accesorios`)
  AND NOT EXISTS (SELECT 1 FROM `perfumes` p WHERE p.`es_accesorio` = 1 AND p.`insumo_producto_id` = i.`id`);

-- 3. El contratipo arranca con lo que hoy hace la receta de cada tamaño
INSERT INTO `empaque_linea` (`linea`, `presentacion_id`, `perfume_id`, `cantidad`)
SELECT 'contratipo', pr.`id`, MIN(p.`id`), 1
FROM `presentaciones` pr
JOIN `formula_accesorios` fa ON fa.`formula_volumen_id` = pr.`formula_volumen_id`
JOIN `perfumes` p ON p.`es_accesorio` = 1 AND p.`insumo_producto_id` = fa.`insumo_id`
GROUP BY pr.`id`, fa.`insumo_id`;

-- 4. Los combos sin kit arrancan con su obsequio: el perfumero recargable vacío
INSERT INTO `combo_contenido` (`combo_id`, `perfume_id`, `cantidad`)
SELECT c.`id`, (SELECT MIN(p.`id`) FROM `perfumes` p JOIN `insumos_costo` i ON i.`id` = p.`insumo_producto_id`
                WHERE p.`es_accesorio` = 1 AND i.`nombre` LIKE '%perfumero%'), 1
FROM `combos` c
WHERE NOT EXISTS (SELECT 1 FROM `combo_contenido` cc WHERE cc.`combo_id` = c.`id`)
  AND EXISTS (SELECT 1 FROM `perfumes` p JOIN `insumos_costo` i ON i.`id` = p.`insumo_producto_id`
              WHERE p.`es_accesorio` = 1 AND i.`nombre` LIKE '%perfumero%');

-- 5. Lo viejo se retira: ya está copiado arriba
DROP TABLE `formula_accesorios`;
ALTER TABLE `perfume_presentacion` DROP COLUMN `accesorios`;
