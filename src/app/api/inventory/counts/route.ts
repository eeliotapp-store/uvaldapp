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

// Función para ajustar el inventario cuando hay diferencia
async function adjustInventory(productId: string, systemStock: number, realStock: number) {
  const difference = realStock - systemStock;

  if (difference === 0) return; // No hay diferencia, no hacer nada

  // Obtener las entradas de inventario del producto ordenadas por fecha (más recientes primero)
  const { data: entries, error: fetchError } = await supabaseAdmin
    .from('inventory')
    .select('id, quantity')
    .eq('product_id', productId)
    .gt('quantity', 0)
    .order('created_at', { ascending: false });

  if (fetchError) {
    console.error('Error fetching inventory entries:', fetchError);
    throw fetchError;
  }

  if (difference > 0) {
    // Hay más stock del que dice el sistema - agregar al entry más reciente
    if (entries && entries.length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('inventory')
        .update({ quantity: entries[0].quantity + difference })
        .eq('id', entries[0].id);

      if (updateError) {
        console.error('Error updating inventory:', updateError);
        throw updateError;
      }
    }
  } else {
    // Hay menos stock del que dice el sistema - reducir de los entries
    let remaining = Math.abs(difference);

    for (const entry of entries || []) {
      if (remaining <= 0) break;

      const reduction = Math.min(entry.quantity, remaining);
      const newQuantity = entry.quantity - reduction;

      const { error: updateError } = await supabaseAdmin
        .from('inventory')
        .update({ quantity: newQuantity })
        .eq('id', entry.id);

      if (updateError) {
        console.error('Error updating inventory entry:', updateError);
        throw updateError;
      }

      remaining -= reduction;
    }
  }
}

// POST: Registrar un conteo de inventario y ajustar stock
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

    const realStockNum = parseInt(real_stock);
    const systemStockNum = parseInt(system_stock);

    if (realStockNum < 0) {
      return NextResponse.json(
        { error: 'El stock real no puede ser negativo' },
        { status: 400 }
      );
    }

    // 1. Insertar el conteo en el historial
    const { data, error } = await supabaseAdmin
      .from('inventory_counts')
      .insert({
        product_id,
        shift_id: shift_id || null,
        employee_id: payload.employee_id,
        system_stock: systemStockNum,
        real_stock: realStockNum,
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

    // 2. Ajustar el inventario real si hay diferencia
    try {
      await adjustInventory(product_id, systemStockNum, realStockNum);
    } catch (adjustError) {
      console.error('Error adjusting inventory:', adjustError);
      // El conteo ya se guardó, pero no se pudo ajustar el inventario
      // Continuamos y reportamos el problema
    }

    return NextResponse.json({
      success: true,
      count: data,
      adjusted: realStockNum !== systemStockNum,
      difference: realStockNum - systemStockNum,
    });
  } catch (error) {
    console.error('Inventory count error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
