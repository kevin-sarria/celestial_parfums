-- Género de la esencia: para quién es la fragancia que sale de ella.
--
-- POR QUÉ HACE FALTA UNA COLUMNA Y NO BASTA EL NOMBRE
-- ---------------------------------------------------
-- El dueño ya distingue las esencias escribiendo "Dama" o "Caballero" en el
-- nombre, y lo hace porque puede haber dos fragancias de la misma línea (un
-- "212 VIP" de dama y otro de caballero) que son productos distintos.
--
-- Pero medido sobre los datos reales: de 216 esencias activas, **solo 27 lo
-- dicen en el nombre** (21 dama y 6 caballero). Las otras 189 no dicen nada,
-- porque la convención solo se usa cuando hace falta desempatar. Un dato que
-- está el 12% de las veces no sirve para decidir nada: por eso pasa a ser un
-- campo propio, que se puede consultar y filtrar siempre.
--
-- PARA QUÉ SE USA
--   1. El perfume que nace de una compra sale ya clasificado, en vez de con el
--      género vacío.
--   2. Al emparejar una esencia con su perfume, descarta candidatos del género
--      equivocado ("360 Dama" contra dos perfumes que son de caballero: la
--      respuesta correcta es que ninguno sirve, no elegir uno al azar).
--
-- Nace NULL en todo: no se inventa el género de las 189 que no lo dicen. Se va
-- llenando al pasar por cada esencia, y el que falte simplemente no filtra.

ALTER TABLE `insumos_costo`
  ADD COLUMN `genero` ENUM('dama', 'caballero', 'unisex') NULL AFTER `gama_id`;

-- Siembra desde el nombre, que es donde el dueño ya lo venía escribiendo.
-- Solo se marcan las que lo dicen explícitamente; el resto queda en NULL.
-- Se busca con espacio delante para no confundir palabras que lo contengan.
UPDATE `insumos_costo`
   SET `genero` = 'dama'
 WHERE `genero` IS NULL
   AND (`nombre` LIKE '% Dama%' OR `nombre` LIKE 'Dama %');

UPDATE `insumos_costo`
   SET `genero` = 'caballero'
 WHERE `genero` IS NULL
   AND (`nombre` LIKE '% Caballero%' OR `nombre` LIKE 'Caballero %');
