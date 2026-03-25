-- Migration 016: Corregir v_shift_summary
-- 1. Incluir pagos parciales en cash_sales y transfer_sales
-- 2. Incluir abonos de fiado en cash_sales
-- 3. Excluir fiados de total_sales (se cuentan como ingreso cuando se cobran, no cuando se crean)

CREATE OR REPLACE VIEW v_shift_summary AS
WITH partial_by_shift AS (
  SELECT
    ps.shift_id,
    COALESCE(SUM(pp.cash_amount), 0)     AS partial_cash,
    COALESCE(SUM(pp.transfer_amount), 0) AS partial_transfer
  FROM partial_payments pp
  JOIN sales ps ON ps.id = pp.sale_id AND ps.voided = false
  GROUP BY ps.shift_id
)
SELECT
  sh.id                AS shift_id,
  sh.start_time,
  sh.end_time,
  sh.type,
  e.name               AS employee_name,
  sh.cash_start,
  sh.transfer_start,
  sh.cash_end,
  -- Efectivo: pagos cash + abonos de fiado + pagos parciales en efectivo
  COALESCE(SUM(CASE WHEN s.payment_method IN ('cash', 'fiado') THEN s.cash_amount ELSE 0 END), 0)
    + COALESCE(MAX(pbs.partial_cash), 0)     AS cash_sales,
  -- Transferencia: pagos transfer + pagos parciales en transferencia
  COALESCE(SUM(CASE WHEN s.payment_method = 'transfer' THEN s.transfer_amount ELSE 0 END), 0)
    + COALESCE(MAX(pbs.partial_transfer), 0) AS transfer_sales,
  COALESCE(SUM(CASE WHEN s.payment_method = 'mixed' THEN s.cash_amount     ELSE 0 END), 0) AS mixed_cash,
  COALESCE(SUM(CASE WHEN s.payment_method = 'mixed' THEN s.transfer_amount ELSE 0 END), 0) AS mixed_transfer,
  -- Total: excluir fiados (se registran como ingreso cuando el cliente paga, no cuando se crea la venta)
  COALESCE(SUM(CASE WHEN s.payment_method != 'fiado' THEN s.total ELSE 0 END), 0) AS total_sales,
  COALESCE(SUM(s.cash_change), 0)                                                  AS total_change,
  COUNT(s.id) FILTER (WHERE s.status = 'closed') AS transactions_count,
  COUNT(s.id) FILTER (WHERE s.status = 'open')   AS open_tabs_count,
  sh.is_active
FROM shifts sh
JOIN employees e ON e.id = sh.employee_id
LEFT JOIN sales s ON s.shift_id = sh.id AND s.voided = false
LEFT JOIN partial_by_shift pbs ON pbs.shift_id = sh.id
GROUP BY sh.id, e.name;
