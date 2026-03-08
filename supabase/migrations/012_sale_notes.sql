-- ============================================
-- MIGRACIÓN 012: Observaciones en ventas
-- Permite agregar notas/observaciones a las ventas
-- ============================================

-- Agregar campo de notas a la tabla sales
ALTER TABLE sales ADD COLUMN IF NOT EXISTS notes TEXT;

-- Agregar campo para notas de takeover (cuando alguien retoma una venta)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS takeover_notes TEXT;

-- Agregar campo para notas de cierre de venta
ALTER TABLE sales ADD COLUMN IF NOT EXISTS close_notes TEXT;

-- Comentarios de documentación
COMMENT ON COLUMN sales.notes IS 'Observaciones generales de la venta (gastos, incidentes, etc.)';
COMMENT ON COLUMN sales.takeover_notes IS 'Notas cuando otro empleado retoma la venta';
COMMENT ON COLUMN sales.close_notes IS 'Notas al cerrar la venta';
