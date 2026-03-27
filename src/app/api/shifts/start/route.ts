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

    // Verificar que no hay turno activo reciente
    const { data: activeShift } = await supabaseAdmin
      .from('shifts')
      .select('id, start_time')
      .eq('employee_id', employee_id)
      .eq('is_active', true)
      .single();

    if (activeShift) {
      const ageMs = Date.now() - new Date(activeShift.start_time).getTime();
      const isStale = ageMs > 20 * 60 * 60 * 1000; // Más de 20 horas = turno olvidado

      if (isStale) {
        // Cerrar automáticamente el turno olvidado
        await supabaseAdmin
          .from('shifts')
          .update({
            is_active: false,
            end_time: new Date().toISOString(),
            notes: 'Turno cerrado automáticamente por inactividad',
          })
          .eq('id', activeShift.id);
      } else {
        return NextResponse.json(
          { error: 'Ya tienes un turno activo' },
          { status: 400 }
        );
      }
    }

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
