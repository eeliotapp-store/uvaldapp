import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { employee_id, shift_type, cash_start, transfer_start } = await request.json();

    if (!employee_id || !shift_type) {
      return NextResponse.json(
        { error: 'Datos incompletos' },
        { status: 400 }
      );
    }

    // Cerrar cualquier turno que esta empleada haya dejado abierto, sin importar su antigüedad.
    // Al llegar aquí el cliente ya verificó que no hay un turno activo reciente en curso
    // (ver /api/shifts/active), así que estos son turnos olvidados: cerrarlos evita que un
    // turno colgado bloquee el inicio del nuevo. Se cierran todos por si quedó más de uno.
    await supabaseAdmin
      .from('shifts')
      .update({
        is_active: false,
        end_time: new Date().toISOString(),
        notes: 'Cerrado automáticamente al iniciar un nuevo turno',
      })
      .eq('employee_id', employee_id)
      .eq('is_active', true);

    // Crear nuevo turno
    const { data: shift, error } = await supabaseAdmin
      .from('shifts')
      .insert({
        employee_id,
        type: shift_type,
        cash_start: cash_start || 0,
        transfer_start: transfer_start || 0,
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
