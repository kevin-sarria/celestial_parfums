-- Editar un lote de producción: la marca del costo escrito a mano y el rastro
-- de las correcciones.
--
-- `historial` es JSON y no una tabla aparte porque solo se lee CON su lote:
-- una tabla obligaría a un join en una pantalla que ya carga bien.
ALTER TABLE `producciones`
  ADD COLUMN `costo_manual` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `historial` JSON NULL;
