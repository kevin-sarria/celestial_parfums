-- Cada tamaño elige SU esencia (normal, premium…): adivinar por nombre daba
-- costos equivocados cuando hay varias esencias cargadas.
ALTER TABLE `formulas_volumen` ADD COLUMN `esencia_insumo_id` INT NULL;
CREATE INDEX `formulas_volumen_esencia_insumo_id_fkey` ON `formulas_volumen`(`esencia_insumo_id`);
ALTER TABLE `formulas_volumen`
  ADD CONSTRAINT `formulas_volumen_esencia_insumo_id_fkey`
  FOREIGN KEY (`esencia_insumo_id`) REFERENCES `insumos_costo`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Tipo de cotización: pedido concreto vs lista de precios por cantidad.
-- `lista_precios` congela la lista al guardar (no cambia si suben los precios).
ALTER TABLE `cotizaciones`
  ADD COLUMN `tipo` ENUM('general','detallada') NOT NULL DEFAULT 'detallada',
  ADD COLUMN `lista_precios` JSON NULL;
