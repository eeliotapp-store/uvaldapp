import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';

// GET: Obtener una entrada de inventario específica
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('inventory')
      .select(`
        *,
        products (id, name, sale_price),
        suppliers (id, name),
        employees (name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error getting inventory entry:', error);
      return NextResponse.json({ error: 'Error al obtener entrada' }, { status: 500 });
    }

    return NextResponse.json({ entry: data });
  } catch (error) {
    console.error('Get inventory entry error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PUT: Actualizar una entrada de inventario
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Solo owner y superadmin pueden editar entradas de inventario
    if (payload.role !== 'owner' && payload.role !== 'superadmin') {
      return NextResponse.json({ error: 'No tienes permisos para editar inventario' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { quantity, initial_quantity, purchase_price, supplier_id, batch_date, notes } = body;

    // Validaciones
    if (quantity !== undefined && (isNaN(quantity) || quantity < 0)) {
      return NextResponse.json({ error: 'Cantidad inválida' }, { status: 400 });
    }

    if (initial_quantity !== undefined && (isNaN(initial_quantity) || initial_quantity < 0)) {
      return NextResponse.json({ error: 'Cantidad inicial inválida' }, { status: 400 });
    }

    if (purchase_price !== undefined && (isNaN(purchase_price) || purchase_price < 0)) {
      return NextResponse.json({ error: 'Precio inválido' }, { status: 400 });
    }

    // Construir objeto de actualización solo con campos proporcionados
    const updateData: Record<string, unknown> = {};

    if (quantity !== undefined) updateData.quantity = quantity;
    if (initial_quantity !== undefined) updateData.initial_quantity = initial_quantity;
    if (purchase_price !== undefined) updateData.purchase_price = purchase_price;
    if (supplier_id !== undefined) updateData.supplier_id = supplier_id;
    if (batch_date !== undefined) updateData.batch_date = batch_date;
    if (notes !== undefined) updateData.notes = notes;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No hay datos para actualizar' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('inventory')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating inventory:', error);
      return NextResponse.json({ error: 'Error al actualizar inventario' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Inventario actualizado correctamente',
      entry: data,
    });
  } catch (error) {
    console.error('Update inventory error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE: Eliminar una entrada de inventario
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Solo superadmin puede eliminar entradas
    if (payload.role !== 'superadmin') {
      return NextResponse.json({ error: 'Solo el superadmin puede eliminar entradas' }, { status: 403 });
    }

    const { id } = await params;

    const { error } = await supabaseAdmin
      .from('inventory')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting inventory:', error);
      return NextResponse.json({ error: 'Error al eliminar entrada' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Entrada eliminada correctamente',
    });
  } catch (error) {
    console.error('Delete inventory error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
