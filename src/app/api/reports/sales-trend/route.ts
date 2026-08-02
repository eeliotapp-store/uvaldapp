import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { buildSalesTrendPayload, type SalesTrendPayload, type TrendSaleRow, type TrendSaleItemRow } from '@/lib/reports/sales-trend';

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

let cache: { data: SalesTrendPayload; expiresAt: number } | null = null;

export async function GET() {
  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json(cache.data);
  }

  try {
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const since60 = new Date(now - 60 * DAY_MS).toISOString();

    // 1. Ventas de los últimos 60 días (cubre semana actual/anterior y mes actual/anterior)
    const sales = await fetchAllRows<TrendSaleRow>((from, to) =>
      supabaseAdmin
        .from('sales')
        .select('id, created_at, total')
        .gte('created_at', since60)
        .eq('voided', false)
        .eq('status', 'closed')
        .order('id', { ascending: true })
        .range(from, to)
    );

    // 2. Items vendidos (excluye productos dentro de combos — mismo criterio que "Por día
    // de la semana": mide preferencia orgánica del cliente, no composición fija de combos)
    const saleIds = sales.map((s) => s.id);
    const saleItems: TrendSaleItemRow[] = [];
    for (let i = 0; i < saleIds.length; i += BATCH) {
      const idsBatch = saleIds.slice(i, i + BATCH);
      const batchItems = await fetchAllRows<TrendSaleItemRow>((from, to) =>
        supabaseAdmin
          .from('sale_items')
          .select('sale_id, product_id, quantity, products(name)')
          .in('sale_id', idsBatch)
          .is('combo_id', null)
          .order('id', { ascending: true })
          .range(from, to) as unknown as PromiseLike<{ data: TrendSaleItemRow[] | null; error: { message: string } | null }>
      );
      saleItems.push(...batchItems);
    }

    const payload = buildSalesTrendPayload(sales, saleItems, now);

    cache = { data: payload, expiresAt: Date.now() + CACHE_TTL_MS };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error en reporte de tendencia de ventas:', error);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
