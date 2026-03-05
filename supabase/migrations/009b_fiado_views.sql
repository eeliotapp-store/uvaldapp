-- ============================================
-- MIGRACIÓN: FIADO - ÍNDICES Y VISTAS
-- (Ejecutar después de 009_fiado_payment.sql)
-- ============================================

-- ============================================
-- ÍNDICE PARA FIADOS PENDIENTES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_sales_fiado_pending ON sales(fiado_paid, fiado_amount)
    WHERE payment_method = 'fiado' AND fiado_paid = FALSE AND fiado_amount > 0;

-- ============================================
-- VISTA: FIADOS PENDIENTES
-- ============================================

CREATE OR REPLACE VIEW v_fiados_pendientes AS
SELECT
    s.id,
    s.fiado_customer_name,
    s.fiado_amount,
    s.fiado_abono,
    s.total,
    s.created_at,
    e.name as employee_name,
    s.table_number
FROM sales s
JOIN employees e ON s.employee_id = e.id
WHERE s.payment_method = 'fiado'
  AND s.fiado_paid = FALSE
  AND s.fiado_amount > 0
ORDER BY s.created_at DESC;
