import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';

// POST: Vaciar inventario (solo superadmin)
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
    if (confirm !== 'VACIAR_INVENTARIO') {
      return NextResponse.json(
        { error: 'Confirmación requerida: enviar { "confirm": "VACIAR_INVENTARIO" }' },
        { status: 400 }
      );
    }

    // Vaciar tabla de inventario
    const { error: inventoryError } = await supabaseAdmin
      .from('inventory')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Truco para borrar todo

    if (inventoryError) {
      console.error('Error clearing inventory:', inventoryError);
      return NextResponse.json(
        { error: 'Error al vaciar inventario' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Inventario vaciado correctamente',
    });
  } catch (error) {
    console.error('Clear inventory error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
