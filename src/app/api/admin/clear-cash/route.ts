import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';

// POST: Vaciar caja - poner cash_start y cash_end en 0 para todos los turnos (owner y superadmin)
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || (payload.role !== 'superadmin' && payload.role !== 'owner')) {
      return NextResponse.json(
        { error: 'Solo owner o superadmin puede realizar esta acción' },
        { status: 403 }
      );
    }

    const { confirm } = await request.json();
    if (confirm !== 'VACIAR_CAJA') {
      return NextResponse.json(
        { error: 'Confirmación requerida: enviar { "confirm": "VACIAR_CAJA" }' },
        { status: 400 }
      );
    }

    // Actualizar todos los turnos: poner cash_start y cash_end en 0
    const { error } = await supabaseAdmin
      .from('shifts')
      .update({ cash_start: 0, cash_end: 0 })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      console.error('Error clearing cash:', error);
      return NextResponse.json({ error: 'Error al vaciar caja' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Caja vaciada correctamente. Todos los registros de efectivo han sido reiniciados a $0.'
    });
  } catch (error) {
    console.error('Clear cash error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
