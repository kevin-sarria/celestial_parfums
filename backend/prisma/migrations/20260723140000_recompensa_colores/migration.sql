-- Colores personalizables de la tarjeta de recompensas.
ALTER TABLE `recompensa_config`
  ADD COLUMN `color_fondo`  VARCHAR(20) NOT NULL DEFAULT '#141119',
  ADD COLUMN `color_lineas` VARCHAR(20) NOT NULL DEFAULT '#d9b45a',
  ADD COLUMN `color_texto`  VARCHAR(20) NOT NULL DEFAULT '#ffffff';
