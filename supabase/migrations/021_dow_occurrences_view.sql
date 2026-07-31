-- Cuántos días hábiles distintos de cada día de la semana tienen ventas registradas.
-- Sirve como denominador para convertir totales históricos por día de la semana
-- (v_sales_by_dow, v_product_sales_by_dow) en promedios por ocurrencia
-- ("un martes cualquiera, en promedio, se vende X") — la base de la predicción de "hoy".
DROP VIEW IF EXISTS v_dow_occurrences;
CREATE VIEW v_dow_occurrences AS
SELECT
  EXTRACT(DOW FROM fn_dia_habil(s.created_at))::int AS dow,
  COUNT(DISTINCT fn_dia_habil(s.created_at)) AS day_count
FROM sales s
WHERE s.voided = false AND s.status = 'closed'
GROUP BY 1;
