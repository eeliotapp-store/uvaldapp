-- Migración: Cambiar de PIN a Usuario/Contraseña
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columna username
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;

-- 2. Agregar columna password_hash si no existe
-- (Maneja el caso donde ya existe password_hash o donde existe pin_hash)
DO $$
BEGIN
    -- Intentar renombrar pin_hash a password_hash
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'employees' AND column_name = 'pin_hash') THEN
        ALTER TABLE employees RENAME COLUMN pin_hash TO password_hash;
    -- Si no existe pin_hash, verificar si ya existe password_hash
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'employees' AND column_name = 'password_hash') THEN
        ALTER TABLE employees ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT '';
    END IF;
END $$;

-- 3. Actualizar empleados existentes con un username basado en su nombre
-- (Luego deberás cambiarlos manualmente)
UPDATE employees
SET username = LOWER(REPLACE(name, ' ', '_'))
WHERE username IS NULL;

-- 4. Hacer username NOT NULL después de la actualización
ALTER TABLE employees
ALTER COLUMN username SET NOT NULL;

-- 5. Crear índice para búsquedas rápidas por username
CREATE INDEX IF NOT EXISTS idx_employees_username ON employees(username);

-- 6. Para crear un empleado con contraseña, usa este script en Node.js:
-- node -e "import('bcrypt-ts').then(b => b.hash('tucontraseña', 10).then(h => console.log(h)))"
--
-- Luego actualiza el empleado:
-- UPDATE employees
-- SET username = 'admin', password_hash = '$2b$10$...'
-- WHERE role = 'owner';
