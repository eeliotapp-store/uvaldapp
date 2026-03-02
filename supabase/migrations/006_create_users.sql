-- Migration 006: Crear usuarios del sistema
-- Agregar rol superadmin y crear usuarios

-- Paso 1: Agregar el valor 'superadmin' al enum employee_role
-- Necesita estar en transacción separada
ALTER TYPE employee_role ADD VALUE IF NOT EXISTS 'superadmin';

-- Nota: Después de ejecutar la línea anterior, ejecutar el resto en otra query
