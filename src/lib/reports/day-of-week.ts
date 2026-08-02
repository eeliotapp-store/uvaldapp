/**
 * Lógica pura del reporte "Por día de la semana" en Estadísticas.
 * Sin dependencias externas (nada de Supabase/Next.js) — fácil de testear.
 */

export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // lunes -> domingo
export const MIN_UNITS_HISTORICAS = 15; // debe coincidir con el HAVING de v_product_sales_by_dow
export const TOP_PRODUCTS_PER_DAY = 15;

export interface DowOverallRow {
  dow: number;
  sales_count: number;
}

export interface DowProductRow {
  product_name: string;
  dow: number;
  day_units: number;
  day_revenue: number;
  pct_of_total: number;
  total_units: number;
}

export interface DowOccurrenceRow {
  dow: number;
  day_count: number;
}

export interface DayOfWeekPayload {
  overall: { dow: number; day_name: string; sales_count: number; occurrences: number; avg_sales_count: number }[];
  products_by_day: Record<number, {
    product_name: string;
    day_units: number;
    day_revenue: number;
    pct_of_total: number;
    total_units: number;
    avg_units: number;
  }[]>;
  min_units_threshold: number;
}

export function buildDayOfWeekPayload(
  overallRows: DowOverallRow[],
  productRows: DowProductRow[],
  occurrenceRows: DowOccurrenceRow[]
): DayOfWeekPayload {
  const occurrencesByDow = new Map<number, number>(occurrenceRows.map((r) => [r.dow, r.day_count]));
  const countsByDow = new Map<number, number>(overallRows.map((r) => [r.dow, r.sales_count]));

  const overall = DISPLAY_ORDER.map((dow) => {
    const occurrences = occurrencesByDow.get(dow) || 0;
    const salesCount = countsByDow.get(dow) || 0;
    return {
      dow,
      day_name: DAY_NAMES[dow],
      sales_count: salesCount,
      occurrences,
      avg_sales_count: occurrences > 0 ? Math.round((salesCount / occurrences) * 10) / 10 : 0,
    };
  });

  const productsByDay: DayOfWeekPayload['products_by_day'] = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const row of productRows) {
    const occurrences = occurrencesByDow.get(row.dow) || 0;
    productsByDay[row.dow].push({
      product_name: row.product_name,
      day_units: row.day_units,
      day_revenue: row.day_revenue,
      pct_of_total: row.pct_of_total,
      total_units: row.total_units,
      avg_units: occurrences > 0 ? Math.round((row.day_units / occurrences) * 10) / 10 : 0,
    });
  }
  for (const dow of Object.keys(productsByDay).map(Number)) {
    productsByDay[dow] = productsByDay[dow]
      .sort((a, b) => b.pct_of_total - a.pct_of_total)
      .slice(0, TOP_PRODUCTS_PER_DAY);
  }

  return {
    overall,
    products_by_day: productsByDay,
    min_units_threshold: MIN_UNITS_HISTORICAS,
  };
}
