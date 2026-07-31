-- Vista de estadísticas mensuales, mismo patrón que v_daily_stats / v_weekly_stats
CREATE OR REPLACE VIEW v_monthly_stats AS
SELECT
  DATE_TRUNC('month', s.created_at)::date as month_start,
  (DATE_TRUNC('month', s.created_at) + INTERVAL '1 month' - INTERVAL '1 day')::date as month_end,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'closed') as total_sales,
  COALESCE(SUM(s.total) FILTER (WHERE s.status = 'closed'), 0) as total_revenue,
  COALESCE(SUM(s.cash_amount) FILTER (WHERE s.status = 'closed'), 0) as cash_revenue,
  COALESCE(SUM(s.transfer_amount) FILTER (WHERE s.status = 'closed'), 0) as transfer_revenue,
  COUNT(DISTINCT s.employee_id) as employees_worked,
  COUNT(DISTINCT DATE(s.created_at)) as days_worked
FROM sales s
WHERE s.voided = false
GROUP BY DATE_TRUNC('month', s.created_at)
ORDER BY month_start DESC;
