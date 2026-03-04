-- ============================================
-- MIGRACIÓN: Sistema de Combos/Promociones
-- ============================================

-- Tabla de combos/promociones
CREATE TABLE combos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    base_price DECIMAL(10,2) NOT NULL,
    is_price_editable BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items que componen cada combo
CREATE TABLE combo_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    combo_id UUID NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 1,
    is_swappable BOOLEAN DEFAULT false,
    is_michelada BOOLEAN DEFAULT false,

    CONSTRAINT positive_combo_qty CHECK (quantity > 0)
);

CREATE INDEX idx_combo_items_combo ON combo_items(combo_id);

-- Agregar columnas a sale_items para tracking de combos y micheladas
ALTER TABLE sale_items ADD COLUMN combo_id UUID REFERENCES combos(id);
ALTER TABLE sale_items ADD COLUMN is_michelada BOOLEAN DEFAULT false;
ALTER TABLE sale_items ADD COLUMN combo_price_override DECIMAL(10,2);

-- Constante para precio de michelada (se puede manejar desde código también)
-- MICHELADA_PRICE = 4000

-- ============================================
-- DATOS INICIALES: Combos de cerveza
-- ============================================

-- Nota: Los product_id se insertarán desde el código/admin
-- ya que dependen de los productos existentes

-- Comentado porque los productos pueden no existir aún:
-- INSERT INTO combos (name, base_price, is_price_editable) VALUES
-- ('2 Coronitas Micheladas', 12000, false),
-- ('2 Stella Micheladas', 20000, false),
-- ('4 Coronitas', 19000, false),
-- ('4 Stellas', 30000, false);

-- INSERT INTO combos (name, base_price, is_price_editable, description) VALUES
-- ('Botella Aguardiente + 3 Cervezas', 95000, true, 'Aguardiente azul o verde'),
-- ('Media Aguardiente + 3 Cervezas', 65000, true, 'Aguardiente azul o verde');
