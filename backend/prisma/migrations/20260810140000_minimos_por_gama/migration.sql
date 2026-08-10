-- Punto de pedido por GAMA, con excepción por esencia.
--
-- POR QUÉ
-- -------
-- El mínimo por insumo (`insumos_costo.stock_minimo`) ya existía, pero medido
-- sobre los datos reales **solo 1 de 226 materiales lo tenía configurado**. No
-- es que no sirva: es que ponerlo a mano en 219 esencias no lo hace nadie.
--
-- Con el mínimo en la GAMA se configura una vez para las 151 árabes, una vez
-- para las 61 clásicas, y listo. La excepción por esencia sigue existiendo para
-- la que se mueve distinto al resto de su gama.
--
-- SEMÁNTICA de `insumos_costo.stock_minimo` (por eso pasa a admitir NULL):
--   NULL = hereda el de su gama  (el caso normal, y el nuevo por defecto)
--   0    = sin alerta a propósito ("esta no la repongo")
--   > 0  = su propio mínimo, que MANDA sobre el de la gama
--
-- Antes 0 significaba "sin alerta" y era el valor por defecto de todos, así que
-- los ceros existentes se convierten a NULL: eran "no configurado", no "no
-- avisar". El único material con un valor de verdad lo conserva.

ALTER TABLE `gamas_esencia`
  ADD COLUMN `stock_minimo` DECIMAL(12,3) NOT NULL DEFAULT 0 AFTER `orden`;

ALTER TABLE `insumos_costo`
  MODIFY COLUMN `stock_minimo` DECIMAL(12,3) NULL DEFAULT NULL;

UPDATE `insumos_costo` SET `stock_minimo` = NULL WHERE `stock_minimo` = 0;
