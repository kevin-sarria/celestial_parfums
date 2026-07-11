-- CreateIndex
CREATE INDEX `combos_activo_idx` ON `combos`(`activo`);

-- CreateIndex
CREATE INDEX `creditos_fecha_idx` ON `creditos`(`fecha`);

-- CreateIndex
CREATE INDEX `pagos_proveedor_dia_idx` ON `pagos_proveedor`(`dia`);

-- CreateIndex
CREATE INDEX `perfumes_genero_idx` ON `perfumes`(`genero`);

-- CreateIndex
CREATE INDEX `perfumes_nombre_idx` ON `perfumes`(`nombre`);

-- CreateIndex
CREATE INDEX `ventas_dia_idx` ON `ventas`(`dia`);

-- CreateIndex (FK indexes - create only if not exists)
CREATE INDEX `combos_categoria_id_idx` ON `combos`(`categoria_id`);

CREATE INDEX `creditos_cliente_id_idx` ON `creditos`(`cliente_id`);

CREATE INDEX `pagos_proveedor_empresa_id_idx` ON `pagos_proveedor`(`empresa_id`);

CREATE INDEX `perfumes_categoria_id_idx` ON `perfumes`(`categoria_id`);
