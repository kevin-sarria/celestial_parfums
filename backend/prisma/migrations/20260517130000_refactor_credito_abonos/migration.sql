-- CreateTable
CREATE TABLE `credito_abonos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `credito_id` INTEGER NOT NULL,
    `monto` DECIMAL(10, 2) NOT NULL,
    `fecha` DATE NOT NULL DEFAULT (CURDATE()),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `credito_abonos_credito_id_idx`(`credito_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Migrate existing abono data
INSERT INTO `credito_abonos` (`credito_id`, `monto`, `fecha`, `created_at`)
SELECT id, abono_1, fecha, created_at FROM `creditos` WHERE abono_1 IS NOT NULL;

INSERT INTO `credito_abonos` (`credito_id`, `monto`, `fecha`, `created_at`)
SELECT id, abono_2, fecha, created_at FROM `creditos` WHERE abono_2 IS NOT NULL;

INSERT INTO `credito_abonos` (`credito_id`, `monto`, `fecha`, `created_at`)
SELECT id, abono_3, fecha, created_at FROM `creditos` WHERE abono_3 IS NOT NULL;

INSERT INTO `credito_abonos` (`credito_id`, `monto`, `fecha`, `created_at`)
SELECT id, abono_4, fecha, created_at FROM `creditos` WHERE abono_4 IS NOT NULL;

INSERT INTO `credito_abonos` (`credito_id`, `monto`, `fecha`, `created_at`)
SELECT id, abono_5, fecha, created_at FROM `creditos` WHERE abono_5 IS NOT NULL;

INSERT INTO `credito_abonos` (`credito_id`, `monto`, `fecha`, `created_at`)
SELECT id, abono_6, fecha, created_at FROM `creditos` WHERE abono_6 IS NOT NULL;

INSERT INTO `credito_abonos` (`credito_id`, `monto`, `fecha`, `created_at`)
SELECT id, abono_7, fecha, created_at FROM `creditos` WHERE abono_7 IS NOT NULL;

INSERT INTO `credito_abonos` (`credito_id`, `monto`, `fecha`, `created_at`)
SELECT id, abono_8, fecha, created_at FROM `creditos` WHERE abono_8 IS NOT NULL;

INSERT INTO `credito_abonos` (`credito_id`, `monto`, `fecha`, `created_at`)
SELECT id, abono_9, fecha, created_at FROM `creditos` WHERE abono_9 IS NOT NULL;

INSERT INTO `credito_abonos` (`credito_id`, `monto`, `fecha`, `created_at`)
SELECT id, abono_10, fecha, created_at FROM `creditos` WHERE abono_10 IS NOT NULL;

-- Drop old columns
ALTER TABLE `creditos` DROP COLUMN `abono_1`,
    DROP COLUMN `abono_2`,
    DROP COLUMN `abono_3`,
    DROP COLUMN `abono_4`,
    DROP COLUMN `abono_5`,
    DROP COLUMN `abono_6`,
    DROP COLUMN `abono_7`,
    DROP COLUMN `abono_8`,
    DROP COLUMN `abono_9`,
    DROP COLUMN `abono_10`;

-- AddForeignKey
ALTER TABLE `credito_abonos` ADD CONSTRAINT `credito_abonos_credito_id_fkey` FOREIGN KEY (`credito_id`) REFERENCES `creditos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
