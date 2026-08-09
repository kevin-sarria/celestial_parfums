-- Gama de la esencia: la CALIDAD de la esencia pura (decisión del dueño).
--
-- Hace falta para costear cuando todavía no se sabe qué fragancia se va a
-- armar: la cotización general al mayoreo ("50 de 30 ml") no dice cuáles son, y
-- costearla con una esencia cualquiera da un margen que no es de nadie.
-- Cuando el perfume SÍ se conoce, sigue mandando su esencia, no la gama.
ALTER TABLE `insumos_costo`
  ADD COLUMN `gama` ENUM('clasica','arabe','premium','disenador') NULL;

-- Siembra por precio. No es una adivinanza: sobre las 216 esencias cargadas no
-- hay 216 precios distintos sino 7, en tres escalones muy marcados
--   230 (43) · 280 (18)            -> clásica
--   350 (91) · 380 (33) · 450 (3) · 480 (24) -> árabe
--   1500 (4)                       -> premium
-- El dueño revisa y corrige lo que haga falta desde la pantalla de Inventario;
-- esto solo evita tener que marcar 216 registros a mano.
UPDATE `insumos_costo`
   SET `gama` = CASE
                  WHEN `precio` < 300 THEN 'clasica'
                  WHEN `precio` < 800 THEN 'arabe'
                  ELSE 'premium'
                END
 WHERE `tipo` = 'materia_prima'
   AND LOWER(`nombre`) LIKE '%esencia%'
   AND `precio` > 0;

-- El diluyente, el sellador y las feromonas también son materia prima pero NO
-- son esencias: no llevan gama. Se excluyen por nombre, igual que hace el
-- selector de esencias del dashboard.
UPDATE `insumos_costo`
   SET `gama` = NULL
 WHERE LOWER(`nombre`) LIKE '%diluyente%'
    OR LOWER(`nombre`) LIKE '%sellador%'
    OR LOWER(`nombre`) LIKE '%feromona%';
