import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// POST: Ajustar inventario (correcciones manuales)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { inventory_id, new_quantity, reason } = body;

    if (!inventory_id || new_quantity === undefined) {
      return NextResponse.json(
        { error: 'ID de inventario y nueva cantidad son requeridos' },
        { status: 400 }
      );
    }

    // Obtener inventario actual
    const { data: current, error: fetchError } = await supabaseAdmin
      .from('inventory')
      .select('quantity')
      .eq('id', inventory_id)
      .single();

    if (fetchError || !current) {
      return NextResponse.json(
        { error: 'Registro de inventario no encontrado' },
        { status: 404 }
      );
    }

    // Actualizar cantidad
    const { data, error } = await supabaseAdmin
      .from('inventory')
      .update({
        quantity: parseInt(new_quantity),
      })
      .eq('id', inventory_id)
      .select()
      .single();

    if (error) throw error;

    // TODO: En el futuro, registrar este ajuste en una tabla de auditoría
    // con la razón del ajuste y quién lo hizo

    return NextResponse.json({
      success: true,
      previous_quantity: current.quantity,
      new_quantity: data.quantity,
      adjustment: data.quantity - current.quantity,
    });
  } catch (error) {
    console.error('Inventory adjustment error:', error);
    return NextResponse.json(
      { error: 'Error al ajustar inventario' },
      { status: 500 }
    );
  }
}
