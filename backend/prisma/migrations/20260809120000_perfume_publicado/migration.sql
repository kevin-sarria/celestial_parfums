-- Sacar un perfume del catálogo sin borrarlo.
--
-- Es DISTINTO de `agotado`: agotado sigue apareciendo en la tienda (marcado
-- como agotado, con el botón de "avísame cuando vuelva"); despublicado
-- desaparece del catálogo como si no existiera.
--
-- Nace de un caso real: hay 25 perfumes que no se pueden fabricar porque no
-- hay esencia de esa fragancia, y hasta hoy seguían visibles y vendibles.
--
-- DEFAULT TRUE a propósito: al aplicar esta migración NINGÚN perfume
-- desaparece de la tienda. Sacar uno es siempre una decisión manual.
ALTER TABLE `perfumes`
  ADD COLUMN `publicado` BOOLEAN NOT NULL DEFAULT true;

-- Se consulta en todos los listados públicos, casi siempre junto al orden por
-- fecha o nombre; sin índice, cada carga del catálogo recorre la tabla entera.
CREATE INDEX `perfumes_publicado_idx` ON `perfumes`(`publicado`);
