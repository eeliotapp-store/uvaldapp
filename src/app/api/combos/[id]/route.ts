import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';

// GET: Obtener un combo específico
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
      .from('combos')
      .select(`
        *,
        combo_items (
          id,
          product_id,
          quantity,
          is_swappable,
          is_michelada,
          products (
            id,
            name,
            category,
            sale_price,
            active
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error getting combo:', error);
      return NextResponse.json({ error: 'Combo no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ combo: data });
  } catch (error) {
    console.error('Get combo error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PUT: Actualizar un combo
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

    // Solo owner y superadmin pueden editar combos
    if (payload.role !== 'owner' && payload.role !== 'superadmin') {
      return NextResponse.json({ error: 'No tienes permisos para editar combos' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, base_price, is_price_editable, is_active, items } = body;

    // Actualizar el combo
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (base_price !== undefined) updateData.base_price = parseFloat(base_price);
    if (is_price_editable !== undefined) updateData.is_price_editable = is_price_editable;
    if (is_active !== undefined) updateData.is_active = is_active;

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('combos')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        console.error('Error updating combo:', updateError);
        return NextResponse.json({ error: 'Error al actualizar combo' }, { status: 500 });
      }
    }

    // Si se proporcionan items, actualizar los items del combo
    if (items && Array.isArray(items)) {
      // Eliminar items existentes
      const { error: deleteError } = await supabaseAdmin
        .from('combo_items')
        .delete()
        .eq('combo_id', id);

      if (deleteError) {
        console.error('Error deleting combo items:', deleteError);
        return NextResponse.json({ error: 'Error al actualizar items' }, { status: 500 });
      }

      // Crear nuevos items
      if (items.length > 0) {
        const comboItems = items.map((item: {
          product_id: string;
          quantity: number;
          is_swappable?: boolean;
          is_michelada?: boolean;
        }) => ({
          combo_id: id,
          product_id: item.product_id,
          quantity: item.quantity || 1,
          is_swappable: item.is_swappable || false,
          is_michelada: item.is_michelada || false,
        }));

        const { error: insertError } = await supabaseAdmin
          .from('combo_items')
          .insert(comboItems);

        if (insertError) {
          console.error('Error inserting combo items:', insertError);
          return NextResponse.json({ error: 'Error al crear items' }, { status: 500 });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Combo actualizado correctamente',
    });
  } catch (error) {
    console.error('Update combo error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE: Desactivar un combo (soft delete)
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

    // Solo owner y superadmin pueden eliminar combos
    if (payload.role !== 'owner' && payload.role !== 'superadmin') {
      return NextResponse.json({ error: 'No tienes permisos para eliminar combos' }, { status: 403 });
    }

    const { id } = await params;

    // Soft delete - solo desactivar
    const { error } = await supabaseAdmin
      .from('combos')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('Error deactivating combo:', error);
      return NextResponse.json({ error: 'Error al desactivar combo' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Combo desactivado correctamente',
    });
  } catch (error) {
    console.error('Delete combo error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
