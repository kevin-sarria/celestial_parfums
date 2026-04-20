-- =========================
-- BASE DE DATOS
-- =========================
CREATE DATABASE IF NOT EXISTS perfumes_db;
USE perfumes_db;

-- =========================
-- TABLA: roles
-- =========================
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE
);

-- =========================
-- TABLA: users
-- =========================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL DEFAULT '',
    apellido VARCHAR(100) NOT NULL DEFAULT '',
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    rol_id INT NOT NULL,
    activo BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255) DEFAULT NULL,
    token_expiry DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (rol_id) REFERENCES roles(id)
);

-- =========================
-- TABLA: categorias
-- =========================
CREATE TABLE categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =========================
-- TABLA: perfumes
-- =========================
CREATE TABLE perfumes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10,2) NOT NULL,
    duracion VARCHAR(50),
    proyeccion VARCHAR(50),
    imagen_url TEXT,
    genero ENUM('hombre', 'mujer') DEFAULT NULL,
    categoria_id INT DEFAULT NULL,
    descuento TINYINT UNSIGNED DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL
);

-- =========================
-- TABLA: tipos_aroma
-- =========================
CREATE TABLE tipos_aroma (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =========================
-- TABLA: perfume_tipo_aroma (N:M)
-- =========================
CREATE TABLE perfume_tipo_aroma (
    perfume_id INT,
    tipo_aroma_id INT,
    PRIMARY KEY (perfume_id, tipo_aroma_id),
    FOREIGN KEY (perfume_id) REFERENCES perfumes(id) ON DELETE CASCADE,
    FOREIGN KEY (tipo_aroma_id) REFERENCES tipos_aroma(id) ON DELETE CASCADE
);

-- =========================
-- TABLA: ocasiones
-- =========================
CREATE TABLE ocasiones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =========================
-- TABLA: perfume_ocasion (N:M)
-- =========================
CREATE TABLE perfume_ocasion (
    perfume_id INT,
    ocasion_id INT,
    PRIMARY KEY (perfume_id, ocasion_id),
    FOREIGN KEY (perfume_id) REFERENCES perfumes(id) ON DELETE CASCADE,
    FOREIGN KEY (ocasion_id) REFERENCES ocasiones(id) ON DELETE CASCADE
);

-- =========================
-- TABLA: combos
-- Combos de N perfumes a elección del cliente
-- =========================
CREATE TABLE combos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    imagen_url TEXT,
    categoria_id INT,
    cantidad INT NOT NULL,
    precio DECIMAL(10,2) NOT NULL,
    descuento TINYINT UNSIGNED DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL
);

-- =========================
-- Si ya tienes la DB corriendo, ejecuta estas migraciones:
-- ALTER TABLE perfumes ADD COLUMN descuento TINYINT UNSIGNED DEFAULT 0;
-- ALTER TABLE combos ADD COLUMN imagen_url TEXT AFTER descripcion;
-- ALTER TABLE combos ADD COLUMN categoria_id INT AFTER imagen_url;
-- ALTER TABLE combos ADD FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL;
-- DROP TABLE IF EXISTS descuento_combo, descuento_perfume, descuentos, combo_perfume;
-- DROP TABLE IF EXISTS combos;
-- Luego crea la nueva tabla combos desde arriba.
-- =========================
