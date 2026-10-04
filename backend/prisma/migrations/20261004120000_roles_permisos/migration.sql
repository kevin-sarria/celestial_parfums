-- Roles con permisos (2026-10-04, decisión del dueño: opción C). El dueño arma
-- los roles de su personal marcando casillas; el código pregunta por el
-- permiso, no por el rol. El rol 1 (ADMIN) sigue pudiendo todo sin casillas.

-- Qué roles son de PERSONAL (entran al panel). Cliente (2) y Proveedor (3) no.
ALTER TABLE `roles` ADD COLUMN `personal` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `rol_permisos` (
    `rol_id` INTEGER NOT NULL,
    `permiso` VARCHAR(60) NOT NULL,

    PRIMARY KEY (`rol_id`, `permiso`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `rol_permisos` ADD CONSTRAINT `rol_permisos_rol_id_fkey`
  FOREIGN KEY (`rol_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Lo que el personal pide y solo el dueño aprueba: borrar una venta o un
-- crédito, o un descuento. La venta con descuento NO existe hasta que se
-- decide: su formulario entero espera en `datos` (no cuenta en los números
-- ni descuenta inventario mientras tanto).
CREATE TABLE `solicitudes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` ENUM('borrar_venta', 'borrar_credito', 'descuento_venta', 'descuento_credito') NOT NULL,
    `estado` ENUM('pendiente', 'aprobada', 'rechazada') NOT NULL DEFAULT 'pendiente',
    `solicitante_id` INTEGER NOT NULL,
    `venta_id` INTEGER NULL,
    `credito_id` INTEGER NULL,
    `motivo` VARCHAR(300) NOT NULL,
    `datos` JSON NULL,
    `resumen` VARCHAR(300) NOT NULL,
    `resuelta_por` INTEGER NULL,
    `resuelta_en` DATETIME(3) NULL,
    `respuesta` VARCHAR(300) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `solicitudes_estado_idx`(`estado`),
    INDEX `solicitudes_solicitante_id_idx`(`solicitante_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
