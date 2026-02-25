-- Migración: Agregar soporte para pago mixto y transferencias
-- ⚠️ IMPORTANTE: Ejecutar en DOS PASOS separados en Supabase SQL Editor

-- ============================================
-- PASO 1: Ejecuta SOLO esto primero y espera a que termine
-- ============================================

ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'transfer';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'mixed';

ALTER TABLE sales
ADD COLUMN IF NOT EXISTS transfer_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cash_amount NUMERIC(10,2) DEFAULT 0;
