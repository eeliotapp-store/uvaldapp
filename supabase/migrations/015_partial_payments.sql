-- Migration 015: Sistema de Pagos Parciales
-- Permite hacer pagos parciales en cuentas abiertas antes de cerrarlas completamente

-- Tabla de pagos parciales
CREATE TABLE partial_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'mixed')),
    cash_amount DECIMAL(10,2) DEFAULT 0,
    transfer_amount DECIMAL(10,2) DEFAULT 0,
    employee_id UUID NOT NULL REFERENCES employees(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items incluidos en cada pago parcial
CREATE TABLE partial_payment_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partial_payment_id UUID NOT NULL REFERENCES partial_payments(id) ON DELETE CASCADE,
    sale_item_id UUID NOT NULL REFERENCES sale_items(id),
    quantity INTEGER NOT NULL,
    amount DECIMAL(10,2) NOT NULL
);

-- Índices para rendimiento
CREATE INDEX idx_partial_payments_sale_id ON partial_payments(sale_id);
CREATE INDEX idx_partial_payment_items_payment_id ON partial_payment_items(partial_payment_id);

-- Actualizar vista v_open_tabs para incluir total pagado y restante
DROP VIEW IF EXISTS v_open_tabs;

CREATE VIEW v_open_tabs AS
SELECT
  s.id,
  s.table_number,
  s.created_at,
  s.total,
  s.employee_id,
  e.name as employee_name,
  s.shift_id,
  s.opened_by_employee_id,
  oe.name as opened_by_name,
  s.taken_over_by_employee_id,
  te.name as taken_over_by_name,
  s.taken_over_at,
  COALESCE(
    (SELECT SUM(pp.amount) FROM partial_payments pp WHERE pp.sale_id = s.id),
    0
  ) as total_paid,
  s.total - COALESCE(
    (SELECT SUM(pp.amount) FROM partial_payments pp WHERE pp.sale_id = s.id),
    0
  ) as remaining,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', si.id,
          'product_id', si.product_id,
          'product_name', p.name,
          'quantity', si.quantity,
          'unit_price', si.unit_price,
          'subtotal', si.subtotal,
          'is_michelada', COALESCE(si.is_michelada, false),
          'combo_id', si.combo_id,
          'combo_name', c.name
        )
      )
      FROM sale_items si
      JOIN products p ON p.id = si.product_id
      LEFT JOIN combos c ON c.id = si.combo_id
      WHERE si.sale_id = s.id
    ),
    '[]'::json
  ) as items
FROM sales s
JOIN employees e ON e.id = s.employee_id
LEFT JOIN employees oe ON oe.id = s.opened_by_employee_id
LEFT JOIN employees te ON te.id = s.taken_over_by_employee_id
WHERE s.status = 'open';
