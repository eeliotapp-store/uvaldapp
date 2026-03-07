-- ============================================
-- MIGRACIÓN: TRACKING DE EMPLEADO POR ITEM
-- ============================================
-- Permite saber qué empleada agregó cada producto a una venta
-- Importante para comisiones y auditoría

-- Agregar campo para saber quién agregó cada item
ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS added_by_employee_id UUID REFERENCES employees(id);

-- Agregar campo para saber quién modificó el item (si aplica)
ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS modified_by_employee_id UUID REFERENCES employees(id);

-- Fecha de última modificación
ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS modified_at TIMESTAMPTZ;

-- Actualizar items existentes: asignar el employee_id de la venta
UPDATE sale_items si
SET added_by_employee_id = s.employee_id
FROM sales s
WHERE si.sale_id = s.id
AND si.added_by_employee_id IS NULL;

-- Índice para consultas por empleado
CREATE INDEX IF NOT EXISTS idx_sale_items_added_by ON sale_items(added_by_employee_id);

-- ============================================
-- ACTUALIZAR VISTA v_open_tabs
-- ============================================

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
  s.opened_by_employee_id,
  oe.name as opened_by_name,
  s.taken_over_by_employee_id,
  te.name as taken_over_by_name,
  s.taken_over_at,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', si.id,
          'product_id', si.product_id,
          'product_name', p.name,
          'quantity', si.quantity,
          'unit_price', si.unit_price,
          'subtotal', si.subtotal,
          'is_michelada', COALESCE(si.is_michelada, false),
          'combo_id', si.combo_id,
          'combo_name', c.name,
          'added_by_employee_id', si.added_by_employee_id,
          'added_by_name', ae.name
        )
      )
      FROM sale_items si
      JOIN products p ON p.id = si.product_id
      LEFT JOIN combos c ON c.id = si.combo_id
      LEFT JOIN employees ae ON ae.id = si.added_by_employee_id
      WHERE si.sale_id = s.id
    ),
    '[]'::json
  ) as items
FROM sales s
JOIN employees e ON e.id = s.employee_id
LEFT JOIN employees oe ON oe.id = s.opened_by_employee_id
LEFT JOIN employees te ON te.id = s.taken_over_by_employee_id
WHERE s.status = 'open';

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON COLUMN sale_items.added_by_employee_id IS 'Empleado que agregó este item a la venta';
COMMENT ON COLUMN sale_items.modified_by_employee_id IS 'Último empleado que modificó este item';
COMMENT ON COLUMN sale_items.modified_at IS 'Fecha de última modificación del item';
