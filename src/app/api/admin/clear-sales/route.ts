import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';

// POST: Vaciar ventas (solo superadmin)
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Solo superadmin puede realizar esta acción' },
        { status: 403 }
      );
    }

    // Obtener confirmación del body
    const { confirm } = await request.json();
    if (confirm !== 'VACIAR_VENTAS') {
      return NextResponse.json(
        { error: 'Confirmación requerida: enviar { "confirm": "VACIAR_VENTAS" }' },
        { status: 400 }
      );
    }

    // Primero borrar sale_items (FK constraint)
    const { error: itemsError } = await supabaseAdmin
      .from('sale_items')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (itemsError) {
      console.error('Error clearing sale_items:', itemsError);
      return NextResponse.json(
        { error: 'Error al vaciar items de venta' },
        { status: 500 }
      );
    }

    // Luego borrar sales
    const { error: salesError } = await supabaseAdmin
      .from('sales')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (salesError) {
      console.error('Error clearing sales:', salesError);
      return NextResponse.json(
        { error: 'Error al vaciar ventas' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Ventas vaciadas correctamente',
    });
  } catch (error) {
    console.error('Clear sales error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
