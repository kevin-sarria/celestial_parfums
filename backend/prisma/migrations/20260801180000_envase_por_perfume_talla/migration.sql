-- El frasco y la caja se definen por PERFUME Y TALLA, no solo por tamano.
--
-- El dueno confirmo que el envase y la caja cambian segun la referencia: un 1.1
-- de Sauvage no usa el mismo frasco que uno de Bleu, aunque ambos sean de
-- 100 ml. Con el envase pegado solo a la receta del tamano, el costo salia
-- equivocado en cuanto una referencia usara otro frasco.
--
-- La receta del tamano (`formulas_volumen`) queda como lo que de verdad es: las
-- PROPORCIONES (ml de esencia, diluyente, sellador, feromonas). El envase y los
-- accesorios de la receta pasan a ser el valor POR DEFECTO, y lo que se define
-- aqui manda sobre ellos.

ALTER TABLE `perfume_presentacion`
  ADD COLUMN `envase_insumo_id` INTEGER NULL,
  ADD COLUMN `accesorios` JSON NULL,
  ADD INDEX `perfume_presentacion_envase_insumo_id_fkey` (`envase_insumo_id`),
  ADD CONSTRAINT `perfume_presentacion_envase_insumo_id_fkey`
    FOREIGN KEY (`envase_insumo_id`) REFERENCES `insumos_costo`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
