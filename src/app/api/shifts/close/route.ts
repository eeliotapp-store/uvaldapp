import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { shift_id, cash_end, notes } = await request.json();

    if (!shift_id) {
      return NextResponse.json(
        { error: 'Turno no especificado' },
        { status: 400 }
      );
    }

    // Obtener turno y calcular totales
    const { data: shiftSummary, error: summaryError } = await supabaseAdmin
      .from('v_shift_summary')
      .select('*')
      .eq('shift_id', shift_id)
      .single();

    if (summaryError || !shiftSummary) {
      return NextResponse.json(
        { error: 'Turno no encontrado' },
        { status: 404 }
      );
    }

    // Cerrar turno
    const { data: shift, error } = await supabaseAdmin
      .from('shifts')
      .update({
        end_time: new Date().toISOString(),
        cash_end: cash_end || 0,
        notes,
        is_active: false,
      })
      .eq('id', shift_id)
      .select()
      .single();

    if (error) {
      console.error('Error closing shift:', error);
      return NextResponse.json(
        { error: 'Error al cerrar turno' },
        { status: 500 }
      );
    }

    // Calcular diferencia
    const expectedCash = shiftSummary.cash_start + shiftSummary.cash_sales;
    const difference = (cash_end || 0) - expectedCash;

    return NextResponse.json({
      success: true,
      shift,
      summary: {
        ...shiftSummary,
        expected_cash: expectedCash,
        actual_cash: cash_end,
        difference,
      },
    });
  } catch (error) {
    console.error('Shift close error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
