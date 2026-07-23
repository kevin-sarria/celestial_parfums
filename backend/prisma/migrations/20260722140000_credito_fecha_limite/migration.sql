-- Acuerdo de pago del credito: fecha limite pactada (por defecto 1 mes desde la
-- fecha del credito). Los creditos con cupon vencidos reciben castigo extra de cupo.
ALTER TABLE `creditos` ADD COLUMN `fecha_limite` DATE NULL;

-- Retro-completar los creditos existentes: un mes despues de su fecha.
UPDATE `creditos` SET `fecha_limite` = DATE_ADD(`fecha`, INTERVAL 1 MONTH) WHERE `fecha_limite` IS NULL;
