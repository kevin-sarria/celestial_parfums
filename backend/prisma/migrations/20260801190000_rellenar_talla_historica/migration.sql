-- Rellena la talla de las lineas de venta historicas.
--
-- Por que hacia falta: la talla SIEMPRE se registro, pero como UN texto para
-- toda la venta (`ventas.presentacion` = "30 ML", "100 ML - 1.1"...). Al pasar
-- la venta a lineas, `venta_perfume.ml` nacio en NULL porque no habia un dato
-- por producto de donde copiarlo. El texto de la venta SI lo dice: si toda la
-- venta fue de 30 ML, sus productos son de 30 ml.
--
-- Solo se rellena cuando el texto es INEQUIVOCO. Se quedan en NULL a proposito:
--   "200/250 ML" -> es un apaño para marcar splash de 200 Y de 250; no se sabe
--                   cual llevo cada uno, y adivinar meteria un dato falso.
--   "Combo Personalizado" y "—" -> no dicen ninguna talla.
--   Cualquier texto con dos tallas ("1 de 30 ml y 2 de 60 ml") -> ambiguo igual.
--
-- No toca el inventario ni los costos: `ventas.costo_mercancia` sigue en 0 para
-- lo historico. El consumo arranca desde que se active, nunca hacia atras.

UPDATE `venta_perfume` vp
  JOIN `ventas` v ON v.`id` = vp.`venta_id`
   SET vp.`ml` = CAST(REGEXP_SUBSTR(v.`presentacion`, '[0-9]+') AS UNSIGNED)
 WHERE vp.`ml` IS NULL
   -- Empieza por el numero y su "ml": descarta "Combo Personalizado" y "—"
   AND v.`presentacion` REGEXP '^[0-9]+ *[mM][lL]'
   -- Una sola talla en el texto: descarta "200/250 ML" y los mixtos
   AND v.`presentacion` NOT REGEXP '[0-9]+ *[mM][lL].*[0-9]+ *[mM][lL]'
   AND v.`presentacion` NOT LIKE '%/%';
