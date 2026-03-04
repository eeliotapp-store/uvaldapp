-- ============================================
-- MIGRACIÓN: SISTEMA DE AUDITORÍA
-- ============================================

-- Tipo para acciones de auditoría
CREATE TYPE audit_action AS ENUM (
    'CREATE',      -- Crear venta/item
    'UPDATE',      -- Editar venta/item
    'DELETE',      -- Eliminar item
    'VOID',        -- Anular venta
    'CLOSE',       -- Cerrar cuenta
    'TAKEOVER',    -- Tomar relevo de cuenta
    'ADD_ITEMS',   -- Agregar items a cuenta abierta
    'PRICE_CHANGE' -- Cambio de precio en item
);

-- Tipo para entidades auditables
CREATE TYPE audit_entity AS ENUM (
    'SALE',
    'SALE_ITEM',
    'INVENTORY',
    'PRODUCT',
    'COMBO'
);

-- ============================================
-- TABLA: AUDIT_LOGS
-- ============================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Qué acción se hizo
    action audit_action NOT NULL,

    -- Sobre qué entidad
    entity_type audit_entity NOT NULL,
    entity_id UUID NOT NULL,

    -- Quién lo hizo
    employee_id UUID NOT NULL REFERENCES employees(id),

    -- Valores antes y después (para tracking completo)
    old_values JSONB,  -- NULL para CREATE
    new_values JSONB,  -- NULL para DELETE/VOID

    -- Contexto adicional
    metadata JSONB DEFAULT '{}',

    -- Descripción legible
    description TEXT,

    -- Cuándo
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para búsqueda eficiente
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_employee ON audit_logs(employee_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_date ON audit_logs(created_at DESC);

-- Índice compuesto para filtros comunes
CREATE INDEX idx_audit_logs_sale_history ON audit_logs(entity_id, created_at DESC)
    WHERE entity_type = 'SALE';

-- ============================================
-- RLS para audit_logs
-- ============================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Solo lectura para todos (los logs son inmutables)
CREATE POLICY "allow_read_audit" ON audit_logs FOR SELECT USING (true);
CREATE POLICY "allow_insert_audit" ON audit_logs FOR INSERT WITH CHECK (true);

-- ============================================
-- VISTA: Historial de ventas con detalles
-- ============================================

CREATE OR REPLACE VIEW v_sale_audit_history AS
SELECT
    al.id,
    al.action,
    al.entity_type,
    al.entity_id,
    al.old_values,
    al.new_values,
    al.description,
    al.metadata,
    al.created_at,
    e.id as employee_id,
    e.name as employee_name,
    -- Info de la venta si aplica
    CASE
        WHEN al.entity_type = 'SALE' THEN al.entity_id
        WHEN al.entity_type = 'SALE_ITEM' THEN (al.metadata->>'sale_id')::uuid
        ELSE NULL
    END as sale_id
FROM audit_logs al
JOIN employees e ON al.employee_id = e.id
ORDER BY al.created_at DESC;

-- ============================================
-- FUNCIÓN: Registrar auditoría
-- ============================================

CREATE OR REPLACE FUNCTION log_audit(
    p_action audit_action,
    p_entity_type audit_entity,
    p_entity_id UUID,
    p_employee_id UUID,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}',
    p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO audit_logs (
        action,
        entity_type,
        entity_id,
        employee_id,
        old_values,
        new_values,
        metadata,
        description
    ) VALUES (
        p_action,
        p_entity_type,
        p_entity_id,
        p_employee_id,
        p_old_values,
        p_new_values,
        p_metadata,
        p_description
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- POLÍTICAS PARA PERMITIR UPDATE EN SALES
-- ============================================

-- Permitir update en sales (para edición)
CREATE POLICY "allow_update_sales" ON sales FOR UPDATE USING (true);

-- Permitir update en sale_items (para edición)
CREATE POLICY "allow_update_sale_items" ON sale_items FOR UPDATE USING (true);

-- Permitir delete en sale_items (para eliminar items de una venta)
CREATE POLICY "allow_delete_sale_items" ON sale_items FOR DELETE USING (true);

-- ============================================
-- TRIGGER: Restaurar inventario al eliminar item
-- ============================================

CREATE OR REPLACE FUNCTION restore_inventory_on_delete()
RETURNS TRIGGER AS $$
DECLARE
    inv_record RECORD;
    remaining INTEGER;
BEGIN
    remaining := OLD.quantity;

    -- Buscar el lote más reciente del producto para devolver
    FOR inv_record IN
        SELECT id, quantity
        FROM inventory
        WHERE product_id = OLD.product_id
        ORDER BY batch_date DESC, created_at DESC
        LIMIT 1
    LOOP
        UPDATE inventory
        SET quantity = quantity + remaining
        WHERE id = inv_record.id;
        remaining := 0;
    END LOOP;

    -- Si no hay lote, crear uno nuevo
    IF remaining > 0 THEN
        INSERT INTO inventory (
            product_id,
            supplier_id,
            quantity,
            initial_quantity,
            purchase_price
        )
        SELECT
            OLD.product_id,
            (SELECT supplier_id FROM product_suppliers WHERE product_id = OLD.product_id AND is_preferred = true LIMIT 1),
            remaining,
            0,  -- No es un ingreso real, es devolución
            0
        ;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_restore_inventory_on_delete
    BEFORE DELETE ON sale_items
    FOR EACH ROW EXECUTE FUNCTION restore_inventory_on_delete();

-- ============================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ============================================

COMMENT ON TABLE audit_logs IS 'Registro de todas las acciones del sistema para auditoría';
COMMENT ON COLUMN audit_logs.action IS 'Tipo de acción realizada';
COMMENT ON COLUMN audit_logs.entity_type IS 'Tipo de entidad afectada';
COMMENT ON COLUMN audit_logs.entity_id IS 'ID de la entidad afectada';
COMMENT ON COLUMN audit_logs.old_values IS 'Valores antes del cambio (JSON)';
COMMENT ON COLUMN audit_logs.new_values IS 'Valores después del cambio (JSON)';
COMMENT ON COLUMN audit_logs.metadata IS 'Información adicional del contexto';
