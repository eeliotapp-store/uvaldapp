import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

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
const MIN_UNITS_THRESHOLD = 5; // evita ruido estadístico en productos de muy poco volumen
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos

type Trend = { current: number; previous: number; pct_change: number | null; status: 'up' | 'down' | 'flat' | 'new' | 'stopped' };

function computeTrend(current: number, previous: number): Trend {
  if (previous === 0 && current === 0) return { current, previous, pct_change: null, status: 'flat' };
  if (previous === 0) return { current, previous, pct_change: null, status: 'new' };
  if (current === 0) return { current, previous, pct_change: -100, status: 'stopped' };
  const pct = ((current - previous) / previous) * 100;
  const status: Trend['status'] = pct > 5 ? 'up' : pct < -5 ? 'down' : 'flat';
  return { current, previous, pct_change: Math.round(pct * 10) / 10, status };
}

interface TrendPayload {
  overall: { week: Trend; month: Trend };
  products: {
    week: { product_name: string; current_units: number; previous_units: number; pct_change: number | null; status: Trend['status'] }[];
    month: { product_name: string; current_units: number; previous_units: number; pct_change: number | null; status: Trend['status'] }[];
  };
  min_units_threshold: number;
}

let cache: { data: TrendPayload; expiresAt: number } | null = null;

export async function GET() {
  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json(cache.data);
  }

  try {
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const since60 = new Date(now - 60 * DAY_MS).toISOString();

    // 1. Ventas de los últimos 60 días (cubre semana actual/anterior y mes actual/anterior)
    type SaleRow = { id: string; created_at: string; total: number };
    const sales = await fetchAllRows<SaleRow>((from, to) =>
      supabaseAdmin
        .from('sales')
        .select('id, created_at, total')
        .gte('created_at', since60)
        .eq('voided', false)
        .eq('status', 'closed')
        .order('id', { ascending: true })
        .range(from, to)
    );

    // 2. Clasificar cada venta en su ventana (semana actual/anterior, mes actual/anterior)
    type Window = 'currentWeek' | 'previousWeek' | 'currentMonth' | 'previousMonth' | null;
    const windowOf = (createdAt: string): Window => {
      const ageDays = (now - new Date(createdAt).getTime()) / DAY_MS;
      if (ageDays <= 7) return 'currentWeek';
      if (ageDays <= 14) return 'previousWeek';
      // (mes: independiente de semana, se solapan a propósito — son dos comparaciones distintas)
      return null;
    };
    const monthWindowOf = (createdAt: string): Window => {
      const ageDays = (now - new Date(createdAt).getTime()) / DAY_MS;
      if (ageDays <= 30) return 'currentMonth';
      if (ageDays <= 60) return 'previousMonth';
      return null;
    };

    const overallTotals = { currentWeek: 0, previousWeek: 0, currentMonth: 0, previousMonth: 0 };
    const saleWindow = new Map<string, { week: Window; month: Window }>();

    for (const sale of sales) {
      const week = windowOf(sale.created_at);
      const month = monthWindowOf(sale.created_at);
      saleWindow.set(sale.id, { week, month });
      if (week) overallTotals[week] += sale.total;
      if (month) overallTotals[month] += sale.total;
    }

    // 3. Items vendidos (excluye productos dentro de combos — mismo criterio que "Por día
    // de la semana": mide preferencia orgánica del cliente, no composición fija de combos)
    type SaleItemRow = { sale_id: string; product_id: string; quantity: number; products: { name: string } | { name: string }[] | null };
    const saleIds = sales.map((s) => s.id);
    const saleItems: SaleItemRow[] = [];
    for (let i = 0; i < saleIds.length; i += BATCH) {
      const idsBatch = saleIds.slice(i, i + BATCH);
      const batchItems = await fetchAllRows<SaleItemRow>((from, to) =>
        supabaseAdmin
          .from('sale_items')
          .select('sale_id, product_id, quantity, products(name)')
          .in('sale_id', idsBatch)
          .is('combo_id', null)
          .order('id', { ascending: true })
          .range(from, to) as unknown as PromiseLike<{ data: SaleItemRow[] | null; error: { message: string } | null }>
      );
      saleItems.push(...batchItems);
    }

    // 4. Agrupar unidades por producto y ventana
    const productUnits = new Map<string, { name: string; currentWeek: number; previousWeek: number; currentMonth: number; previousMonth: number }>();
    for (const item of saleItems) {
      const windows = saleWindow.get(item.sale_id);
      if (!windows) continue;
      const productInfo = Array.isArray(item.products) ? item.products[0] : item.products;
      const name = productInfo?.name || 'Producto sin nombre';

      if (!productUnits.has(item.product_id)) {
        productUnits.set(item.product_id, { name, currentWeek: 0, previousWeek: 0, currentMonth: 0, previousMonth: 0 });
      }
      const p = productUnits.get(item.product_id)!;
      if (windows.week) p[windows.week] += item.quantity;
      if (windows.month) p[windows.month] += item.quantity;
    }

    const buildProductTrend = (getCurrent: (p: { currentWeek: number; previousWeek: number; currentMonth: number; previousMonth: number }) => number, getPrevious: (p: { currentWeek: number; previousWeek: number; currentMonth: number; previousMonth: number }) => number) =>
      [...productUnits.values()]
        .filter((p) => getCurrent(p) + getPrevious(p) >= MIN_UNITS_THRESHOLD)
        .map((p) => {
          const trend = computeTrend(getCurrent(p), getPrevious(p));
          return { product_name: p.name, current_units: trend.current, previous_units: trend.previous, pct_change: trend.pct_change, status: trend.status };
        })
        .sort((a, b) => (b.pct_change ?? 999) - (a.pct_change ?? 999));

    const payload: TrendPayload = {
      overall: {
        week: computeTrend(overallTotals.currentWeek, overallTotals.previousWeek),
        month: computeTrend(overallTotals.currentMonth, overallTotals.previousMonth),
      },
      products: {
        week: buildProductTrend((p) => p.currentWeek, (p) => p.previousWeek),
        month: buildProductTrend((p) => p.currentMonth, (p) => p.previousMonth),
      },
      min_units_threshold: MIN_UNITS_THRESHOLD,
    };

    cache = { data: payload, expiresAt: Date.now() + CACHE_TTL_MS };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error en reporte de tendencia de ventas:', error);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
