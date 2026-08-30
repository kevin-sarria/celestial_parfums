-- Una devolución resuelta ya mueve inventario: hay que saber si el producto
-- volvió y si sirve para volver a venderse.
-- Decisión del dueño (2026-08-30): se pregunta caso por caso, no se deduce del
-- motivo — un "llegó equivocado" puede volver abierto y un "llegó dañado" puede
-- ser solo la caja.
ALTER TABLE `devoluciones`
  ADD COLUMN `producto_devuelto` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `revendible` BOOLEAN NOT NULL DEFAULT false;
