-- Migration 005: Handoff tracking y mejoras de turno
-- Permite que otro empleado tome una cuenta abierta y registra quién la abrió,
-- quién la tomó y quién la cerró

-- Agregar columnas para tracking de traspaso en ventas
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS opened_by_employee_id UUID REFERENCES employees(id),
ADD COLUMN IF NOT EXISTS taken_over_by_employee_id UUID REFERENCES employees(id),
ADD COLUMN IF NOT EXISTS taken_over_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS closed_by_employee_id UUID REFERENCES employees(id);

-- Agregar transfer_start a shifts (monto inicial en transferencias)
ALTER TABLE shifts
ADD COLUMN IF NOT EXISTS transfer_start DECIMAL(12,2) DEFAULT 0;

-- Actualizar ventas existentes: el employee_id original es quien abrió
UPDATE sales
SET opened_by_employee_id = employee_id
WHERE opened_by_employee_id IS NULL;

-- Para ventas cerradas, marcar quién las cerró
UPDATE sales
SET closed_by_employee_id = employee_id
WHERE status = 'closed' AND closed_by_employee_id IS NULL;

-- Actualizar vista de cuentas abiertas para incluir info de traspaso
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
          'subtotal', si.subtotal
        )
      )
      FROM sale_items si
      JOIN products p ON p.id = si.product_id
      WHERE si.sale_id = s.id
    ),
    '[]'::json
  ) as items
FROM sales s
JOIN employees e ON e.id = s.employee_id
LEFT JOIN employees oe ON oe.id = s.opened_by_employee_id
LEFT JOIN employees te ON te.id = s.taken_over_by_employee_id
WHERE s.status = 'open';

-- Vista mejorada de resumen de turno con transferencias
DROP VIEW IF EXISTS v_shift_summary;

CREATE VIEW v_shift_summary AS
SELECT
  sh.id as shift_id,
  sh.start_time,
  sh.end_time,
  sh.type,
  e.name as employee_name,
  sh.cash_start,
  sh.transfer_start,
  sh.cash_end,
  COALESCE(SUM(CASE WHEN s.payment_method = 'cash' THEN s.cash_amount ELSE 0 END), 0) as cash_sales,
  COALESCE(SUM(CASE WHEN s.payment_method = 'transfer' THEN s.transfer_amount ELSE 0 END), 0) as transfer_sales,
  COALESCE(SUM(CASE WHEN s.payment_method = 'mixed' THEN s.cash_amount ELSE 0 END), 0) as mixed_cash,
  COALESCE(SUM(CASE WHEN s.payment_method = 'mixed' THEN s.transfer_amount ELSE 0 END), 0) as mixed_transfer,
  COALESCE(SUM(s.total), 0) as total_sales,
  COALESCE(SUM(s.cash_change), 0) as total_change,
  COUNT(s.id) FILTER (WHERE s.status = 'closed') as transactions_count,
  COUNT(s.id) FILTER (WHERE s.status = 'open') as open_tabs_count,
  sh.is_active
FROM shifts sh
JOIN employees e ON e.id = sh.employee_id
LEFT JOIN sales s ON s.shift_id = sh.id AND s.voided = false
GROUP BY sh.id, e.name;

-- Vista de estadísticas diarias
CREATE OR REPLACE VIEW v_daily_stats AS
SELECT
  DATE(s.created_at) as date,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'closed') as total_sales,
  COALESCE(SUM(s.total) FILTER (WHERE s.status = 'closed'), 0) as total_revenue,
  COALESCE(SUM(s.cash_amount) FILTER (WHERE s.status = 'closed'), 0) as cash_revenue,
  COALESCE(SUM(s.transfer_amount) FILTER (WHERE s.status = 'closed'), 0) as transfer_revenue,
  COUNT(DISTINCT s.employee_id) as employees_worked,
  COUNT(DISTINCT s.shift_id) as shifts_count
FROM sales s
WHERE s.voided = false
GROUP BY DATE(s.created_at)
ORDER BY date DESC;

-- Vista de estadísticas semanales
CREATE OR REPLACE VIEW v_weekly_stats AS
SELECT
  DATE_TRUNC('week', s.created_at)::date as week_start,
  DATE_TRUNC('week', s.created_at)::date + 6 as week_end,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'closed') as total_sales,
  COALESCE(SUM(s.total) FILTER (WHERE s.status = 'closed'), 0) as total_revenue,
  COALESCE(SUM(s.cash_amount) FILTER (WHERE s.status = 'closed'), 0) as cash_revenue,
  COALESCE(SUM(s.transfer_amount) FILTER (WHERE s.status = 'closed'), 0) as transfer_revenue,
  COUNT(DISTINCT s.employee_id) as employees_worked,
  COUNT(DISTINCT DATE(s.created_at)) as days_worked
FROM sales s
WHERE s.voided = false
GROUP BY DATE_TRUNC('week', s.created_at)
ORDER BY week_start DESC;
