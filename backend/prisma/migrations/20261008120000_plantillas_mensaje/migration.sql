-- Maestro de mensajes (2026-10-04): los mensajes de WhatsApp que el dueño
-- escribe y edita desde el panel, en vez de vivir dentro del código —donde
-- cambiar una coma era un despliegue—.
--
-- Nace VACÍA a propósito: el texto es su voz y el sistema no la inventa.
-- Mientras un caso no tenga ninguna plantilla, el botón que la usaría sale
-- apagado y avisa que hay que configurarla.
CREATE TABLE `plantillas_mensaje` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `caso` VARCHAR(30) NOT NULL,
    `nombre` VARCHAR(60) NOT NULL,
    `texto` TEXT NOT NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `plantillas_mensaje_caso_orden_idx`(`caso`, `orden`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
