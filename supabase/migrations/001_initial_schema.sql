-- ============================================
-- SCHEMA: SISTEMA INVENTARIO CERVECERIA
-- ============================================

-- Habilitar extension para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TIPOS ENUMERADOS
-- ============================================

CREATE TYPE employee_role AS ENUM ('employee', 'owner');
CREATE TYPE shift_type AS ENUM ('day', 'night');
CREATE TYPE payment_method AS ENUM ('cash', 'card');
CREATE TYPE product_category AS ENUM ('beer_nacional', 'beer_importada', 'beer_artesanal', 'other');

-- ============================================
-- TABLA: EMPLOYEES
-- ============================================

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    role employee_role NOT NULL DEFAULT 'employee',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_employees_active ON employees(active) WHERE active = true;

-- ============================================
-- TABLA: SHIFTS
-- ============================================

CREATE TABLE shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    type shift_type NOT NULL,
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    cash_start DECIMAL(10,2) NOT NULL DEFAULT 0,
    cash_end DECIMAL(10,2),
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shifts_employee ON shifts(employee_id);
CREATE INDEX idx_shifts_active ON shifts(is_active) WHERE is_active = true;

-- ============================================
-- TABLA: SUPPLIERS
-- ============================================

CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    contact_person VARCHAR(100),
    email VARCHAR(100),
    address TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TABLA: PRODUCTS
-- ============================================

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    category product_category NOT NULL DEFAULT 'beer_nacional',
    sale_price DECIMAL(10,2) NOT NULL,
    min_stock INTEGER NOT NULL DEFAULT 10,
    image_url TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT positive_sale_price CHECK (sale_price > 0)
);

CREATE INDEX idx_products_active ON products(active) WHERE active = true;
CREATE INDEX idx_products_category ON products(category);

-- ============================================
-- TABLA: PRODUCT_SUPPLIERS
-- ============================================

CREATE TABLE product_suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    purchase_price DECIMAL(10,2) NOT NULL,
    is_preferred BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_product_supplier UNIQUE (product_id, supplier_id),
    CONSTRAINT positive_purchase_price CHECK (purchase_price > 0)
);

-- ============================================
-- TABLA: INVENTORY
-- ============================================

CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    initial_quantity INTEGER NOT NULL,
    purchase_price DECIMAL(10,2) NOT NULL,
    batch_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES employees(id),

    CONSTRAINT positive_quantity CHECK (quantity >= 0)
);

CREATE INDEX idx_inventory_product ON inventory(product_id);
CREATE INDEX idx_inventory_quantity ON inventory(quantity) WHERE quantity > 0;

-- ============================================
-- TABLA: SALES
-- ============================================

CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
    subtotal DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    payment_method payment_method NOT NULL,
    cash_received DECIMAL(10,2),
    cash_change DECIMAL(10,2),
    voided BOOLEAN NOT NULL DEFAULT false,
    voided_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT positive_total CHECK (total >= 0)
);

CREATE INDEX idx_sales_employee ON sales(employee_id);
CREATE INDEX idx_sales_shift ON sales(shift_id);
CREATE INDEX idx_sales_date ON sales(created_at);

-- ============================================
-- TABLA: SALE_ITEMS
-- ============================================

CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,

    CONSTRAINT positive_quantity CHECK (quantity > 0)
);

CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);

-- ============================================
-- VISTA: STOCK ACTUAL
-- ============================================

CREATE VIEW v_current_stock AS
SELECT
    p.id as product_id,
    p.name as product_name,
    p.category,
    p.sale_price,
    p.min_stock,
    COALESCE(SUM(i.quantity), 0) as current_stock,
    COALESCE(SUM(i.quantity), 0) <= p.min_stock as is_low_stock,
    p.active
FROM products p
LEFT JOIN inventory i ON p.id = i.product_id AND i.quantity > 0
WHERE p.active = true
GROUP BY p.id;

-- ============================================
-- VISTA: VENTAS DEL DIA
-- ============================================

CREATE VIEW v_daily_sales AS
SELECT
    s.id,
    s.created_at,
    e.name as employee_name,
    sh.type as shift_type,
    s.total,
    s.payment_method,
    s.voided
FROM sales s
JOIN employees e ON s.employee_id = e.id
JOIN shifts sh ON s.shift_id = sh.id
WHERE s.created_at::date = CURRENT_DATE;

-- ============================================
-- VISTA: RESUMEN POR TURNO
-- ============================================

CREATE VIEW v_shift_summary AS
SELECT
    sh.id as shift_id,
    sh.start_time,
    sh.end_time,
    sh.type,
    e.name as employee_name,
    sh.cash_start,
    sh.cash_end,
    COALESCE(SUM(CASE WHEN s.payment_method = 'cash' AND NOT s.voided THEN s.total ELSE 0 END), 0) as cash_sales,
    COALESCE(SUM(CASE WHEN s.payment_method = 'card' AND NOT s.voided THEN s.total ELSE 0 END), 0) as card_sales,
    COALESCE(SUM(CASE WHEN NOT s.voided THEN s.total ELSE 0 END), 0) as total_sales,
    COUNT(CASE WHEN NOT s.voided THEN 1 END) as transactions_count,
    sh.is_active
