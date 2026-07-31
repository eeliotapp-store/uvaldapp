import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // lunes -> domingo
const MIN_UNITS_HISTORICAS = 15; // debe coincidir con el HAVING de v_product_sales_by_dow
const TOP_PRODUCTS_PER_DAY = 15;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora — estos patrones históricos cambian lento

interface DayOfWeekPayload {
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

let cache: { data: DayOfWeekPayload; expiresAt: number } | null = null;

export async function GET() {
  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json(cache.data);
  }

  try {
    const [
      { data: overallRows, error: overallError },
      { data: productRows, error: productError },
      { data: occurrenceRows, error: occurrenceError },
    ] = await Promise.all([
      supabaseAdmin.from('v_sales_by_dow').select('dow, sales_count'),
      supabaseAdmin
        .from('v_product_sales_by_dow')
        .select('product_name, dow, day_units, day_revenue, pct_of_total, total_units'),
      supabaseAdmin.from('v_dow_occurrences').select('dow, day_count'),
    ]);

    if (overallError) throw overallError;
    if (productError) throw productError;
    if (occurrenceError) throw occurrenceError;

    const occurrencesByDow = new Map<number, number>((occurrenceRows || []).map((r) => [r.dow, r.day_count]));

    const countsByDow = new Map<number, number>((overallRows || []).map((r) => [r.dow, r.sales_count]));
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
    for (const row of productRows || []) {
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

    const payload: DayOfWeekPayload = {
      overall,
      products_by_day: productsByDay,
      min_units_threshold: MIN_UNITS_HISTORICAS,
    };

    cache = { data: payload, expiresAt: Date.now() + CACHE_TTL_MS };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error en reporte de día de la semana:', error);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
