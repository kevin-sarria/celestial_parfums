-- La página Contáctame se divide en dos secciones de media pantalla:
-- redes_posicion ahora alinea la sección inferior dentro de su mitad (centro | abajo).
ALTER TABLE `contacto_config`
    MODIFY `redes_posicion` ENUM('arriba', 'abajo', 'centro') NOT NULL DEFAULT 'centro';

UPDATE `contacto_config` SET `redes_posicion` = 'centro' WHERE `redes_posicion` = 'arriba';

ALTER TABLE `contacto_config`
    MODIFY `redes_posicion` ENUM('centro', 'abajo') NOT NULL DEFAULT 'centro';
