-- La presentacion de una venta era VARCHAR(20) y los Excel reales traen textos
-- mas largos ("1 de 30 ml y 2 de 60 ml"); se amplia a 100.
ALTER TABLE `ventas` MODIFY `presentacion` VARCHAR(100) NOT NULL;
