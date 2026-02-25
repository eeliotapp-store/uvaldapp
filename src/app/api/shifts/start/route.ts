import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { employee_id, shift_type, cash_start } = await request.json();

    if (!employee_id || !shift_type) {
      return NextResponse.json(
        { error: 'Datos incompletos' },
        { status: 400 }
      );
    }

    // Verificar que no hay turno activo
    const { data: activeShift } = await supabaseAdmin
      .from('shifts')
      .select('*')
      .eq('employee_id', employee_id)
      .eq('is_active', true)
      .single();

    if (activeShift) {
      return NextResponse.json(
        { error: 'Ya tienes un turno activo' },
        { status: 400 }
      );
    }

    // Crear nuevo turno
    const { data: shift, error } = await supabaseAdmin
      .from('shifts')
      .insert({
        employee_id,
        type: shift_type,
        cash_start: cash_start || 0,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating shift:', error);
      return NextResponse.json(
        { error: 'Error al iniciar turno' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, shift });
  } catch (error) {
    console.error('Shift start error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
