import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

interface AddItemsRequest {
  employee_id: string;
  notes?: string | null;
  items: {
    product_id: string;
    quantity: number;
    unit_price: number;
    is_michelada?: boolean;
  }[];
  combos?: {
    combo_id: string;
    final_price: number;
    items: {
      product_id: string;
      quantity: number;
      is_michelada?: boolean;
    }[];
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
    const { employee_id, notes, items = [], combos = [] } = body;

    if (!employee_id) {
      return NextResponse.json(
        { error: 'Se requiere el ID del empleado' },
        { status: 400 }
      );
    }

    if (items.length === 0 && combos.length === 0) {
      return NextResponse.json(
        { error: 'No hay productos o combos para agregar' },
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

    // Recopilar todos los productos que necesitan validación de stock
    const allProductsToValidate: { product_id: string; quantity: number }[] = [];

    // Items individuales
    for (const item of items) {
      allProductsToValidate.push({
        product_id: item.product_id,
        quantity: item.quantity,
      });
    }

    // Items de combos
    for (const combo of combos) {
      for (const item of combo.items) {
        allProductsToValidate.push({
          product_id: item.product_id,
          quantity: item.quantity,
        });
      }
    }

    // Agrupar cantidades por producto
    const productQuantities: Record<string, number> = {};
    for (const item of allProductsToValidate) {
      productQuantities[item.product_id] = (productQuantities[item.product_id] || 0) + item.quantity;
    }

    // Verificar stock disponible
    for (const [productId, requiredQty] of Object.entries(productQuantities)) {
      const { data: stockData, error: stockError } = await supabaseAdmin
        .from('v_current_stock')
        .select('current_stock, product_name')
        .eq('product_id', productId)
        .single();

      if (stockError || !stockData) {
        return NextResponse.json(
          { error: `Producto no encontrado` },
          { status: 400 }
        );
      }

      if (stockData.current_stock < requiredQty) {
        return NextResponse.json(
          { error: `Stock insuficiente para ${stockData.product_name}` },
          { status: 400 }
        );
      }
    }

    // Calcular nuevo total
    const itemsTotal = items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0
    );
    const combosTotal = combos.reduce(
      (sum, combo) => sum + combo.final_price,
      0
    );
    const newTotal = (sale.total || 0) + itemsTotal + combosTotal;

    // Preparar todos los sale_items
    const saleItems: {
      sale_id: string;
      product_id: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
      is_michelada: boolean;
      combo_id: string | null;
      combo_price_override: number | null;
      added_by_employee_id: string;
    }[] = [];

    // Items individuales
    for (const item of items) {
      saleItems.push({
        sale_id: id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.unit_price * item.quantity,
        is_michelada: item.is_michelada || false,
        combo_id: null,
        combo_price_override: null,
        added_by_employee_id: employee_id,
      });
    }

    // Items de combos
    for (const combo of combos) {
      // Calcular el precio por unidad del combo para el tracking
      const totalComboItems = combo.items.reduce((sum, i) => sum + i.quantity, 0);
      const pricePerComboItem = totalComboItems > 0 ? combo.final_price / totalComboItems : 0;

      // Marcar el primer item del combo con el precio override
      let isFirstComboItem = true;

      for (const item of combo.items) {
        saleItems.push({
          sale_id: id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: pricePerComboItem,
          subtotal: pricePerComboItem * item.quantity,
          is_michelada: item.is_michelada || false,
          combo_id: combo.combo_id,
          combo_price_override: isFirstComboItem ? combo.final_price : null,
          added_by_employee_id: employee_id,
        });
        isFirstComboItem = false;
      }
    }

    if (saleItems.length === 0) {
      return NextResponse.json(
        { error: 'No hay items para agregar' },
        { status: 400 }
      );
    }

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

    // Actualizar total y notes de la venta
    const saleUpdate: Record<string, unknown> = { total: newTotal, subtotal: newTotal };
    if (notes !== undefined) saleUpdate.notes = notes;

    const { error: updateError } = await supabaseAdmin
      .from('sales')
      .update(saleUpdate)
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
