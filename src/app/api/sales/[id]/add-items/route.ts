import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

interface AddItemsRequest {
  items: {
    product_id: string;
    quantity: number;
    unit_price: number;
  }[];
}

// POST: Agregar items a una cuenta abierta
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: AddItemsRequest = await request.json();
    const { items } = body;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'No hay productos para agregar' },
        { status: 400 }
      );
    }

    // Verificar que la venta existe y está abierta
    const { data: sale, error: saleError } = await supabaseAdmin
      .from('sales')
      .select('id, status, total')
      .eq('id', id)
      .single();

    if (saleError || !sale) {
      return NextResponse.json(
        { error: 'Venta no encontrada' },
        { status: 404 }
      );
    }

    if (sale.status !== 'open') {
      return NextResponse.json(
        { error: 'Esta cuenta ya está cerrada' },
        { status: 400 }
      );
    }

    // Verificar stock disponible
    for (const item of items) {
      const { data: stockData, error: stockError } = await supabaseAdmin
        .from('v_current_stock')
        .select('current_stock')
        .eq('product_id', item.product_id)
        .single();

      if (stockError || !stockData) {
        return NextResponse.json(
          { error: `Producto no encontrado: ${item.product_id}` },
          { status: 400 }
        );
      }

      if (stockData.current_stock < item.quantity) {
        return NextResponse.json(
          { error: 'Stock insuficiente para el producto' },
          { status: 400 }
        );
      }
    }

    // Calcular nuevo total
    const newItemsTotal = items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0
    );
    const newTotal = (sale.total || 0) + newItemsTotal;

    // Insertar nuevos items
    const saleItems = items.map((item) => ({
      sale_id: id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.unit_price * item.quantity,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('sale_items')
      .insert(saleItems);

    if (itemsError) {
      console.error('Error adding items:', itemsError);
      return NextResponse.json(
        { error: 'Error al agregar productos' },
        { status: 500 }
      );
    }

    // Actualizar total de la venta
    const { error: updateError } = await supabaseAdmin
      .from('sales')
      .update({
        total: newTotal,
        subtotal: newTotal
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating sale total:', updateError);
      return NextResponse.json(
        { error: 'Error al actualizar el total' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sale: {
        id,
        total: newTotal,
      },
    });
  } catch (error) {
    console.error('Add items error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
