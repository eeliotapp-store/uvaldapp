-- ============================================
-- MIGRACIÓN: MÉTODO DE PAGO "FIADO" - PARTE 1
-- ============================================

-- Agregar 'fiado' al enum de payment_method
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'fiado';

-- ============================================
-- COLUMNAS PARA FIADO EN SALES
-- ============================================

-- Nombre del cliente que fió
ALTER TABLE sales ADD COLUMN IF NOT EXISTS fiado_customer_name VARCHAR(100);

-- Monto que quedó pendiente (fiado)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS fiado_amount DECIMAL(10,2) DEFAULT 0;

-- Monto que abonó el cliente
ALTER TABLE sales ADD COLUMN IF NOT EXISTS fiado_abono DECIMAL(10,2) DEFAULT 0;

-- Si ya pagó el fiado
ALTER TABLE sales ADD COLUMN IF NOT EXISTS fiado_paid BOOLEAN DEFAULT FALSE;

-- Fecha en que pagó el fiado
ALTER TABLE sales ADD COLUMN IF NOT EXISTS fiado_paid_at TIMESTAMPTZ;

-- ============================================
-- COLUMNA PARA INDICAR MICHELADA EN SALE_ITEMS
-- ============================================

-- Asegurar que existe la columna is_michelada
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS is_michelada BOOLEAN DEFAULT FALSE;

-- ============================================
-- COLUMNA PARA COMBO EN SALE_ITEMS
-- ============================================

-- Asegurar que existe la columna combo_id
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS combo_id UUID REFERENCES combos(id);

-- Precio override del combo (para mostrar el precio real del combo)
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS combo_price_override DECIMAL(10,2);

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON COLUMN sales.fiado_customer_name IS 'Nombre del cliente que fió';
COMMENT ON COLUMN sales.fiado_amount IS 'Monto pendiente de pago (fiado)';
COMMENT ON COLUMN sales.fiado_abono IS 'Monto que abonó el cliente';
COMMENT ON COLUMN sales.fiado_paid IS 'Si el fiado ya fue pagado';
COMMENT ON COLUMN sales.fiado_paid_at IS 'Fecha en que se pagó el fiado';
