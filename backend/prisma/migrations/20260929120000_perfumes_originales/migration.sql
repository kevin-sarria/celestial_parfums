-- Perfumes originales (2026-09-29): cuántos ml trae una botella del material,
-- y la unidad "botella" para teclear la compra como llega ("2 botellas").
ALTER TABLE `insumos_costo` ADD COLUMN `ml_botella` INTEGER NULL;

ALTER TABLE `compra_items` MODIFY `unidad_compra` ENUM('ml', 'g', 'l', 'kg', 'unidad', 'botella') NOT NULL DEFAULT 'unidad';
