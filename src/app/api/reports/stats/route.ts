import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET: Estadísticas diarias (últimos 30 días) y semanales (últimas 8 semanas)
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

    return NextResponse.json({ daily: daily || [], weekly: weekly || [] });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    return NextResponse.json({ error: 'Error al obtener estadísticas' }, { status: 500 });
  }
}
