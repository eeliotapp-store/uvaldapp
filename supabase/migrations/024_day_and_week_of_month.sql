-- Patrones dentro del mes: qué día del mes (ej. el 15, el 30) y qué semana del mes
-- (semana 1 = días 1-7 ... semana 4 = días 22-31, la última absorbe la cola del mes)
-- venden más en promedio, históricamente.
-- Mismo criterio de "día hábil" que el resto de reportes (fn_dia_habil, migración 001).

-- Total y promedio de ventas por número de día del mes (1-31)
DROP VIEW IF EXISTS v_sales_by_dom;
CREATE VIEW v_sales_by_dom AS
SELECT
  EXTRACT(DAY FROM fn_dia_habil(s.created_at))::int AS dom,
  COUNT(*) AS sales_count,
  SUM(s.total) AS revenue
FROM sales s
WHERE s.voided = false AND s.status = 'closed'
GROUP BY 1;

-- Cuántas veces distintas ha ocurrido cada día del mes en el histórico (denominador del promedio)
DROP VIEW IF EXISTS v_dom_occurrences;
CREATE VIEW v_dom_occurrences AS
SELECT
  EXTRACT(DAY FROM fn_dia_habil(s.created_at))::int AS dom,
  COUNT(DISTINCT fn_dia_habil(s.created_at)) AS day_count
FROM sales s
WHERE s.voided = false AND s.status = 'closed'
GROUP BY 1;

-- Total y promedio de ventas por semana del mes (semana 1 = días 1-7, ..., semana 4 = días 22-31)
DROP VIEW IF EXISTS v_sales_by_week_of_month;
CREATE VIEW v_sales_by_week_of_month AS
SELECT
  LEAST(CEIL(EXTRACT(DAY FROM fn_dia_habil(s.created_at))::numeric / 7), 4)::int AS week_bucket,
  COUNT(*) AS sales_count,
  SUM(s.total) AS revenue
FROM sales s
WHERE s.voided = false AND s.status = 'closed'
GROUP BY 1;

-- Cuántos meses distintos del histórico llegaron a tener ventas en cada franja de semana
DROP VIEW IF EXISTS v_week_of_month_occurrences;
CREATE VIEW v_week_of_month_occurrences AS
SELECT week_bucket, COUNT(DISTINCT month_key) AS month_count
FROM (
  SELECT
    date_trunc('month', fn_dia_habil(s.created_at))::date AS month_key,
    LEAST(CEIL(EXTRACT(DAY FROM fn_dia_habil(s.created_at))::numeric / 7), 4)::int AS week_bucket
  FROM sales s
  WHERE s.voided = false AND s.status = 'closed'
) sub
GROUP BY week_bucket;
