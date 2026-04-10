import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET: Obtener resumen de un turno (bypasa RLS)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shiftId = searchParams.get('shift_id');

  if (!shiftId) {
    return NextResponse.json({ error: 'shift_id requerido' }, { status: 400 });
  }

  const { data: summary, error } = await supabaseAdmin
    .from('v_shift_summary')
    .select('*')
    .eq('shift_id', shiftId)
    .single();

  if (error || !summary) {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
  }

  // Productos vendidos en el turno
  const { data: sales } = await supabaseAdmin
    .from('sales')
    .select('id')
    .eq('shift_id', shiftId)
    .eq('voided', false)
    .eq('status', 'closed');

  const saleIds = (sales || []).map((s) => s.id);
  let products: { product_name: string; quantity: number; total: number }[] = [];

  if (saleIds.length > 0) {
    const { data: items } = await supabaseAdmin
      .from('sale_items')
      .select('quantity, unit_price, products(name)')
      .in('sale_id', saleIds);

    const productMap = new Map<string, { product_name: string; quantity: number; total: number }>();
    for (const item of items || []) {
      const name = (item.products as unknown as { name: string } | null)?.name || 'Sin nombre';
      const existing = productMap.get(name) || { product_name: name, quantity: 0, total: 0 };
      existing.quantity += item.quantity;
      existing.total += item.quantity * (item.unit_price || 0);
      productMap.set(name, existing);
    }
    products = [...productMap.values()].sort((a, b) => b.total - a.total);
  }

  return NextResponse.json({ summary, products });
}
