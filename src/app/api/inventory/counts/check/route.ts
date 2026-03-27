import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET: Verificar si un empleado ya hizo el conteo de inventario para un turno
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shiftId = searchParams.get('shift_id');
  const employeeId = searchParams.get('employee_id');

  if (!shiftId || !employeeId) {
    return NextResponse.json({ has_count: false });
  }

  try {
    const { data: counts } = await supabaseAdmin
      .from('inventory_counts')
      .select('id')
      .eq('shift_id', shiftId)
      .eq('employee_id', employeeId)
      .limit(1);

    return NextResponse.json({ has_count: (counts && counts.length > 0) });
  } catch {
    return NextResponse.json({ has_count: false });
  }
}
