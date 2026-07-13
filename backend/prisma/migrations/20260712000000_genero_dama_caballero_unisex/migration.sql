-- Cambia la terminologia del genero: hombre -> caballero, mujer -> dama, y agrega unisex.
-- Se amplia el enum temporalmente para poder convertir los datos existentes sin perderlos.
ALTER TABLE `perfumes` MODIFY `genero` ENUM('hombre', 'mujer', 'dama', 'caballero', 'unisex') NULL;

UPDATE `perfumes` SET `genero` = 'caballero' WHERE `genero` = 'hombre';
UPDATE `perfumes` SET `genero` = 'dama' WHERE `genero` = 'mujer';

ALTER TABLE `perfumes` MODIFY `genero` ENUM('dama', 'caballero', 'unisex') NULL;
