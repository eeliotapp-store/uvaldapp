import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';

// POST: Vaciar proveedores (solo superadmin)
export async function POST(request: NextRequest) {
  try {
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

    const { confirm } = await request.json();
    if (confirm !== 'VACIAR_PROVEEDORES') {
      return NextResponse.json(
        { error: 'Confirmación requerida' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('suppliers')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      console.error('Error clearing suppliers:', error);
      return NextResponse.json({ error: 'Error al vaciar proveedores' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Proveedores vaciados correctamente' });
  } catch (error) {
    console.error('Clear suppliers error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
