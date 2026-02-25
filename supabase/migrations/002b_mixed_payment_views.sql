-- Migración Parte 2: Vistas para pago mixto
-- ⚠️ Ejecutar DESPUÉS de que 002_add_mixed_payment.sql haya terminado

-- 1. Migrar datos existentes: card → transfer (si tienes ventas con 'card')
-- Descomenta la siguiente línea si necesitas migrar datos:
-- UPDATE sales SET payment_method = 'transfer' WHERE payment_method = 'card';

-- 2. Actualizar la vista de ventas diarias
DROP VIEW IF EXISTS v_daily_sales;
CREATE VIEW v_daily_sales AS
SELECT
    s.id,
    s.created_at,
    e.name as employee_name,
    sh.type as shift_type,
    s.total,
    s.payment_method,
    s.cash_amount,
    s.transfer_amount,
    s.cash_change,
    s.voided
FROM sales s
JOIN employees e ON s.employee_id = e.id
JOIN shifts sh ON s.shift_id = sh.id
WHERE DATE(s.created_at) = CURRENT_DATE
ORDER BY s.created_at DESC;

-- 3. Actualizar la vista de resumen de turno
DROP VIEW IF EXISTS v_shift_summary;
CREATE VIEW v_shift_summary AS
SELECT
    sh.id as shift_id,
    sh.start_time,
    sh.end_time,
    sh.type,
    e.name as employee_name,
    sh.cash_start,
    sh.cash_end,
    COALESCE(SUM(CASE WHEN s.payment_method = 'cash' AND NOT s.voided THEN s.cash_amount ELSE 0 END), 0) as cash_sales,
    COALESCE(SUM(CASE WHEN s.payment_method = 'transfer' AND NOT s.voided THEN s.transfer_amount ELSE 0 END), 0) as transfer_sales,
    COALESCE(SUM(CASE WHEN s.payment_method = 'mixed' AND NOT s.voided THEN s.cash_amount ELSE 0 END), 0) as mixed_cash,
    COALESCE(SUM(CASE WHEN s.payment_method = 'mixed' AND NOT s.voided THEN s.transfer_amount ELSE 0 END), 0) as mixed_transfer,
    COALESCE(SUM(CASE WHEN NOT s.voided THEN s.total ELSE 0 END), 0) as total_sales,
    COALESCE(SUM(CASE WHEN NOT s.voided THEN s.cash_change ELSE 0 END), 0) as total_change,
    COUNT(CASE WHEN NOT s.voided THEN 1 END) as transactions_count,
    sh.is_active
FROM shifts sh
JOIN employees e ON sh.employee_id = e.id
LEFT JOIN sales s ON sh.id = s.shift_id
GROUP BY sh.id, sh.start_time, sh.end_time, sh.type, e.name, sh.cash_start, sh.cash_end, sh.is_active;
