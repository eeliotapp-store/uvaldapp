-- Tabla para registrar conteos de inventario
-- Permite verificar el stock real vs el sistema y registrar quién lo hizo
CREATE TABLE IF NOT EXISTS inventory_counts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id),
    shift_id UUID REFERENCES shifts(id),
    employee_id UUID NOT NULL REFERENCES employees(id),
    system_stock INTEGER NOT NULL,  -- Stock que mostraba el sistema
    real_stock INTEGER NOT NULL,    -- Stock real contado por la empleada
    difference INTEGER GENERATED ALWAYS AS (real_stock - system_stock) STORED,
    notes TEXT,                     -- Notas opcionales (ej: "Encontré 2 rotas")
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_inventory_counts_product ON inventory_counts(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_counts_employee ON inventory_counts(employee_id);
CREATE INDEX IF NOT EXISTS idx_inventory_counts_shift ON inventory_counts(shift_id);
CREATE INDEX IF NOT EXISTS idx_inventory_counts_created ON inventory_counts(created_at DESC);

-- Vista para obtener el último conteo de cada producto
CREATE OR REPLACE VIEW v_latest_inventory_counts AS
SELECT DISTINCT ON (product_id)
    ic.id,
    ic.product_id,
    ic.shift_id,
    ic.employee_id,
    ic.system_stock,
    ic.real_stock,
    ic.difference,
    ic.notes,
    ic.created_at,
    e.name as employee_name
FROM inventory_counts ic
JOIN employees e ON e.id = ic.employee_id
ORDER BY ic.product_id, ic.created_at DESC;

-- Comentarios
COMMENT ON TABLE inventory_counts IS 'Registro de conteos de inventario realizados por empleadas';
COMMENT ON COLUMN inventory_counts.system_stock IS 'Stock que mostraba el sistema al momento del conteo';
COMMENT ON COLUMN inventory_counts.real_stock IS 'Stock real contado físicamente';
COMMENT ON COLUMN inventory_counts.difference IS 'Diferencia entre real y sistema (positivo = sobrante, negativo = faltante)';
