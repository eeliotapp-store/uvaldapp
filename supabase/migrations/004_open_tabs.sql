-- Migración: Sistema de cuentas abiertas (tabs)
-- Ejecutar en Supabase SQL Editor

-- 1. Crear tipo enum para estado de venta
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sale_status') THEN
        CREATE TYPE sale_status AS ENUM ('open', 'closed', 'voided');
    END IF;
END $$;

-- 2. Agregar columnas para cuentas abiertas
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS status sale_status DEFAULT 'closed',
ADD COLUMN IF NOT EXISTS table_number VARCHAR(20);

-- 3. Actualizar ventas existentes como cerradas (ya pagadas)
UPDATE sales
SET status = 'closed'
WHERE status IS NULL;

-- 4. Crear índice para búsquedas rápidas de cuentas abiertas
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_table_number ON sales(table_number);

-- 5. Vista de cuentas abiertas
DROP VIEW IF EXISTS v_open_tabs;
CREATE VIEW v_open_tabs AS
SELECT
    s.id,
    s.table_number,
    s.created_at,
    s.total,
    s.employee_id,
    e.name as employee_name,
    s.shift_id,
    (
        SELECT json_agg(json_build_object(
            'id', si.id,
            'product_id', si.product_id,
            'product_name', p.name,
            'quantity', si.quantity,
            'unit_price', si.unit_price,
            'subtotal', si.subtotal
        ))
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = s.id
    ) as items
FROM sales s
JOIN employees e ON s.employee_id = e.id
WHERE s.status = 'open'
ORDER BY s.created_at DESC;
