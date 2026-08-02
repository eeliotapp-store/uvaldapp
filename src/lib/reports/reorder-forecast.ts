/**
 * Lógica pura del reporte "Reabastecimiento" en Estadísticas.
 * Sin dependencias externas (nada de Supabase/Next.js) — fácil de testear.
 */

export const LOOKBACK_DAYS = 30; // ventana para calcular velocidad de venta reciente
export const TARGET_COVERAGE_DAYS = 14; // colchón objetivo al sugerir cuánto comprar

export interface StockRow {
  product_id: string;
  product_name: string;
  category: string;
  current_stock: number;
  min_stock: number;
}

export interface ReorderProduct {
  product_id: string;
  product_name: string;
  category: string;
  current_stock: number;
  min_stock: number;
  units_last_30_days: number;
  daily_velocity: number;
  days_remaining: number;
  suggested_reorder: number;
}

export interface ReorderNoMovementProduct {
  product_id: string;
  product_name: string;
  category: string;
  current_stock: number;
}

export interface ReorderForecastPayload {
  lookback_days: number;
  target_coverage_days: number;
  products: ReorderProduct[];
  products_without_recent_sales: ReorderNoMovementProduct[];
}

export function buildReorderForecast(
  stock: StockRow[],
  unitsSoldByProduct: Map<string, number>
): ReorderForecastPayload {
  const withMovement: ReorderProduct[] = [];
  const noMovement: ReorderNoMovementProduct[] = [];

  for (const s of stock) {
    const units30d = unitsSoldByProduct.get(s.product_id) || 0;
    if (units30d === 0) {
      if (s.current_stock > 0) {
        noMovement.push({
          product_id: s.product_id,
          product_name: s.product_name,
          category: s.category,
          current_stock: s.current_stock,
        });
      }
      continue;
    }

    const dailyVelocity = units30d / LOOKBACK_DAYS;
    const daysRemaining = s.current_stock / dailyVelocity;
    const suggestedReorder = Math.max(0, Math.ceil(TARGET_COVERAGE_DAYS * dailyVelocity - s.current_stock));

    withMovement.push({
      product_id: s.product_id,
      product_name: s.product_name,
      category: s.category,
      current_stock: s.current_stock,
      min_stock: s.min_stock,
      units_last_30_days: units30d,
      daily_velocity: Math.round(dailyVelocity * 100) / 100,
      days_remaining: Math.round(daysRemaining * 10) / 10,
      suggested_reorder: suggestedReorder,
    });
  }

  withMovement.sort((a, b) => a.days_remaining - b.days_remaining);
  noMovement.sort((a, b) => a.product_name.localeCompare(b.product_name));

  return {
    lookback_days: LOOKBACK_DAYS,
    target_coverage_days: TARGET_COVERAGE_DAYS,
    products: withMovement,
    products_without_recent_sales: noMovement,
  };
}
