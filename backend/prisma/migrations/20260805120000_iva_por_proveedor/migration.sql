-- IVA de compras, configurado POR PROVEEDOR.
--
-- No es un porcentaje global: el distribuidor principal entrega el precio ya con
-- IVA, otros lo suman aparte, y las compras al exterior no lo cobran. Un 19%
-- aplicado a todos contaría el impuesto dos veces con el proveedor mas grande, y
-- como el costo promedio ponderado se arrastra, ese error no se deshace despues.
--
-- El default es 'incluido' A PROPOSITO: es el comportamiento actual (el costo no
-- cambia) asi que ninguna compra ya registrada mueve su promedio al aplicar esto.

-- 1) Como factura cada proveedor
ALTER TABLE `empresas`
  ADD COLUMN `iva_modo` ENUM('incluido','agregado','sin_iva') NOT NULL DEFAULT 'incluido';

-- 2) Lo aplicado en cada factura, congelado
ALTER TABLE `pagos_proveedor`
  ADD COLUMN `iva_modo`  ENUM('incluido','agregado','sin_iva') NULL,
  ADD COLUMN `iva_tasa`  DECIMAL(5,4) NULL,
  ADD COLUMN `iva_valor` DECIMAL(12,2) NOT NULL DEFAULT 0;

-- 3) Desglose por linea: base gravable e impuesto. Guardar solo el total no
--    permite declarar ni, mas adelante, emitir factura electronica.
ALTER TABLE `compra_items`
  ADD COLUMN `base_gravable` DECIMAL(12,4) NULL,
  ADD COLUMN `iva_valor`     DECIMAL(12,4) NULL;

-- 4) Configuracion tributaria del negocio (fila unica)
CREATE TABLE `negocio_config` (
  `id`              INT          NOT NULL DEFAULT 1,
  `responsable_iva` TINYINT(1)   NOT NULL DEFAULT 0,
  `iva_tasa`        DECIMAL(5,4) NOT NULL DEFAULT 0.1900,
  `updated_at`      DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Se siembra con el caso REAL de hoy: el dueño no esta constituido como empresa,
-- asi que no es responsable de IVA y el impuesto que paga ES costo suyo.
-- Cada columna va aliaseada: sin alias, MySQL usa el literal como nombre de
-- columna y dos valores iguales rompen la migracion con "Duplicate column name".
INSERT INTO `negocio_config` (`id`, `responsable_iva`, `iva_tasa`, `updated_at`)
SELECT * FROM (SELECT 1 AS id, 0 AS responsable_iva, 0.1900 AS iva_tasa, NOW(3) AS updated_at) AS seed
WHERE NOT EXISTS (SELECT 1 FROM `negocio_config`);
