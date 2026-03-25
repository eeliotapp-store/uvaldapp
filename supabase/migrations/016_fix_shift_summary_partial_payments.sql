-- Migration 016: Incluir pagos parciales en v_shift_summary
-- La vista anterior solo sumaba el pago del cierre (cash_amount/transfer_amount de sales),
-- ignorando los pagos parciales previos registrados en la tabla partial_payments.
-- Esto causaba que cash_sales + transfer_sales + mixed no sumara el total_sales.

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
  -- Efectivo: cierre cash + pagos parciales en efectivo
  COALESCE(SUM(CASE WHEN s.payment_method = 'cash' THEN s.cash_amount ELSE 0 END), 0)
    + COALESCE(MAX(pbs.partial_cash), 0)     AS cash_sales,
  -- Transferencia: cierre transfer + pagos parciales en transferencia
  COALESCE(SUM(CASE WHEN s.payment_method = 'transfer' THEN s.transfer_amount ELSE 0 END), 0)
    + COALESCE(MAX(pbs.partial_transfer), 0) AS transfer_sales,
  COALESCE(SUM(CASE WHEN s.payment_method = 'mixed' THEN s.cash_amount     ELSE 0 END), 0) AS mixed_cash,
  COALESCE(SUM(CASE WHEN s.payment_method = 'mixed' THEN s.transfer_amount ELSE 0 END), 0) AS mixed_transfer,
  COALESCE(SUM(s.total), 0)                                                                  AS total_sales,
  COALESCE(SUM(s.cash_change), 0)                                                            AS total_change,
  COUNT(s.id) FILTER (WHERE s.status = 'closed') AS transactions_count,
  COUNT(s.id) FILTER (WHERE s.status = 'open')   AS open_tabs_count,
  sh.is_active
FROM shifts sh
JOIN employees e ON e.id = sh.employee_id
LEFT JOIN sales s ON s.shift_id = sh.id AND s.voided = false
LEFT JOIN partial_by_shift pbs ON pbs.shift_id = sh.id
GROUP BY sh.id, e.name;
