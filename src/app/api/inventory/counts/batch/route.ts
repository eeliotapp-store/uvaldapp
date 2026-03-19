import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';

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

// POST: Registrar múltiples conteos de inventario y ajustar stock
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

    // 1. Insertar todos los conteos en el historial
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

    // 2. Ajustar el inventario real para cada producto con diferencia
    let adjustedCount = 0;
    const adjustmentErrors: string[] = [];

    for (const count of counts) {
      const systemStock = parseInt(String(count.system_stock));
      const realStock = parseInt(String(count.real_stock));

      if (systemStock !== realStock) {
        try {
          await adjustInventory(count.product_id, systemStock, realStock);
          adjustedCount++;
        } catch (adjustError) {
          console.error(`Error adjusting inventory for product ${count.product_id}:`, adjustError);
          adjustmentErrors.push(count.product_id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      counts: data,
      message: `${data.length} conteos registrados, ${adjustedCount} ajustes de inventario realizados`,
      adjustedCount,
      adjustmentErrors: adjustmentErrors.length > 0 ? adjustmentErrors : undefined,
    });
  } catch (error) {
    console.error('Batch inventory count error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
