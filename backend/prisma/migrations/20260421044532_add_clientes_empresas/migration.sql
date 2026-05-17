/*
  Warnings:

  - You are about to drop the column `apellido` on the `creditos` table. All the data in the column will be lost.
  - You are about to drop the column `celular` on the `creditos` table. All the data in the column will be lost.
  - You are about to drop the column `correo` on the `creditos` table. All the data in the column will be lost.
  - You are about to drop the column `nombre` on the `creditos` table. All the data in the column will be lost.
  - You are about to drop the column `empresa` on the `pagos_proveedor` table. All the data in the column will be lost.
  - Added the required column `cliente_id` to the `creditos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `empresa_id` to the `pagos_proveedor` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `creditos` DROP COLUMN `apellido`,
    DROP COLUMN `celular`,
    DROP COLUMN `correo`,
    DROP COLUMN `nombre`,
    ADD COLUMN `cliente_id` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `pagos_proveedor` DROP COLUMN `empresa`,
    ADD COLUMN `empresa_id` INTEGER NOT NULL;

-- CreateTable
CREATE TABLE `clientes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(100) NOT NULL,
    `apellido` VARCHAR(100) NOT NULL,
    `correo` VARCHAR(150) NULL,
    `telefono` VARCHAR(20) NULL,
    `direccion` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `empresas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(150) NOT NULL,
    `nit` VARCHAR(50) NULL,
    `telefono` VARCHAR(20) NULL,
    `correo` VARCHAR(150) NULL,
    `direccion` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `creditos` ADD CONSTRAINT `creditos_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pagos_proveedor` ADD CONSTRAINT `pagos_proveedor_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
