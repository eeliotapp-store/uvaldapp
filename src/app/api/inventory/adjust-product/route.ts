import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';

// POST: Ajustar stock total de un producto
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { product_id, new_stock, reason } = await request.json();

    if (!product_id || new_stock === undefined || new_stock === null) {
      return NextResponse.json(
        { error: 'product_id y new_stock son requeridos' },
        { status: 400 }
      );
    }

    const newStockValue = parseInt(new_stock);
    if (isNaN(newStockValue) || newStockValue < 0) {
      return NextResponse.json(
        { error: 'new_stock debe ser un número válido >= 0' },
        { status: 400 }
      );
    }

    // Obtener el stock actual del producto
    const { data: stockData } = await supabaseAdmin
      .from('v_current_stock')
      .select('current_stock')
      .eq('product_id', product_id)
      .single();

    const currentStock = stockData?.current_stock || 0;
    const diff = newStockValue - currentStock;

    if (diff === 0) {
      return NextResponse.json({ success: true, message: 'Sin cambios' });
    }

    // Obtener la entrada de inventario más reciente para ajustar
    const { data: inventoryEntries, error: invError } = await supabaseAdmin
      .from('inventory')
      .select('id, quantity, supplier_id, purchase_price')
      .eq('product_id', product_id)
      .gt('quantity', 0)
      .order('created_at', { ascending: false });

    if (invError) {
      console.error('Error getting inventory:', invError);
      return NextResponse.json({ error: 'Error al obtener inventario' }, { status: 500 });
    }

    // Obtener el primer proveedor disponible si no hay entradas previas
    let defaultSupplierId = inventoryEntries?.[0]?.supplier_id;
    if (!defaultSupplierId) {
      const { data: suppliers } = await supabaseAdmin
        .from('suppliers')
        .select('id')
        .eq('active', true)
        .limit(1);
      defaultSupplierId = suppliers?.[0]?.id;
    }

    if (!defaultSupplierId && diff > 0) {
      return NextResponse.json(
        { error: 'Se necesita al menos un proveedor para agregar stock' },
        { status: 400 }
      );
    }

    if (diff > 0) {
      // Agregar stock - crear nueva entrada de inventario
      const lastEntry = inventoryEntries?.[0];

      const { error: insertError } = await supabaseAdmin
        .from('inventory')
        .insert({
          product_id,
          supplier_id: defaultSupplierId,
          quantity: diff,
          initial_quantity: diff,
          purchase_price: lastEntry?.purchase_price || 0,
          batch_date: new Date().toISOString().split('T')[0],
          created_by: payload.employee_id,
        });

      if (insertError) {
        console.error('Error inserting inventory:', insertError);
        return NextResponse.json({
          error: 'Error al agregar stock',
          details: insertError.message
        }, { status: 500 });
      }
    } else {
      // Reducir stock - ajustar las entradas existentes
      let remaining = Math.abs(diff);

      for (const entry of inventoryEntries || []) {
        if (remaining <= 0) break;

        const reduceBy = Math.min(entry.quantity, remaining);
        const newQuantity = entry.quantity - reduceBy;

        const { error: updateError } = await supabaseAdmin
          .from('inventory')
          .update({ quantity: newQuantity })
          .eq('id', entry.id);

        if (updateError) {
          console.error('Error updating inventory:', updateError);
          return NextResponse.json({
            error: 'Error al ajustar stock',
            details: updateError.message
          }, { status: 500 });
        }

        remaining -= reduceBy;
      }

      if (remaining > 0 && defaultSupplierId) {
        // No había suficiente stock en las entradas, crear entrada de ajuste
        const { error: insertError } = await supabaseAdmin
          .from('inventory')
          .insert({
            product_id,
            supplier_id: defaultSupplierId,
            quantity: 0,
            initial_quantity: -remaining,
            purchase_price: 0,
            batch_date: new Date().toISOString().split('T')[0],
            created_by: payload.employee_id,
          });

        if (insertError) {
          console.error('Error creating adjustment entry:', insertError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Stock ajustado de ${currentStock} a ${newStockValue}`,
      diff,
    });
  } catch (error) {
    console.error('Adjust product stock error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
