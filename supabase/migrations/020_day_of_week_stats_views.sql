-- Vistas para el reporte "Por día de la semana" en Estadísticas.
-- Mueve la agregación (antes hecha en JS trayendo ~14k filas paginadas) a Postgres,
-- que resuelve el mismo GROUP BY en milisegundos.

-- Día hábil: una venta antes de las 6am hora Colombia pertenece al día anterior
-- (el turno noche que cruza la medianoche sigue perteneciendo al día en que inició).
-- Colombia no observa horario de verano, por eso 'America/Bogota' es un offset fijo (-05:00).
CREATE OR REPLACE FUNCTION fn_dia_habil(ts TIMESTAMPTZ)
RETURNS DATE
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE
    WHEN EXTRACT(HOUR FROM (ts AT TIME ZONE 'America/Bogota')) < 6
    THEN ((ts AT TIME ZONE 'America/Bogota')::date - INTERVAL '1 day')::date
    ELSE (ts AT TIME ZONE 'America/Bogota')::date
  END;
$$;

-- Tabla 1: total de ventas por día de la semana, histórico completo
DROP VIEW IF EXISTS v_sales_by_dow;
CREATE VIEW v_sales_by_dow AS
SELECT
  EXTRACT(DOW FROM fn_dia_habil(s.created_at))::int AS dow,
  COUNT(*) AS sales_count
FROM sales s
WHERE s.voided = false AND s.status = 'closed'
GROUP BY 1;

-- Tabla 2: por producto y día de la semana, qué % de sus ventas históricas cae ese día.
-- Excluye productos dentro de combos (esos "siempre se compran juntos" por diseño del combo,
-- no por comportamiento real del cliente) y filtra productos con menos de 15 unidades
-- históricas (evita que un producto con 2 ventas casuales marque 100% por ruido estadístico).
DROP VIEW IF EXISTS v_product_sales_by_dow;
CREATE VIEW v_product_sales_by_dow AS
WITH items_validos AS (
  SELECT
    si.product_id,
    si.quantity,
    si.subtotal,
    EXTRACT(DOW FROM fn_dia_habil(s.created_at))::int AS dow
  FROM sale_items si
  JOIN sales s ON s.id = si.sale_id
  WHERE si.combo_id IS NULL
    AND s.voided = false
    AND s.status = 'closed'
),
producto_total AS (
  SELECT product_id, SUM(quantity) AS total_units
  FROM items_validos
  GROUP BY product_id
  HAVING SUM(quantity) >= 15
)
SELECT
  p.name AS product_name,
  iv.dow,
  SUM(iv.quantity) AS day_units,
  SUM(iv.subtotal) AS day_revenue,
  pt.total_units,
  ROUND(100.0 * SUM(iv.quantity) / pt.total_units, 1) AS pct_of_total
FROM items_validos iv
JOIN producto_total pt ON pt.product_id = iv.product_id
JOIN products p ON p.id = iv.product_id
GROUP BY p.name, iv.dow, pt.total_units
ORDER BY iv.dow, pct_of_total DESC;
