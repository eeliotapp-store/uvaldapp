import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET: Estadísticas diarias (últimos 30 días), semanales (últimas 8 semanas) y mensuales (últimos 6 meses)
export async function GET() {
  try {
    const { data: daily, error: dailyError } = await supabaseAdmin
      .from('v_daily_stats')
      .select('*')
      .limit(30);

    if (dailyError) throw dailyError;

    const { data: weekly, error: weeklyError } = await supabaseAdmin
      .from('v_weekly_stats')
      .select('*')
      .limit(8);

    if (weeklyError) throw weeklyError;

    const { data: monthly, error: monthlyError } = await supabaseAdmin
      .from('v_monthly_stats')
      .select('*')
      .limit(6);

    if (monthlyError) throw monthlyError;

    return NextResponse.json({ daily: daily || [], weekly: weekly || [], monthly: monthly || [] });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    return NextResponse.json({ error: 'Error al obtener estadísticas' }, { status: 500 });
  }
}
