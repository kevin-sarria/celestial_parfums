-- AlterTable
ALTER TABLE `perfumes` ADD COLUMN `agotado` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `ventas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dia` DATE NOT NULL,
    `persona` VARCHAR(150) NOT NULL,
    `cantidad_perfumes` INTEGER NOT NULL,
    `presentacion` VARCHAR(20) NOT NULL,
    `referencia_perfume` TEXT NOT NULL,
    `valor_venta` DECIMAL(10, 2) NOT NULL,
    `datos_adicionales` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `creditos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fecha` DATE NOT NULL,
    `nombre` VARCHAR(100) NOT NULL,
    `apellido` VARCHAR(100) NOT NULL,
    `celular` VARCHAR(20) NOT NULL,
    `correo` VARCHAR(150) NULL,
    `articulos` TEXT NOT NULL,
    `deuda_inicial` DECIMAL(10, 2) NOT NULL,
    `abono_1` DECIMAL(10, 2) NULL,
    `abono_2` DECIMAL(10, 2) NULL,
    `abono_3` DECIMAL(10, 2) NULL,
    `abono_4` DECIMAL(10, 2) NULL,
    `abono_5` DECIMAL(10, 2) NULL,
    `abono_6` DECIMAL(10, 2) NULL,
    `abono_7` DECIMAL(10, 2) NULL,
    `abono_8` DECIMAL(10, 2) NULL,
    `abono_9` DECIMAL(10, 2) NULL,
    `abono_10` DECIMAL(10, 2) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pagos_proveedor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dia` DATE NOT NULL,
    `empresa` VARCHAR(150) NOT NULL,
    `valor_compra` DECIMAL(10, 2) NOT NULL,
    `coste_envio` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `detalles_adicionales` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
