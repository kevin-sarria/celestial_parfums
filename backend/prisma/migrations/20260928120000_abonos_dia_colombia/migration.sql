-- Los abonos anotados después de las 7:00 p.m. de Colombia quedaron con el día
-- SIGUIENTE: el servidor guardaba el día en UTC (Colombia va en UTC-5).
-- Solo se tocan los que anotó el sistema en ese momento (su `fecha` coincide con
-- el día UTC de `created_at` y la hora UTC es antes de las 5:00); los que se
-- cargaron con otra fecha a propósito quedan como están.
-- En el respaldo del 2026-09-22 son dos: el 11 (28→27 ago) y el 20 (22→21 sep).
UPDATE `credito_abonos`
SET `fecha` = DATE(DATE_SUB(`created_at`, INTERVAL 5 HOUR))
WHERE `fecha` = DATE(`created_at`)
  AND TIME(`created_at`) < '05:00:00';
