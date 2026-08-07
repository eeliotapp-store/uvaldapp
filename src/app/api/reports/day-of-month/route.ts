import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { buildMonthCyclePayload, type MonthCyclePayload } from '@/lib/reports/day-of-month';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora — estos patrones históricos cambian lento

let cache: { data: MonthCyclePayload; expiresAt: number } | null = null;

export async function GET() {
  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json(cache.data);
  }

  try {
    const [
      { data: domRows, error: domError },
      { data: domOccurrenceRows, error: domOccurrenceError },
      { data: weekRows, error: weekError },
      { data: weekOccurrenceRows, error: weekOccurrenceError },
    ] = await Promise.all([
      supabaseAdmin.from('v_sales_by_dom').select('dom, sales_count, revenue'),
      supabaseAdmin.from('v_dom_occurrences').select('dom, day_count'),
      supabaseAdmin.from('v_sales_by_week_of_month').select('week_bucket, sales_count, revenue'),
      supabaseAdmin.from('v_week_of_month_occurrences').select('week_bucket, month_count'),
    ]);

    if (domError) throw domError;
    if (domOccurrenceError) throw domOccurrenceError;
    if (weekError) throw weekError;
    if (weekOccurrenceError) throw weekOccurrenceError;

    const payload = buildMonthCyclePayload(
      domRows || [],
      domOccurrenceRows || [],
      weekRows || [],
      weekOccurrenceRows || []
    );

    cache = { data: payload, expiresAt: Date.now() + CACHE_TTL_MS };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error en reporte de día/semana del mes:', error);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
