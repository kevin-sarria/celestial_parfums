-- Módulo de Cotizaciones Mayoristas (B2B). 100% interno (solo admin).
-- Local se aplicó con `prisma db push`; en producción aplicar este SQL
-- (o `prisma migrate deploy` si el historial lo permite).

-- Insumos con su costo actual (esencias, envases, accesorios…).
CREATE TABLE `insumos_costo` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(120) NOT NULL,
  `tipo` ENUM('materia_prima','envase','accesorio') NOT NULL,
  `unidad` ENUM('ml','unidad') NOT NULL DEFAULT 'unidad',
  `precio` DECIMAL(10,2) NOT NULL,
  `activo` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `insumos_costo_tipo_activo_idx`(`tipo`, `activo`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- Tamaños fabricables con su fórmula (el diluyente se calcula, no se guarda).
CREATE TABLE `formulas_volumen` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(60) NOT NULL,
  `ml_total` INT NOT NULL,
  `esencia_ml` DECIMAL(6,2) NOT NULL,
  `sellador_ml` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `feromonas_ml` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `envase_insumo_id` INT NULL,
  `activo` BOOLEAN NOT NULL DEFAULT true,
  `orden` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `formulas_volumen_activo_idx`(`activo`),
  INDEX `formulas_volumen_envase_insumo_id_fkey`(`envase_insumo_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `formulas_volumen_envase_insumo_id_fkey` FOREIGN KEY (`envase_insumo_id`) REFERENCES `insumos_costo`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4;

-- Precio mayorista por rango de cantidad (se evalúa por línea de la cotización).
CREATE TABLE `escalas_precio` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `formula_volumen_id` INT NOT NULL,
  `cantidad_min` INT NOT NULL,
  `cantidad_max` INT NULL,
  `precio` DECIMAL(10,2) NOT NULL,
  INDEX `escalas_precio_formula_volumen_id_cantidad_min_idx`(`formula_volumen_id`, `cantidad_min`),
  PRIMARY KEY (`id`),
  CONSTRAINT `escalas_precio_formula_volumen_id_fkey` FOREIGN KEY (`formula_volumen_id`) REFERENCES `formulas_volumen`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4;

-- Textos y valores por defecto (fila única).
CREATE TABLE `cotizacion_config` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `vigencia_dias_default` INT NOT NULL DEFAULT 15,
  `condiciones_comerciales` JSON NOT NULL,
  `beneficios_items` JSON NOT NULL,
  `avisos_legales` JSON NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- Plantillas comerciales (Mayorista, Distribuidor…), nombre libre.
CREATE TABLE `plantillas_cotizacion` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(80) NOT NULL,
  `descuento_pct` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `condiciones_comerciales` JSON NULL,
  `observaciones_default` TEXT NULL,
  `activo` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

-- Cabecera de la cotización (datos del cliente en texto libre a propósito).
CREATE TABLE `cotizaciones` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `numero` VARCHAR(20) NOT NULL,
  `cliente_nombre` VARCHAR(150) NOT NULL,
  `cliente_empresa` VARCHAR(150) NULL,
  `cliente_telefono` VARCHAR(30) NULL,
  `cliente_email` VARCHAR(150) NULL,
  `cliente_nit` VARCHAR(50) NULL,
  `plantilla_id` INT NULL,
  `subtotal` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `descuento_pct` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `vigencia_dias` INT NOT NULL DEFAULT 15,
  `fecha_vigencia` DATE NOT NULL,
  `condiciones_comerciales` JSON NOT NULL,
  `observaciones` TEXT NULL,
  `estado` ENUM('borrador','enviada') NOT NULL DEFAULT 'borrador',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `cotizaciones_numero_key`(`numero`),
  INDEX `cotizaciones_estado_created_at_idx`(`estado`, `created_at`),
  INDEX `cotizaciones_plantilla_id_fkey`(`plantilla_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `cotizaciones_plantilla_id_fkey` FOREIGN KEY (`plantilla_id`) REFERENCES `plantillas_cotizacion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4;

-- Líneas de la cotización (congelan nombre, accesorios y desglose de costo).
CREATE TABLE `cotizacion_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `cotizacion_id` INT NOT NULL,
  `perfume_id` INT NULL,
  `perfume_nombre` VARCHAR(150) NOT NULL,
  `formula_volumen_id` INT NULL,
  `volumen_nombre` VARCHAR(60) NOT NULL,
  `cantidad` INT NOT NULL,
  `accesorios_seleccionados` JSON NOT NULL,
  `desglose_costo` JSON NOT NULL,
  `precio_unitario` DECIMAL(10,2) NOT NULL,
  `subtotal` DECIMAL(10,2) NOT NULL,
  `orden` INT NOT NULL DEFAULT 0,
  INDEX `cotizacion_items_cotizacion_id_idx`(`cotizacion_id`),
  INDEX `cotizacion_items_perfume_id_fkey`(`perfume_id`),
  INDEX `cotizacion_items_formula_volumen_id_fkey`(`formula_volumen_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `cotizacion_items_cotizacion_id_fkey` FOREIGN KEY (`cotizacion_id`) REFERENCES `cotizaciones`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `cotizacion_items_perfume_id_fkey` FOREIGN KEY (`perfume_id`) REFERENCES `perfumes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `cotizacion_items_formula_volumen_id_fkey` FOREIGN KEY (`formula_volumen_id`) REFERENCES `formulas_volumen`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4;
