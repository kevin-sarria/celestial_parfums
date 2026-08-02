-- El catalogo deja de ser solo perfumes fabricados.
--
-- Hay tres formas de abastecer lo que se vende y cada una se costea distinto:
--  - fabricado:   se arma con una receta (contratipos, 1.1). Costo = formula.
--  - comprado:    se compra hecho y se revende (splash de 200/250 ml, gorras,
--                 perfumeros vacios). Costo = lo que se pago. NO tiene talla
--                 obligatoria: una gorra no tiene ml.
--  - fraccionado: se compra una botella grande y se sacan decants. Costo =
--                 (precio botella / ml UTILES) x ml del decant + envase.
--                 `ml_utiles` es menor que el volumen nominal porque al
--                 trasvasar siempre queda producto en el frasco y la jeringa;
--                 sin ese dato el decant sale mas barato de lo real.
--
-- Meter un producto comprado como "fabricado" haria que el costeo intente
-- aplicarle una receta y devuelva numeros sin sentido.

ALTER TABLE `perfumes`
  ADD COLUMN `tipo_producto` ENUM('fabricado', 'comprado', 'fraccionado') NOT NULL DEFAULT 'fabricado',
  ADD COLUMN `insumo_producto_id` INTEGER NULL,
  ADD COLUMN `ml_utiles` INTEGER NULL,
  ADD INDEX `perfumes_insumo_producto_id_fkey` (`insumo_producto_id`),
  ADD CONSTRAINT `perfumes_insumo_producto_id_fkey`
    FOREIGN KEY (`insumo_producto_id`) REFERENCES `insumos_costo`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
