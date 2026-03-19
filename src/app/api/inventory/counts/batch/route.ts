import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';

// POST: Registrar múltiples conteos de inventario
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

    const body = await request.json();
    const { counts } = body;

    if (!counts || !Array.isArray(counts) || counts.length === 0) {
      return NextResponse.json(
        { error: 'Debe enviar al menos un conteo' },
        { status: 400 }
      );
    }

    // Validar cada conteo
    for (const count of counts) {
      if (!count.product_id || count.system_stock === undefined || count.real_stock === undefined) {
        return NextResponse.json(
          { error: 'Cada conteo debe tener product_id, system_stock y real_stock' },
          { status: 400 }
        );
      }

      if (count.real_stock < 0) {
        return NextResponse.json(
          { error: 'El stock real no puede ser negativo' },
          { status: 400 }
        );
      }
    }

    // Preparar los registros para inserción
    const records = counts.map((count: {
      product_id: string;
      system_stock: number;
      real_stock: number;
      shift_id?: string;
      notes?: string;
    }) => ({
      product_id: count.product_id,
      shift_id: count.shift_id || null,
      employee_id: payload.employee_id,
      system_stock: parseInt(String(count.system_stock)),
      real_stock: parseInt(String(count.real_stock)),
      notes: count.notes || null,
    }));

    // Insertar todos los conteos
    const { data, error } = await supabaseAdmin
      .from('inventory_counts')
      .insert(records)
      .select();

    if (error) {
      console.error('Error creating inventory counts:', error);
      return NextResponse.json(
        { error: 'Error al registrar conteos' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      counts: data,
      message: `${data.length} conteos registrados correctamente`,
    });
  } catch (error) {
    console.error('Batch inventory count error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
