import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';

// POST: Resetear todo el stock a cero (solo owner/superadmin)
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Verificar que sea owner o superadmin
    if (payload.role !== 'owner' && payload.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Solo el owner o superadmin puede resetear el stock' },
        { status: 403 }
      );
    }

    // Resetear todas las cantidades de inventario a 0
    const { error } = await supabaseAdmin
      .from('inventory')
      .update({ quantity: 0 })
      .gte('quantity', 0); // Actualiza todos los registros

    if (error) {
      console.error('Error resetting inventory:', error);
      return NextResponse.json(
        { error: 'Error al resetear inventario' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Todo el stock ha sido reseteado a 0',
    });
  } catch (error) {
    console.error('Reset inventory error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
