-- Reemplaza `regalo_automatico` (2026-08-17, nunca desplegado) por un modelo
-- general: cualquier línea de venta puede regalar parte de su cantidad, y
-- cualquier perfume puede marcarse como accesorio (no fragancia).
ALTER TABLE `perfumes`
  DROP COLUMN `regalo_automatico`,
  ADD COLUMN `es_accesorio` BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE `venta_perfume`
  ADD COLUMN `regalo` SMALLINT UNSIGNED NOT NULL DEFAULT 0;
