-- La meta de ganancia propia de un perfume (dueño, 2026-10-04): un caso puntual que
-- manda sobre la meta general de la pantalla "Precios de originales". NULL = la general.
ALTER TABLE `perfumes`
  ADD COLUMN `meta_ganancia_tipo` ENUM('porcentaje', 'pesos') NULL,
  ADD COLUMN `meta_ganancia_valor` DECIMAL(12, 2) NULL;
