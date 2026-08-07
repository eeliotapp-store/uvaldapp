-- Agrega ingresos ($) a la vista de ventas por día de la semana, para poder mostrar
-- "cuánto vende en promedio cada [día]" en vez de solo el conteo de transacciones.
CREATE OR REPLACE VIEW v_sales_by_dow AS
SELECT
  EXTRACT(DOW FROM fn_dia_habil(s.created_at))::int AS dow,
  COUNT(*) AS sales_count,
  SUM(s.total) AS revenue
FROM sales s
WHERE s.voided = false AND s.status = 'closed'
GROUP BY 1;
