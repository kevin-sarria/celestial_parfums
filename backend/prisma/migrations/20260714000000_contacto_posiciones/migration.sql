-- Distribución de la página Contáctame: posición del contenido y de la fila de redes.
ALTER TABLE `contacto_config`
    ADD COLUMN `contenido_posicion` ENUM('arriba', 'centro') NOT NULL DEFAULT 'centro' AFTER `boton_color_texto`,
    ADD COLUMN `redes_posicion` ENUM('arriba', 'abajo') NOT NULL DEFAULT 'abajo' AFTER `contenido_posicion`;
