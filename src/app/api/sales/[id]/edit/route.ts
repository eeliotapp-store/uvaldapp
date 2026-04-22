import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  logSaleItemUpdated,
  logSaleItemDeleted,
  logSaleItemsAdded,
} from '@/lib/audit';

interface EditSaleBody {
  employee_id: string;
  notes?: string | null;
  // Items a actualizar (cambiar cantidad o precio)
  update_items?: {
    id: string;
    quantity?: number;
    unit_price?: number;
  }[];
  // Items a eliminar
  delete_items?: string[];
  // Items a agregar
  add_items?: {
    product_id: string;
    quantity: number;
    unit_price: number;
    is_michelada?: boolean;
  }[];
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: saleId } = await context.params;
    const body: EditSaleBody = await request.json();
    const { employee_id, notes, update_items, delete_items, add_items } = body;

    if (!employee_id) {
      return NextResponse.json({ error: 'employee_id requerido' }, { status: 400 });
    }

    // Verificar que la venta existe y está abierta
    const { data: sale, error: saleError } = await supabaseAdmin
      .from('sales')
      .select('*, sale_items(*, products(name))')
      .eq('id', saleId)
      .single();

    if (saleError || !sale) {
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
    }

    if (sale.status === 'closed') {
      return NextResponse.json({ error: 'No se puede editar una venta cerrada' }, { status: 400 });
    }

    if (sale.voided) {
      return NextResponse.json({ error: 'No se puede editar una venta anulada' }, { status: 400 });
    }

    // 1. Actualizar items existentes
    if (update_items && update_items.length > 0) {
      for (const item of update_items) {
        // Obtener valores actuales
        const currentItem = sale.sale_items.find((si: { id: string }) => si.id === item.id);
        if (!currentItem) continue;

        const newQuantity = item.quantity ?? currentItem.quantity;
        const newUnitPrice = item.unit_price ?? currentItem.unit_price;
        const newSubtotal = newQuantity * newUnitPrice;

        // Si cambia la cantidad, manejar inventario
        if (item.quantity !== undefined && item.quantity !== currentItem.quantity) {
          const diff = currentItem.quantity - item.quantity;

          if (diff > 0) {
            // Devolver al inventario
            await supabaseAdmin.rpc('restore_inventory', {
              p_product_id: currentItem.product_id,
              p_quantity: diff,
            });
          } else if (diff < 0) {
            // Verificar stock y descontar
            const { data: stock } = await supabaseAdmin
              .from('v_current_stock')
              .select('current_stock')
              .eq('product_id', currentItem.product_id)
              .single();

            if (!stock || stock.current_stock < Math.abs(diff)) {
              return NextResponse.json({
                error: `Stock insuficiente para ${currentItem.products.name}`,
              }, { status: 400 });
            }
          }
        }

        // Actualizar el item (incluyendo quién lo modificó)
        const { error: updateError } = await supabaseAdmin
          .from('sale_items')
          .update({
            quantity: newQuantity,
            unit_price: newUnitPrice,
            subtotal: newSubtotal,
            modified_by_employee_id: employee_id,
            modified_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        if (updateError) {
          console.error('Error updating sale item:', updateError);
          continue;
        }

        // Registrar en auditoría
        await logSaleItemUpdated(
          item.id,
          saleId,
          employee_id,
          {
            quantity: currentItem.quantity,
            unit_price: currentItem.unit_price,
            product_name: currentItem.products.name,
          },
          {
            quantity: newQuantity,
            unit_price: newUnitPrice,
          }
        );
      }
    }

    // 2. Eliminar items
    if (delete_items && delete_items.length > 0) {
      for (const itemId of delete_items) {
        const currentItem = sale.sale_items.find((si: { id: string }) => si.id === itemId);
        if (!currentItem) continue;

        // El trigger restaurará el inventario automáticamente
        const { error: deleteError } = await supabaseAdmin
          .from('sale_items')
          .delete()
          .eq('id', itemId);

        if (deleteError) {
          console.error('Error deleting sale item:', deleteError);
          continue;
        }

        // Registrar en auditoría
        await logSaleItemDeleted(
          itemId,
          saleId,
          employee_id,
          {
            product_name: currentItem.products.name,
            quantity: currentItem.quantity,
            unit_price: currentItem.unit_price,
          }
        );
      }
    }

    // 3. Agregar nuevos items
    if (add_items && add_items.length > 0) {
      const newItems = add_items.map(item => ({
        sale_id: saleId,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.quantity * item.unit_price,
        is_michelada: item.is_michelada || false,
        added_by_employee_id: employee_id,
      }));

      const { error: insertError } = await supabaseAdmin
        .from('sale_items')
        .insert(newItems);

      if (insertError) {
        console.error('Error adding sale items:', insertError);
        return NextResponse.json({ error: 'Error al agregar items' }, { status: 500 });
      }

      // Obtener nombres de productos para auditoría
      const productIds = add_items.map(i => i.product_id);
      const { data: products } = await supabaseAdmin
        .from('products')
        .select('id, name')
        .in('id', productIds);

      const productMap = new Map(products?.map(p => [p.id, p.name]) || []);

      await logSaleItemsAdded(
        saleId,
        employee_id,
        add_items.map(item => ({
          product_name: productMap.get(item.product_id) || 'Desconocido',
          quantity: item.quantity,
          unit_price: item.unit_price,
        }))
      );
    }

    // 4. Recalcular total de la venta
    const { data: updatedItems } = await supabaseAdmin
      .from('sale_items')
      .select('subtotal')
      .eq('sale_id', saleId);

    const newTotal = updatedItems?.reduce((sum, item) => sum + item.subtotal, 0) || 0;

    const saleUpdate: Record<string, unknown> = { total: newTotal, subtotal: newTotal };
    if (notes !== undefined) saleUpdate.notes = notes;

    await supabaseAdmin
      .from('sales')
      .update(saleUpdate)
      .eq('id', saleId);

    // 5. Obtener venta actualizada
    const { data: finalSale } = await supabaseAdmin
      .from('sales')
      .select(`
        *,
        sale_items (
          *,
          products (id, name, sale_price)
        )
      `)
      .eq('id', saleId)
      .single();

    return NextResponse.json({
      success: true,
      sale: finalSale,
    });
  } catch (error) {
    console.error('Edit sale error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
