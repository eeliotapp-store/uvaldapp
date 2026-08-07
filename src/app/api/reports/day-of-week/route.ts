import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { buildDayOfWeekPayload, type DayOfWeekPayload } from '@/lib/reports/day-of-week';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora — estos patrones históricos cambian lento

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
      supabaseAdmin.from('v_sales_by_dow').select('dow, sales_count, revenue'),
      supabaseAdmin
        .from('v_product_sales_by_dow')
        .select('product_name, dow, day_units, day_revenue, pct_of_total, total_units'),
      supabaseAdmin.from('v_dow_occurrences').select('dow, day_count'),
    ]);

    if (overallError) throw overallError;
    if (productError) throw productError;
    if (occurrenceError) throw occurrenceError;

    const payload = buildDayOfWeekPayload(overallRows || [], productRows || [], occurrenceRows || []);

    cache = { data: payload, expiresAt: Date.now() + CACHE_TTL_MS };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error en reporte de día de la semana:', error);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
