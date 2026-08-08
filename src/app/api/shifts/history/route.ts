import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET: Historial de turnos (vista v_shift_summary) filtrado por rango de fechas.
// Se hace server-side con supabaseAdmin porque la vista/tabla shifts está protegida por RLS
// y el cliente anónimo del navegador no puede leerla (devolvía vacío).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  try {
    let query = supabaseAdmin
      .from('v_shift_summary')
      .select('*')
      .order('start_time', { ascending: false });

    if (startDate) {
      query = query.gte('start_time', `${startDate}T00:00:00`);
    }
    if (endDate) {
      query = query.lte('start_time', `${endDate}T23:59:59`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ shifts: data || [] });
  } catch (error) {
    console.error('Error al obtener historial de turnos:', error);
    return NextResponse.json({ error: 'Error al obtener el historial de turnos' }, { status: 500 });
  }
}
