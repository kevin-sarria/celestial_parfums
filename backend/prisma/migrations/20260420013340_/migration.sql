/*
  Warnings:

  - Made the column `descuento` on table `combos` required. This step will fail if there are existing NULL values in that column.
  - Made the column `activo` on table `combos` required. This step will fail if there are existing NULL values in that column.
  - Made the column `descuento` on table `perfumes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `activo` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `combos` DROP FOREIGN KEY `combos_ibfk_1`;

-- DropForeignKey
ALTER TABLE `perfume_ocasion` DROP FOREIGN KEY `perfume_ocasion_ibfk_1`;

-- DropForeignKey
ALTER TABLE `perfume_ocasion` DROP FOREIGN KEY `perfume_ocasion_ibfk_2`;

-- DropForeignKey
ALTER TABLE `perfume_tipo_aroma` DROP FOREIGN KEY `perfume_tipo_aroma_ibfk_1`;

-- DropForeignKey
ALTER TABLE `perfume_tipo_aroma` DROP FOREIGN KEY `perfume_tipo_aroma_ibfk_2`;

-- DropForeignKey
ALTER TABLE `perfumes` DROP FOREIGN KEY `perfumes_ibfk_1`;

-- DropForeignKey
ALTER TABLE `users` DROP FOREIGN KEY `users_ibfk_1`;

-- AlterTable
ALTER TABLE `categorias` MODIFY `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updated_at` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `combos` MODIFY `descuento` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    MODIFY `activo` BOOLEAN NOT NULL DEFAULT true,
    MODIFY `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updated_at` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `ocasiones` MODIFY `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updated_at` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `perfumes` MODIFY `descuento` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    MODIFY `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updated_at` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `tipos_aroma` MODIFY `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updated_at` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `users` ALTER COLUMN `nombre` DROP DEFAULT,
    ALTER COLUMN `apellido` DROP DEFAULT,
    MODIFY `activo` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `token_expiry` DATETIME(3) NULL,
    MODIFY `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updated_at` DATETIME(3) NOT NULL;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_rol_id_fkey` FOREIGN KEY (`rol_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `perfumes` ADD CONSTRAINT `perfumes_categoria_id_fkey` FOREIGN KEY (`categoria_id`) REFERENCES `categorias`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `perfume_tipo_aroma` ADD CONSTRAINT `perfume_tipo_aroma_perfume_id_fkey` FOREIGN KEY (`perfume_id`) REFERENCES `perfumes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `perfume_tipo_aroma` ADD CONSTRAINT `perfume_tipo_aroma_tipo_aroma_id_fkey` FOREIGN KEY (`tipo_aroma_id`) REFERENCES `tipos_aroma`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `perfume_ocasion` ADD CONSTRAINT `perfume_ocasion_perfume_id_fkey` FOREIGN KEY (`perfume_id`) REFERENCES `perfumes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `perfume_ocasion` ADD CONSTRAINT `perfume_ocasion_ocasion_id_fkey` FOREIGN KEY (`ocasion_id`) REFERENCES `ocasiones`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `combos` ADD CONSTRAINT `combos_categoria_id_fkey` FOREIGN KEY (`categoria_id`) REFERENCES `categorias`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RedefineIndex
CREATE UNIQUE INDEX `categorias_nombre_key` ON `categorias`(`nombre`);
DROP INDEX `nombre` ON `categorias`;

-- RedefineIndex
CREATE UNIQUE INDEX `ocasiones_nombre_key` ON `ocasiones`(`nombre`);
DROP INDEX `nombre` ON `ocasiones`;

-- RedefineIndex
CREATE UNIQUE INDEX `roles_nombre_key` ON `roles`(`nombre`);
DROP INDEX `nombre` ON `roles`;

-- RedefineIndex
CREATE UNIQUE INDEX `tipos_aroma_nombre_key` ON `tipos_aroma`(`nombre`);
DROP INDEX `nombre` ON `tipos_aroma`;

-- RedefineIndex
CREATE UNIQUE INDEX `users_email_key` ON `users`(`email`);
DROP INDEX `email` ON `users`;
