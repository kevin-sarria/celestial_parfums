USE perfumes_db;

-- =========================
-- roles
-- =========================
INSERT INTO roles (nombre) VALUES
('ADMIN'),
('CLIENTE'),
('PROVEEDOR');

-- =========================
-- tipos_aroma
-- =========================
INSERT INTO tipos_aroma (nombre) VALUES
('Dulce'),
('Cítrico'),
('Amaderado'),
('Fresco'),
('Aromático'),
('Oriental'),
('Floral');

-- =========================
-- ocasiones
-- =========================
INSERT INTO ocasiones (nombre) VALUES
('Diario'),
('Oficina'),
('Citas'),
('Noche'),
('Eventos'),
('Calor'),
('Frio');

-- =========================
-- categorias
-- =========================
INSERT INTO categorias (nombre) VALUES
('1.1'),
('Contratipo'),
('Original');

-- =========================
-- perfumes
-- =========================
INSERT INTO perfumes (nombre, precio, descripcion, genero, categoria_id) VALUES
('Acqua Di Gio', 120000, 'Fresco marino clásico', 'hombre', 2),
('9PM Afnan', 130000, 'Dulce nocturno potente', 'hombre', 3),
('Sauvage Dior', 150000, 'Aromático moderno versátil', 'hombre', 3),
('Valentino Uomo Born in Roma', 160000, 'Elegante y dulce', 'hombre', 2),
('Lacoste Blanca', 110000, 'Fresco limpio diario', 'mujer', 1);

-- =========================
-- perfume_tipo_aroma
-- =========================
INSERT INTO perfume_tipo_aroma (perfume_id, tipo_aroma_id) VALUES
(1, 2), -- Acqua Di Gio – Cítrico
(1, 4), -- Acqua Di Gio – Fresco
(2, 1), -- 9PM – Dulce
(2, 6), -- 9PM – Oriental
(3, 5), -- Sauvage – Aromático
(4, 1), -- Valentino – Dulce
(4, 6), -- Valentino – Oriental
(5, 4); -- Lacoste – Fresco

-- =========================
-- perfume_ocasion
-- =========================
INSERT INTO perfume_ocasion (perfume_id, ocasion_id) VALUES
(1, 1), -- Acqua Di Gio – Diario
(1, 6), -- Acqua Di Gio – Calor
(2, 4), -- 9PM – Noche
(2, 3), -- 9PM – Citas
(3, 1), -- Sauvage – Diario
(3, 2), -- Sauvage – Oficina
(3, 4), -- Sauvage – Noche
(4, 3), -- Valentino – Citas
(4, 4), -- Valentino – Noche
(4, 5), -- Valentino – Eventos
(5, 1), -- Lacoste – Diario
(5, 2); -- Lacoste – Oficina
