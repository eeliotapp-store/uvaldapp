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

export interface MonthCyclePayload {
  by_day: DomEntry[];
  by_week: WeekOfMonthEntry[];
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

  return { by_day, by_week };
}