FROM shifts sh
JOIN employees e ON sh.employee_id = e.id
LEFT JOIN sales s ON sh.id = s.shift_id
GROUP BY sh.id, e.name;

-- ============================================
-- TRIGGER: UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- TRIGGER: DESCONTAR INVENTARIO AL VENDER
-- ============================================

CREATE OR REPLACE FUNCTION deduct_inventory_on_sale()
RETURNS TRIGGER AS $$
DECLARE
    remaining INTEGER;
    inv_record RECORD;
BEGIN
    remaining := NEW.quantity;

    FOR inv_record IN
        SELECT id, quantity
        FROM inventory
        WHERE product_id = NEW.product_id AND quantity > 0
        ORDER BY batch_date ASC, created_at ASC
    LOOP
        IF remaining <= 0 THEN EXIT; END IF;

        IF inv_record.quantity >= remaining THEN
            UPDATE inventory SET quantity = quantity - remaining WHERE id = inv_record.id;
            remaining := 0;
        ELSE
            UPDATE inventory SET quantity = 0 WHERE id = inv_record.id;
            remaining := remaining - inv_record.quantity;
        END IF;
    END LOOP;

    IF remaining > 0 THEN
        RAISE EXCEPTION 'Stock insuficiente para producto %', NEW.product_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_deduct_inventory
    BEFORE INSERT ON sale_items
    FOR EACH ROW EXECUTE FUNCTION deduct_inventory_on_sale();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- Politicas basicas (todos pueden leer, escritura segun contexto)
CREATE POLICY "allow_all_read" ON employees FOR SELECT USING (true);
CREATE POLICY "allow_all_read" ON shifts FOR SELECT USING (true);
CREATE POLICY "allow_all_read" ON suppliers FOR SELECT USING (true);
CREATE POLICY "allow_all_read" ON products FOR SELECT USING (true);
CREATE POLICY "allow_all_read" ON product_suppliers FOR SELECT USING (true);
CREATE POLICY "allow_all_read" ON inventory FOR SELECT USING (true);
CREATE POLICY "allow_all_read" ON sales FOR SELECT USING (true);
CREATE POLICY "allow_all_read" ON sale_items FOR SELECT USING (true);

-- Permitir inserciones desde la app (via service role o authenticated)
CREATE POLICY "allow_insert" ON shifts FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_update" ON shifts FOR UPDATE USING (true);
CREATE POLICY "allow_insert" ON inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_insert" ON sales FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_insert" ON sale_items FOR INSERT WITH CHECK (true);

-- ============================================
-- DATOS INICIALES (SEED)
-- ============================================

-- Empleado admin (PIN: 1234)
-- Hash generado con bcrypt, rounds=10
INSERT INTO employees (name, pin_hash, role) VALUES
    ('Admin', '$2b$10$QaBKTSAJKG2NBL2PFNFDaeKAbxqBXqVo87UVbeBSKGCCvr5QukvYS', 'owner'),
    ('Maria', '$2b$10$QaBKTSAJKG2NBL2PFNFDaeKAbxqBXqVo87UVbeBSKGCCvr5QukvYS', 'employee'),
    ('Juan', '$2b$10$QaBKTSAJKG2NBL2PFNFDaeKAbxqBXqVo87UVbeBSKGCCvr5QukvYS', 'employee');

-- Proveedores de ejemplo
INSERT INTO suppliers (name, phone, contact_person) VALUES
    ('Distribuidora Lopez', '3001234567', 'Carlos Lopez'),
    ('Bebidas SA', '3009876543', 'Ana Martinez'),
    ('Importadora Premium', '3005551234', 'Pedro Gomez');

-- Productos de ejemplo
INSERT INTO products (name, category, sale_price, min_stock) VALUES
    ('Corona Extra', 'beer_nacional', 4500, 12),
    ('Modelo Especial', 'beer_nacional', 5000, 12),
    ('Heineken', 'beer_importada', 6500, 10),
    ('Stella Artois', 'beer_importada', 7000, 10),
    ('Club Colombia', 'beer_nacional', 4000, 15),
    ('Poker', 'beer_nacional', 3500, 20),
    ('Aguila', 'beer_nacional', 3500, 20),
    ('Budweiser', 'beer_importada', 5500, 10),
    ('Corona Cero', 'beer_nacional', 4500, 8),
    ('3 Cordilleras', 'beer_artesanal', 8500, 6);

-- Relacion producto-proveedor
INSERT INTO product_suppliers (product_id, supplier_id, purchase_price, is_preferred)
SELECT p.id, s.id, p.sale_price * 0.6, true
FROM products p
CROSS JOIN (SELECT id FROM suppliers LIMIT 1) s;

-- Inventario inicial
INSERT INTO inventory (product_id, supplier_id, quantity, initial_quantity, purchase_price)
SELECT
    p.id,
    (SELECT id FROM suppliers LIMIT 1),
    20,
    20,
    p.sale_price * 0.6
FROM products p;
