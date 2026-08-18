-- El producto que Registrar venta sugiere regalar en 100 ml sueltos y en
-- cualquier combo (uno por venta, sin importar cuántas botellas lleve).
-- DEFAULT FALSE: los perfumes que ya existen no cambian de comportamiento.
ALTER TABLE `perfumes`
  ADD COLUMN `regalo_automatico` BOOLEAN NOT NULL DEFAULT FALSE;
