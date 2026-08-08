/**
 * Lógica pura del reporte "Por día del mes" en Estadísticas: qué día del mes (ej. el 15, el 30)
 * y qué semana del mes (semana 1 = días 1-7 ... semana 4 = días 22-31, la última absorbe
 * la cola del mes) venden más en promedio.
 * Sin dependencias externas (nada de Supabase/Next.js) — fácil de testear.
 */

export const WEEK_OF_MONTH_COUNT = 4;

export const WEEK_OF_MONTH_LABELS: Record<number, string> = {
  1: 'Semana 1 (1–7)',
  2: 'Semana 2 (8–14)',
  3: 'Semana 3 (15–21)',
  4: 'Semana 4 (22–31)',
};

export interface DomRow {
  dom: number;
  sales_count: number;
  revenue: number;
}

export interface DomOccurrenceRow {
  dom: number;
  day_count: number;
}

export interface WeekOfMonthRow {
  week_bucket: number;
  sales_count: number;
  revenue: number;
}

export interface WeekOfMonthOccurrenceRow {
  week_bucket: number;
  month_count: number;
}

export interface DomEntry {
  dom: number;
  sales_count: number;
  revenue: number;
  occurrences: number;
  avg_sales_count: number;
  avg_revenue: number;
}

export interface WeekOfMonthEntry {
  week_bucket: number;
  label: string;
  sales_count: number;
  revenue: number;
  occurrences: number;
  avg_sales_count: number;
  avg_revenue: number;
}

export interface DayConcentrationItem {
  dom: number;
  avg_revenue: number;
  pct_of_total: number;
  cumulative_pct: number;
}

export interface DayConcentration {
  total_avg_revenue: number;
  items: DayConcentrationItem[]; // días con datos, ordenados de mayor a menor ingreso promedio
  days_for_50pct: number;
  days_for_80pct: number;
}

export interface MonthCyclePayload {
  by_day: DomEntry[];
  by_week: WeekOfMonthEntry[];
  concentration: DayConcentration;
}

/**
 * Pareto por día del mes: ordena los días por su ingreso promedio y calcula cuántos días
 * concentran el 50% y el 80% de los ingresos de un mes típico. Usa avg_revenue (no el total
 * crudo) para que un día con pocas ocurrencias no se vea artificialmente bajo.
 */
export function buildDayConcentration(byDay: DomEntry[]): DayConcentration {
  const withData = byDay.filter((d) => d.avg_revenue > 0);
  const total = withData.reduce((sum, d) => sum + d.avg_revenue, 0);
  const sorted = [...withData].sort((a, b) => b.avg_revenue - a.avg_revenue);

  let cumulative = 0;
  let daysFor50 = sorted.length;
  let daysFor80 = sorted.length;
  let reached50 = false;
  let reached80 = false;

  const items: DayConcentrationItem[] = sorted.map((d, idx) => {
    cumulative += d.avg_revenue;
    const cumulativePct = total > 0 ? Math.round((cumulative / total) * 1000) / 10 : 0;
    if (!reached50 && cumulativePct >= 50) {
      daysFor50 = idx + 1;
      reached50 = true;
    }
    if (!reached80 && cumulativePct >= 80) {
      daysFor80 = idx + 1;
      reached80 = true;
    }
    return {
      dom: d.dom,
      avg_revenue: d.avg_revenue,
      pct_of_total: total > 0 ? Math.round((d.avg_revenue / total) * 1000) / 10 : 0,
      cumulative_pct: cumulativePct,
    };
  });

  return {
    total_avg_revenue: total,
    items,
    days_for_50pct: daysFor50,
    days_for_80pct: daysFor80,
  };
}

export function buildMonthCyclePayload(
  domRows: DomRow[],
  domOccurrenceRows: DomOccurrenceRow[],
  weekRows: WeekOfMonthRow[],
  weekOccurrenceRows: WeekOfMonthOccurrenceRow[]
): MonthCyclePayload {
  const domOccByDom = new Map<number, number>(domOccurrenceRows.map((r) => [r.dom, r.day_count]));
  const domByDom = new Map<number, DomRow>(domRows.map((r) => [r.dom, r]));

  const by_day: DomEntry[] = [];
  for (let dom = 1; dom <= 31; dom++) {
    const row = domByDom.get(dom);
    const occurrences = domOccByDom.get(dom) || 0;
    const salesCount = row?.sales_count || 0;
    const revenue = Number(row?.revenue) || 0;
    by_day.push({
      dom,
      sales_count: salesCount,
      revenue,
      occurrences,
      avg_sales_count: occurrences > 0 ? Math.round((salesCount / occurrences) * 10) / 10 : 0,
      avg_revenue: occurrences > 0 ? Math.round(revenue / occurrences) : 0,
    });
  }

  const weekOccByBucket = new Map<number, number>(weekOccurrenceRows.map((r) => [r.week_bucket, r.month_count]));
  const weekByBucket = new Map<number, WeekOfMonthRow>(weekRows.map((r) => [r.week_bucket, r]));

  const by_week: WeekOfMonthEntry[] = [];
  for (let bucket = 1; bucket <= WEEK_OF_MONTH_COUNT; bucket++) {
    const row = weekByBucket.get(bucket);
    const occurrences = weekOccByBucket.get(bucket) || 0;
    const salesCount = row?.sales_count || 0;
    const revenue = Number(row?.revenue) || 0;
    by_week.push({
      week_bucket: bucket,
      label: WEEK_OF_MONTH_LABELS[bucket],
      sales_count: salesCount,
      revenue,
      occurrences,
      avg_sales_count: occurrences > 0 ? Math.round((salesCount / occurrences) * 10) / 10 : 0,
      avg_revenue: occurrences > 0 ? Math.round(revenue / occurrences) : 0,
    });
  }

  return { by_day, by_week, concentration: buildDayConcentration(by_day) };
}
