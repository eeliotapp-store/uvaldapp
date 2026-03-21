import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';

// POST: Vaciar ventas (owner y superadmin)
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
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

    // Obtener confirmación del body
    const { confirm } = await request.json();
    if (confirm !== 'VACIAR_VENTAS') {
      return NextResponse.json(
        { error: 'Confirmación requerida: enviar { "confirm": "VACIAR_VENTAS" }' },
        { status: 400 }
      );
    }

    // 1. Borrar partial_payment_items (FK a sale_items)
    const { error: ppItemsError } = await supabaseAdmin
      .from('partial_payment_items')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (ppItemsError) {
      console.error('Error clearing partial_payment_items:', ppItemsError);
      return NextResponse.json(
        { error: 'Error al vaciar items de pagos parciales' },
        { status: 500 }
      );
    }

    // 2. Borrar partial_payments (FK a sales)
    const { error: ppError } = await supabaseAdmin
      .from('partial_payments')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (ppError) {
      console.error('Error clearing partial_payments:', ppError);
      return NextResponse.json(
        { error: 'Error al vaciar pagos parciales' },
        { status: 500 }
      );
    }

    // 3. Borrar sale_items (FK a sales)
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

    // 4. Borrar sales
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
