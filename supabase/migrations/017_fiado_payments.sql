-- Migration 017: Tabla de pagos/abonos de fiados
-- Permite registrar pagos parciales o totales de fiados con método de pago

CREATE TABLE IF NOT EXISTS fiado_payments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id         UUID        NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  amount          DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_method  VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'mixed')),
  cash_amount     DECIMAL(10,2) NOT NULL DEFAULT 0,
  transfer_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  employee_id     UUID        REFERENCES employees(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fiado_payments_sale_id   ON fiado_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_fiado_payments_created_at ON fiado_payments(created_at);
