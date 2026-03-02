import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

interface TakeoverRequest {
  new_employee_id: string;
  new_shift_id: string;
}

// POST: Traspasar una cuenta abierta a otro empleado
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: TakeoverRequest = await request.json();
    const { new_employee_id, new_shift_id } = body;

    if (!new_employee_id || !new_shift_id) {
      return NextResponse.json(
        { error: 'Datos incompletos' },
        { status: 400 }
      );
    }

    // Verificar que la venta existe y está abierta
    const { data: sale, error: saleError } = await supabaseAdmin
      .from('sales')
      .select('id, status, employee_id, opened_by_employee_id')
      .eq('id', id)
      .single();

    if (saleError || !sale) {
      return NextResponse.json(
        { error: 'Cuenta no encontrada' },
        { status: 404 }
      );
    }

    if (sale.status !== 'open') {
      return NextResponse.json(
        { error: 'Esta cuenta ya está cerrada' },
        { status: 400 }
      );
    }

    // Verificar que el nuevo empleado tiene turno activo
    const { data: newShift } = await supabaseAdmin
      .from('shifts')
      .select('id, employee_id')
      .eq('id', new_shift_id)
      .eq('is_active', true)
      .single();

    if (!newShift || newShift.employee_id !== new_employee_id) {
      return NextResponse.json(
        { error: 'El empleado no tiene un turno activo válido' },
        { status: 400 }
      );
    }

    // Actualizar la cuenta con el traspaso
    const { error: updateError } = await supabaseAdmin
      .from('sales')
      .update({
        employee_id: new_employee_id,
        shift_id: new_shift_id,
        taken_over_by_employee_id: new_employee_id,
        taken_over_at: new Date().toISOString(),
        // Si opened_by_employee_id es null, significa que es la primera vez
        // Guardamos el employee_id original como quien la abrió
        opened_by_employee_id: sale.opened_by_employee_id || sale.employee_id,
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error taking over tab:', updateError);
      return NextResponse.json(
        { error: 'Error al traspasar la cuenta' },
        { status: 500 }
      );
    }

    // Obtener info del empleado para respuesta
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('name')
      .eq('id', new_employee_id)
      .single();

    return NextResponse.json({
      success: true,
      message: `Cuenta traspasada a ${employee?.name || 'empleado'}`,
    });
  } catch (error) {
    console.error('Takeover error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
