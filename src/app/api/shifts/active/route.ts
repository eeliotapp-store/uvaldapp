import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET: Verificar turno activo de un empleado (evita consultas client-side que pueden ser bloqueadas por RLS)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employee_id');
  const shiftId = searchParams.get('shift_id');

  if (!employeeId) {
    return NextResponse.json({ error: 'employee_id requerido' }, { status: 400 });
  }

  try {
    // Solo turnos iniciados en las últimas 20 horas (filtra turnos viejos no cerrados)
    const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();

    let query = supabaseAdmin
      .from('shifts')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('is_active', true)
      .gte('start_time', twentyHoursAgo);

    if (shiftId) {
      query = query.eq('id', shiftId);
    }

    const { data: shift } = await query.single();

    return NextResponse.json({ shift: shift || null });
  } catch {
    return NextResponse.json({ shift: null });
  }
}
