-- Un 1.1 no lleva bolsa de organza ni perfumero (dueño, 2026-08-30: "al generar
-- un perfume 1.1 estos normalmente no llevan bolsa de organza o perfumero…
-- actualmente el coste no es el real").
--
-- Desde el 2026-09-27 la columna distingue dos cosas que antes eran una:
--   NULL = los accesorios de la receta del tamaño (lo normal)
--   []   = NINGUNO
-- Los 1.1 nuevos ya nacen con [] (`crearProductoArmado`, `createPerfume`). Esto
-- deja igual a los que ya existían, que estaban en NULL y por eso cargaban la
-- bolsa de la receta. Solo toca los que no tenían nada propio: si alguien ya
-- les había puesto una lista, se respeta.
--
-- Los lotes ya armados NO se corrigen aquí (hay que devolver material y rehacer
-- promedios, que es lógica de la aplicación): los corrige el dueño desde el
-- aviso de Producciones, viendo antes la cifra.
UPDATE `perfume_presentacion` pp
JOIN `perfumes` p ON p.`id` = pp.`perfume_id`
SET pp.`accesorios` = JSON_ARRAY()
WHERE p.`solo_armado` = 1
  AND pp.`accesorios` IS NULL;
