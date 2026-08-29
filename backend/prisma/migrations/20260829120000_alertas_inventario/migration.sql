-- Materiales EN PRUEBA y alertas de inventario por familia.
--
-- `en_prueba`: el dueño trae 30 ml de una esencia para ver si sale. Con el
-- mínimo en 30 ml, el pedido sugerido le pedía reponerla antes de haber vendido
-- una sola unidad. Marcarla saca del sugerido sin sacarla del inventario.
--
-- `alertas_inventario`: una fila por familia (esencias / envases / implementos).
-- Su `minimo` es a la vez el punto de pedido de esa familia y el umbral del
-- aviso: en la cabeza del dueño son el mismo número, y guardarlo dos veces
-- garantiza que un día digan cosas distintas.
ALTER TABLE `insumos_costo`
  ADD COLUMN `en_prueba` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `alertas_inventario` (
  `id`         INTEGER NOT NULL AUTO_INCREMENT,
  `ambito`     ENUM('esencias', 'envases', 'implementos') NOT NULL,
  `minimo`     DECIMAL(12, 3) NOT NULL,
  `forma`      ENUM('franja', 'ventana') NOT NULL DEFAULT 'franja',
  `titulo`     VARCHAR(150) NULL,
  `mensaje`    TEXT NULL,
  `activo`     BOOLEAN NOT NULL DEFAULT true,
  `orden`      INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `alertas_inventario_ambito_key`(`ambito`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
