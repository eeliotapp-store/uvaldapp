import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// DELETE: Descartar cuenta abierta (solo si status='open')
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verificar que la venta existe y está abierta
    const { data: sale, error: fetchError } = await supabaseAdmin
      .from('sales')
      .select(`
        id,
        status,
        voided,
        sale_items (
          id,
          product_id,
          quantity
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError || !sale) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    }

    if (sale.status !== 'open' || sale.voided) {
      return NextResponse.json(
        { error: 'Solo se pueden descartar cuentas abiertas' },
        { status: 400 }
      );
    }

    // Si tiene items, devolver inventario antes de eliminar
    if (sale.sale_items && sale.sale_items.length > 0) {
      for (const item of sale.sale_items) {
        const { data: latestInventory } = await supabaseAdmin
          .from('inventory')
          .select('id, quantity')
          .eq('product_id', item.product_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (latestInventory) {
          await supabaseAdmin
            .from('inventory')
            .update({ quantity: latestInventory.quantity + item.quantity })
            .eq('id', latestInventory.id);
        }
      }

      // Eliminar items
      await supabaseAdmin.from('sale_items').delete().eq('sale_id', id);
    }

    // Eliminar la venta
    const { error: deleteError } = await supabaseAdmin
      .from('sales')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error discarding sale:', error);
    return NextResponse.json({ error: 'Error al descartar la cuenta' }, { status: 500 });
  }
}
