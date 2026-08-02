/**
 * Lógica pura del reporte "Productos clave" (concentración de ingresos / Pareto) en Estadísticas.
 * Sin dependencias externas (nada de Supabase/Next.js) — fácil de testear.
 */

export interface ConcentrationItem {
  product_name: string;
  revenue: number;
  pct_of_total: number;
  cumulative_pct: number;
}

export interface ConcentrationBucket {
  total_revenue: number;
  items: ConcentrationItem[];
  products_for_50pct: number;
  products_for_80pct: number;
}

export interface ConcentrationSaleItemRow {
  sale_id: string;
  product_id: string;
  quantity: number;
  subtotal: number;
  combo_id: string | null;
  combo_price_override: number | null;
  is_michelada: boolean;
  is_bomba: boolean;
  products: { name: string } | { name: string }[] | null;
  combos: { name: string } | { name: string }[] | null;
}

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v;
}

// Agrupa items por producto (o por combo, usando el precio del combo, no de sus componentes
// sueltos, para no inflar el ingreso) — mismo criterio ya usado en reports/shifts.
export function buildBucket(items: ConcentrationSaleItemRow[]): ConcentrationBucket {
  const summary = new Map<string, { name: string; revenue: number }>();

  for (const item of items) {
    const product = one(item.products);
    const combo = one(item.combos);

    if (item.combo_id) {
      const key = `combo-${item.combo_id}`;
      if (!summary.has(key)) summary.set(key, { name: combo?.name || 'Combo', revenue: 0 });
      if (item.combo_price_override) {
        summary.get(key)!.revenue += item.combo_price_override;
      }
      continue;
    }

    const suffix = item.is_michelada ? ' (Michelada)' : item.is_bomba ? ' (Bomba)' : '';
    const key = `${item.product_id}${item.is_michelada ? '-michelada' : item.is_bomba ? '-bomba' : ''}`;
    if (!summary.has(key)) summary.set(key, { name: (product?.name || 'Producto') + suffix, revenue: 0 });
    summary.get(key)!.revenue += item.subtotal;
  }

  const totalRevenue = [...summary.values()].reduce((sum, p) => sum + p.revenue, 0);
  const sorted = [...summary.values()].filter((p) => p.revenue > 0).sort((a, b) => b.revenue - a.revenue);

  let cumulative = 0;
  let productsFor50 = sorted.length;
  let productsFor80 = sorted.length;
  let reached50 = false;
  let reached80 = false;

  const items_out: ConcentrationItem[] = sorted.map((p, idx) => {
    cumulative += p.revenue;
    const cumulativePct = totalRevenue > 0 ? Math.round((cumulative / totalRevenue) * 1000) / 10 : 0;
    if (!reached50 && cumulativePct >= 50) {
      productsFor50 = idx + 1;
      reached50 = true;
    }
    if (!reached80 && cumulativePct >= 80) {
      productsFor80 = idx + 1;
      reached80 = true;
    }
    return {
      product_name: p.name,
      revenue: p.revenue,
      pct_of_total: totalRevenue > 0 ? Math.round((p.revenue / totalRevenue) * 1000) / 10 : 0,
      cumulative_pct: cumulativePct,
    };
  });

  return {
    total_revenue: totalRevenue,
    items: items_out,
    products_for_50pct: productsFor50,
    products_for_80pct: productsFor80,
  };
}
