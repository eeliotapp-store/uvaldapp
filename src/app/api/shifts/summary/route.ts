import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET: Obtener resumen de un turno (bypasa RLS)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shiftId = searchParams.get('shift_id');

  if (!shiftId) {
    return NextResponse.json({ error: 'shift_id requerido' }, { status: 400 });
  }

  const { data: summary, error } = await supabaseAdmin
    .from('v_shift_summary')
    .select('*')
    .eq('shift_id', shiftId)
    .single();

  if (error || !summary) {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ summary });
}
