-- Frascos de una fragancia (los de los 1.1): familia de alerta propia (dueño, 2026-10-03).
-- Sin fila en alertas_inventario no tienen mínimo de familia, así que dejan de
-- pedirse de a 40 como los envases genéricos.
ALTER TABLE `alertas_inventario` MODIFY `ambito` ENUM('esencias', 'envases', 'frascos_fragancia', 'implementos') NOT NULL;
