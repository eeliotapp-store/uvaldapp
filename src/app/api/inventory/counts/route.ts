import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';

// GET: Obtener conteos de inventario (últimos por producto o historial)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const product_id = searchParams.get('product_id');
    const latest = searchParams.get('latest') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100');

    if (latest) {
      // Obtener el último conteo de cada producto
      const { data, error } = await supabaseAdmin
        .from('v_latest_inventory_counts')
        .select('*');

      if (error) throw error;

      return NextResponse.json({ counts: data });
    }

    // Historial de conteos
    let query = supabaseAdmin
      .from('inventory_counts')
      .select(`
        *,
        products (id, name),
        employees (id, name),
        shifts (id, type, start_time)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (product_id) {
      query = query.eq('product_id', product_id);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ counts: data });
  } catch (error) {
    console.error('Error fetching inventory counts:', error);
    return NextResponse.json(
      { error: 'Error al obtener conteos' },
      { status: 500 }
    );
  }
}

// POST: Registrar un conteo de inventario
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
    const { product_id, shift_id, system_stock, real_stock, notes } = body;

    if (!product_id || system_stock === undefined || real_stock === undefined) {
      return NextResponse.json(
        { error: 'Producto, stock del sistema y stock real son requeridos' },
        { status: 400 }
      );
    }

    if (real_stock < 0) {
      return NextResponse.json(
        { error: 'El stock real no puede ser negativo' },
        { status: 400 }
      );
    }

    // Insertar el conteo
    const { data, error } = await supabaseAdmin
      .from('inventory_counts')
      .insert({
        product_id,
        shift_id: shift_id || null,
        employee_id: payload.employee_id,
        system_stock: parseInt(system_stock),
        real_stock: parseInt(real_stock),
        notes: notes || null,
      })
      .select(`
        *,
        products (id, name),
        employees (id, name)
      `)
      .single();

    if (error) {
      console.error('Error creating inventory count:', error);
      return NextResponse.json(
        { error: 'Error al registrar conteo' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: data,
    });
  } catch (error) {
    console.error('Inventory count error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
