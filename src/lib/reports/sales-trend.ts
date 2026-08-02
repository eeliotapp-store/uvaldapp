/**
 * Lógica pura del reporte "Tendencia" en Estadísticas.
 * Sin dependencias externas (nada de Supabase/Next.js) — fácil de testear.
 */

export const MIN_UNITS_THRESHOLD = 5; // evita ruido estadístico en productos de muy poco volumen
const DAY_MS = 24 * 60 * 60 * 1000;

export type TrendStatus = 'up' | 'down' | 'flat' | 'new' | 'stopped';

export interface Trend {
  current: number;
  previous: number;
  pct_change: number | null;
  status: TrendStatus;
}

export function computeTrend(current: number, previous: number): Trend {
  if (previous === 0 && current === 0) return { current, previous, pct_change: null, status: 'flat' };
  if (previous === 0) return { current, previous, pct_change: null, status: 'new' };
  if (current === 0) return { current, previous, pct_change: -100, status: 'stopped' };
  const pct = ((current - previous) / previous) * 100;
  const status: TrendStatus = pct > 5 ? 'up' : pct < -5 ? 'down' : 'flat';
  return { current, previous, pct_change: Math.round(pct * 10) / 10, status };
}

export interface TrendSaleRow {
  id: string;
  created_at: string;
  total: number;
}

export interface TrendSaleItemRow {
  sale_id: string;
  product_id: string;
  quantity: number;
  products: { name: string } | { name: string }[] | null;
}

export interface ProductTrendEntry {
  product_name: string;
  current_units: number;
  previous_units: number;
  pct_change: number | null;
  status: TrendStatus;
}

export interface SalesTrendPayload {
  overall: { week: Trend; month: Trend };
  products: { week: ProductTrendEntry[]; month: ProductTrendEntry[] };
  min_units_threshold: number;
}

type Window = 'currentWeek' | 'previousWeek' | 'currentMonth' | 'previousMonth' | null;

/**
 * @param now Marca de tiempo (ms) usada como "ahora" — se recibe como parámetro
 * (en vez de leer Date.now() internamente) para que la función sea determinística y testeable.
 */
export function buildSalesTrendPayload(
  sales: TrendSaleRow[],
  saleItems: TrendSaleItemRow[],
  now: number
): SalesTrendPayload {
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

  const buildProductTrend = (
    getCurrent: (p: { currentWeek: number; previousWeek: number; currentMonth: number; previousMonth: number }) => number,
    getPrevious: (p: { currentWeek: number; previousWeek: number; currentMonth: number; previousMonth: number }) => number
  ) =>
    [...productUnits.values()]
      .filter((p) => getCurrent(p) + getPrevious(p) >= MIN_UNITS_THRESHOLD)
      .map((p) => {
        const trend = computeTrend(getCurrent(p), getPrevious(p));
        return { product_name: p.name, current_units: trend.current, previous_units: trend.previous, pct_change: trend.pct_change, status: trend.status };
      })
      .sort((a, b) => (b.pct_change ?? 999) - (a.pct_change ?? 999));

  return {
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
}
