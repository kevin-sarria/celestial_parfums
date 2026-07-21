-- Guardarraíles del cupón (0 = sin límite): tope del descuento en pesos por
-- canje y cupo total de códigos que la campaña puede emitir.
ALTER TABLE `anuncios`
  ADD COLUMN `max_descuento` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `max_canjes` SMALLINT UNSIGNED NOT NULL DEFAULT 0;
