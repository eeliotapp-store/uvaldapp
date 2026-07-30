import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // lunes -> domingo
const MIN_UNITS_HISTORICAS = 15; // debe coincidir con el HAVING de v_product_sales_by_dow
const TOP_PRODUCTS_PER_DAY = 15;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora — estos patrones históricos cambian lento

interface DayOfWeekPayload {
  overall: { dow: number; day_name: string; sales_count: number }[];
  products_by_day: Record<number, {
    product_name: string;
    day_units: number;
    day_revenue: number;
    pct_of_total: number;
    total_units: number;
  }[]>;
  min_units_threshold: number;
}

let cache: { data: DayOfWeekPayload; expiresAt: number } | null = null;

export async function GET() {
  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json(cache.data);
  }

  try {
    const [{ data: overallRows, error: overallError }, { data: productRows, error: productError }] = await Promise.all([
      supabaseAdmin.from('v_sales_by_dow').select('dow, sales_count'),
      supabaseAdmin
        .from('v_product_sales_by_dow')
        .select('product_name, dow, day_units, day_revenue, pct_of_total, total_units'),
    ]);

    if (overallError) throw overallError;
    if (productError) throw productError;

    const countsByDow = new Map<number, number>((overallRows || []).map((r) => [r.dow, r.sales_count]));
    const overall = DISPLAY_ORDER.map((dow) => ({
      dow,
      day_name: DAY_NAMES[dow],
      sales_count: countsByDow.get(dow) || 0,
    }));

    const productsByDay: DayOfWeekPayload['products_by_day'] = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const row of productRows || []) {
      productsByDay[row.dow].push({
        product_name: row.product_name,
        day_units: row.day_units,
        day_revenue: row.day_revenue,
        pct_of_total: row.pct_of_total,
        total_units: row.total_units,
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
