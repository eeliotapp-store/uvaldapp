import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logSaleVoided } from '@/lib/audit';

// POST: Anular venta
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { reason, employee_id } = await request.json();

    if (!reason) {
      return NextResponse.json(
        { error: 'Razón de anulación es requerida' },
        { status: 400 }
      );
    }

    // Verificar que la venta existe y no está anulada
    const { data: sale, error: fetchError } = await supabaseAdmin
      .from('sales')
      .select(`
        *,
        sale_items (
          id,
          product_id,
          quantity
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError || !sale) {
      return NextResponse.json(
        { error: 'Venta no encontrada' },
        { status: 404 }
      );
    }

    if (sale.voided) {
      return NextResponse.json(
        { error: 'Esta venta ya está anulada' },
        { status: 400 }
      );
    }

    // Devolver inventario
    for (const item of sale.sale_items) {
      // Encontrar el lote más reciente de este producto y agregar la cantidad
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

    // Si es fiado, eliminar los pagos registrados (la deuda ya no existe)
    if (sale.payment_method === 'fiado') {
      await supabaseAdmin.from('fiado_payments').delete().eq('sale_id', id);
    }

    // Marcar venta como anulada
    const { error: updateError } = await supabaseAdmin
      .from('sales')
      .update({
        voided: true,
        voided_reason: reason,
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // Registrar en auditoría
    if (employee_id) {
      await logSaleVoided(id, employee_id, reason, sale.total || 0);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error voiding sale:', error);
    return NextResponse.json(
      { error: 'Error al anular venta' },
      { status: 500 }
    );
  }
}
