-- La gama de la esencia pasa de ser una lista fija a una TABLA.
--
-- Lo pidió el dueño: quiere poder agregar "nicho", "nicho premium" y las que
-- vengan sin que haya que tocar la base ni publicar una versión nueva. Con la
-- lista quemada en la columna, cada gama nueva era una migración.
--
-- Se conserva lo ya clasificado: las 216 esencias que quedaron marcadas por
-- precio en la migración anterior mantienen su gama.

CREATE TABLE `gamas_esencia` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `nombre`     VARCHAR(60) NOT NULL,
  `orden`      SMALLINT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `gamas_esencia_nombre_key`(`nombre`)
) DEFAULT CHARACTER SET utf8mb4;

-- Las cuatro que ya existían, ordenadas de la más barata a la más cara.
INSERT INTO `gamas_esencia` (`nombre`, `orden`) VALUES
  ('Clásica', 1), ('Árabe', 2), ('Diseñador', 3), ('Premium', 4);

ALTER TABLE `insumos_costo` ADD COLUMN `gama_id` INT NULL;

-- Se traduce cada valor viejo a su fila. Uno por uno y no con un JOIN por
-- nombre: comparar 'clasica' con 'Clásica' depende del cotejamiento de la base
-- y no vale la pena jugársela con los datos del dueño.
UPDATE `insumos_costo` SET `gama_id` = (SELECT `id` FROM `gamas_esencia` WHERE `nombre` = 'Clásica')   WHERE `gama` = 'clasica';
UPDATE `insumos_costo` SET `gama_id` = (SELECT `id` FROM `gamas_esencia` WHERE `nombre` = 'Árabe')     WHERE `gama` = 'arabe';
UPDATE `insumos_costo` SET `gama_id` = (SELECT `id` FROM `gamas_esencia` WHERE `nombre` = 'Premium')   WHERE `gama` = 'premium';
UPDATE `insumos_costo` SET `gama_id` = (SELECT `id` FROM `gamas_esencia` WHERE `nombre` = 'Diseñador') WHERE `gama` = 'disenador';

ALTER TABLE `insumos_costo` DROP COLUMN `gama`;

-- SET NULL y no CASCADE: borrar una gama no puede llevarse por delante las
-- esencias; solo las deja sin clasificar.
ALTER TABLE `insumos_costo`
  ADD CONSTRAINT `insumos_costo_gama_id_fkey`
  FOREIGN KEY (`gama_id`) REFERENCES `gamas_esencia`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX `insumos_costo_gama_id_idx` ON `insumos_costo`(`gama_id`);
