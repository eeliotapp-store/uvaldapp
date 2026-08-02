import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { buildBucket, type ConcentrationBucket, type ConcentrationSaleItemRow } from '@/lib/reports/revenue-concentration';

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
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos

interface ConcentrationPayload {
  week: ConcentrationBucket;
  month: ConcentrationBucket;
}

let cache: { data: ConcentrationPayload; expiresAt: number } | null = null;

export async function GET() {
  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json(cache.data);
  }

  try {
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const since30 = new Date(now - 30 * DAY_MS).toISOString();
    const since7 = new Date(now - 7 * DAY_MS).toISOString();

    // 1. Ventas de los últimos 30 días
    type SaleRow = { id: string; created_at: string };
    const sales = await fetchAllRows<SaleRow>((from, to) =>
      supabaseAdmin
        .from('sales')
        .select('id, created_at')
        .gte('created_at', since30)
        .eq('voided', false)
        .eq('status', 'closed')
        .order('id', { ascending: true })
        .range(from, to)
    );

    const saleIdsWeek = new Set(sales.filter((s) => s.created_at >= since7).map((s) => s.id));

    // 2. Items vendidos en esas ventas
    const saleIds = sales.map((s) => s.id);
    const saleItems: ConcentrationSaleItemRow[] = [];
    for (let i = 0; i < saleIds.length; i += BATCH) {
      const idsBatch = saleIds.slice(i, i + BATCH);
      const batchItems = await fetchAllRows<ConcentrationSaleItemRow>((from, to) =>
        supabaseAdmin
          .from('sale_items')
          .select('sale_id, product_id, quantity, subtotal, combo_id, combo_price_override, is_michelada, is_bomba, products(name), combos(name)')
          .in('sale_id', idsBatch)
          .order('id', { ascending: true })
          .range(from, to) as unknown as PromiseLike<{ data: ConcentrationSaleItemRow[] | null; error: { message: string } | null }>
      );
      saleItems.push(...batchItems);
    }

    const monthItems = saleItems;
    const weekItems = saleItems.filter((item) => saleIdsWeek.has(item.sale_id));

    const payload: ConcentrationPayload = {
      week: buildBucket(weekItems),
      month: buildBucket(monthItems),
    };

    cache = { data: payload, expiresAt: Date.now() + CACHE_TTL_MS };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error en reporte de concentración de ingresos:', error);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
