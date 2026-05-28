-- Agrega la categoría 'cigarros' al enum product_category
-- Usada para ventas de mostrador (clientes que compran sin mesa)
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'cigarros';
