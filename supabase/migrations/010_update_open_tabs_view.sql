-- Migration 010: Actualizar vista v_open_tabs para incluir is_michelada y combo_id
-- Necesario para mostrar cervezas micheladas y combos en la UI

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
          'combo_name', c.name
        )
      )
      FROM sale_items si
      JOIN products p ON p.id = si.product_id
      LEFT JOIN combos c ON c.id = si.combo_id
      WHERE si.sale_id = s.id
    ),
    '[]'::json
  ) as items
FROM sales s
JOIN employees e ON e.id = s.employee_id
LEFT JOIN employees oe ON oe.id = s.opened_by_employee_id
LEFT JOIN employees te ON te.id = s.taken_over_by_employee_id
WHERE s.status = 'open';
