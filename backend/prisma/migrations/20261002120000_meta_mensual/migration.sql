-- Meta de ventas del mes (2026-10-02): el dueño pone cuánto quiere vender y
-- Inicio le enseña cuánto lleva. Una fila por mes ("2026-10"): la meta de
-- octubre no reescribe la de septiembre.
CREATE TABLE `metas_mensuales` (
    `mes` CHAR(7) NOT NULL,
    `monto` DECIMAL(12, 2) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`mes`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
