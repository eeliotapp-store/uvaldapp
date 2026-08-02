import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { buildReorderForecast, LOOKBACK_DAYS, type StockRow } from '@/lib/reports/reorder-forecast';

// Supabase/PostgREST tiene un límite por defecto de filas por respuesta (1000) que trunca
// silenciosamente sin lanzar error — hay que paginar la SALIDA con .range().
async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

const BATCH = 200; // límite de longitud de URL de Supabase para .in()

export async function GET() {
  try {
    // 1. Stock actual
    const stock = await fetchAllRows<StockRow>((from, to) =>
      supabaseAdmin
        .from('v_current_stock')
        .select('product_id, product_name, category, current_stock, min_stock')
        .range(from, to)
    );

    // 2. Ventas de los últimos LOOKBACK_DAYS días
    const since = new Date();
    since.setDate(since.getDate() - LOOKBACK_DAYS);
    const sinceIso = since.toISOString();

    type SaleRow = { id: string };
    const sales = await fetchAllRows<SaleRow>((from, to) =>
      supabaseAdmin
        .from('sales')
        .select('id')
        .gte('created_at', sinceIso)
        .eq('voided', false)
        .eq('status', 'closed')
        .order('id', { ascending: true })
        .range(from, to)
    );

    // 3. Items vendidos (incluye productos dentro de combos: lo que importa aquí es
    // cuánto físicamente sale del estante, no si se vendió suelto o en combo)
    type SaleItemRow = { product_id: string; quantity: number };
    const saleIds = sales.map((s) => s.id);
    const unitsSoldByProduct = new Map<string, number>();
    for (let i = 0; i < saleIds.length; i += BATCH) {
      const idsBatch = saleIds.slice(i, i + BATCH);
      const batchItems = await fetchAllRows<SaleItemRow>((from, to) =>
        supabaseAdmin
          .from('sale_items')
          .select('product_id, quantity')
          .in('sale_id', idsBatch)
          .order('id', { ascending: true })
          .range(from, to)
      );
      for (const item of batchItems) {
        unitsSoldByProduct.set(item.product_id, (unitsSoldByProduct.get(item.product_id) || 0) + item.quantity);
      }
    }

    const payload = buildReorderForecast(stock, unitsSoldByProduct);

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error en pronóstico de reabastecimiento:', error);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
