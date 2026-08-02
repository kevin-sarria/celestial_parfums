-- La talla deja de ser texto y pasa a ser un NUMERO de mililitros.
--
-- Por que: el mismo tamano estaba escrito de cinco formas ("30ML", "30 ML",
-- "30ml"...) y nada casaba entre el catalogo publico (presentaciones) y el
-- costeo (formulas_volumen). Comparando numeros el problema desaparece.
-- El `nombre` se queda como la etiqueta que ve el cliente.

ALTER TABLE `presentaciones`
  ADD COLUMN `ml` INTEGER NULL,
  ADD COLUMN `formula_volumen_id` INTEGER NULL,
  ADD INDEX `presentaciones_ml_idx` (`ml`),
  ADD INDEX `presentaciones_formula_volumen_id_fkey` (`formula_volumen_id`),
  ADD CONSTRAINT `presentaciones_formula_volumen_id_fkey`
    FOREIGN KEY (`formula_volumen_id`) REFERENCES `formulas_volumen`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Envases de las tallas que faltaban (precio en 0: lo fija la primera compra)
-- OJO: cada columna del SELECT lleva alias. Sin ellos, la tabla derivada toma
-- el LITERAL como nombre de columna y 'unidad' sale dos veces (unidad y
-- alcance) -> "Duplicate column name 'unidad'" y la migracion no corre.
INSERT INTO `insumos_costo` (`nombre`, `tipo`, `unidad`, `alcance`, `precio`, `stock`, `stock_minimo`, `activo`, `created_at`, `updated_at`)
SELECT * FROM (
  SELECT 'Envase 75 ml' AS n, 'envase' AS t, 'unidad' AS u, 'unidad' AS al,
         0 AS pr, 0 AS st, 0 AS mi, 1 AS ac, NOW(3) AS cr, NOW(3) AS up
) AS nuevo
WHERE NOT EXISTS (SELECT 1 FROM `insumos_costo` WHERE `nombre` = 'Envase 75 ml');

INSERT INTO `insumos_costo` (`nombre`, `tipo`, `unidad`, `alcance`, `precio`, `stock`, `stock_minimo`, `activo`, `created_at`, `updated_at`)
SELECT * FROM (
  SELECT 'Perfumero recargable 6 ml' AS n, 'envase' AS t, 'unidad' AS u, 'unidad' AS al,
         0 AS pr, 0 AS st, 0 AS mi, 1 AS ac, NOW(3) AS cr, NOW(3) AS up
) AS nuevo
WHERE NOT EXISTS (SELECT 1 FROM `insumos_costo` WHERE `nombre` = 'Perfumero recargable 6 ml');

-- El 100 ml tenia 0.40 de feromonas; el dueno confirmo que son 0.30 como el resto
UPDATE `formulas_volumen` SET `feromonas_ml` = 0.30 WHERE `ml_total` = 100;

-- Recetas confirmadas por el dueno (el diluyente NUNCA se guarda: es el resto).
-- Todas llevan esencia al 50% del volumen.
INSERT INTO `formulas_volumen`
  (`nombre`, `ml_total`, `esencia_ml`, `sellador_ml`, `feromonas_ml`, `envase_insumo_id`, `activo`, `orden`, `created_at`, `updated_at`)
SELECT '75 ml', 75, 37.50, 0.80, 0.30,
       (SELECT `id` FROM `insumos_costo` WHERE `nombre` = 'Envase 75 ml'), 1, 0, NOW(3), NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `formulas_volumen` WHERE `ml_total` = 75);

INSERT INTO `formulas_volumen`
  (`nombre`, `ml_total`, `esencia_ml`, `sellador_ml`, `feromonas_ml`, `envase_insumo_id`, `activo`, `orden`, `created_at`, `updated_at`)
SELECT '6 ml', 6, 3.00, 0.20, 0.15,
       (SELECT `id` FROM `insumos_costo` WHERE `nombre` = 'Perfumero recargable 6 ml'), 1, 0, NOW(3), NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `formulas_volumen` WHERE `ml_total` = 6);

-- El numero sale del propio nombre. Las que NO son un tamano quedan en NULL a
-- proposito y no se costean:
--   "200/250ML"          -> es un apaño para marcar splash de 200 Y de 250;
--                           hay que separarlas a mano en dos tallas reales.
--   "Combo Personalizado"-> no es una talla; desaparece al pasar la venta a
--                           lista de items.
UPDATE `presentaciones`
   SET `ml` = CAST(REGEXP_SUBSTR(`nombre`, '[0-9]+') AS UNSIGNED)
 WHERE `nombre` REGEXP '^[0-9]+ *[mM][lL]';

-- Cada talla queda enlazada a su receta POR NUMERO, no por texto
UPDATE `presentaciones` p
  JOIN `formulas_volumen` f ON f.`ml_total` = p.`ml`
   SET p.`formula_volumen_id` = f.`id`;
