-- ============================================
-- MIGRACIÓN 018: Seguridad RLS y vistas
-- ============================================
-- Objetivo: Denegar acceso directo a Supabase con anon key.
-- Todo acceso pasa por API routes (service role bypasea RLS).
-- ============================================

-- ============================================
-- PARTE 1: Habilitar RLS en tablas sin protección
-- Sin políticas = deny-all para anon por defecto
-- ============================================

ALTER TABLE public.combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partial_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partial_payment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiado_payments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PARTE 2: Eliminar políticas permisivas del schema original
-- Estas políticas permitían SELECT/INSERT a cualquier usuario (anon incluido)
-- ============================================

DROP POLICY IF EXISTS "allow_all_read" ON public.employees;
DROP POLICY IF EXISTS "allow_all_read" ON public.shifts;
DROP POLICY IF EXISTS "allow_all_read" ON public.suppliers;
DROP POLICY IF EXISTS "allow_all_read" ON public.products;
DROP POLICY IF EXISTS "allow_all_read" ON public.product_suppliers;
DROP POLICY IF EXISTS "allow_all_read" ON public.inventory;
DROP POLICY IF EXISTS "allow_all_read" ON public.sales;
DROP POLICY IF EXISTS "allow_all_read" ON public.sale_items;

DROP POLICY IF EXISTS "allow_insert" ON public.shifts;
DROP POLICY IF EXISTS "allow_update" ON public.shifts;
DROP POLICY IF EXISTS "allow_insert" ON public.inventory;
DROP POLICY IF EXISTS "allow_insert" ON public.sales;
DROP POLICY IF EXISTS "allow_insert" ON public.sale_items;

-- ============================================
-- PARTE 3: Corregir vistas a SECURITY INVOKER
-- Las vistas creadas por postgres (superuser) bypassean RLS.
-- Con security_invoker = on usan los permisos del caller.
-- ============================================

ALTER VIEW public.v_open_tabs SET (security_invoker = on);
ALTER VIEW public.v_daily_sales SET (security_invoker = on);
ALTER VIEW public.v_sale_audit_history SET (security_invoker = on);
ALTER VIEW public.v_latest_inventory_counts SET (security_invoker = on);
ALTER VIEW public.v_weekly_stats SET (security_invoker = on);
ALTER VIEW public.v_shift_summary SET (security_invoker = on);
ALTER VIEW public.v_current_stock SET (security_invoker = on);
ALTER VIEW public.v_daily_stats SET (security_invoker = on);
ALTER VIEW public.v_fiados_pendientes SET (security_invoker = on);
