-- Icono de plataforma opcional en los links de Contáctame (ej: mostrar TikTok en un botón).
ALTER TABLE `contacto_links` ADD COLUMN `icono` VARCHAR(30) NULL AFTER `emoji`;
