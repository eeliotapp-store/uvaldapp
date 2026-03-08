import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logSaleCreated, logSaleClosed } from '@/lib/audit';

interface SaleItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  is_michelada?: boolean;
}

interface ComboSale {
  combo_id: string;
  final_price: number;
  items: {
    product_id: string;
    quantity: number;
    is_michelada?: boolean;
  }[];
}

interface CreateSaleRequest {
  employee_id: string;
  shift_id: string;
  items: SaleItem[];
  combos?: ComboSale[];
  table_number?: string;
  close?: boolean;
  payment_method?: 'cash' | 'transfer' | 'mixed' | 'fiado';
  cash_received?: number;
  cash_change?: number;
  transfer_amount?: number;
  cash_amount?: number;
  // Campos para fiado
  fiado_customer_name?: string;
  fiado_amount?: number;
  fiado_abono?: number;
  // Observaciones
  notes?: string;
  close_notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateSaleRequest = await request.json();

    const {
      employee_id,
      shift_id,
      items = [],
      combos = [],
      table_number,
      close = false,
      payment_method,
      cash_received = 0,
      cash_change = 0,
      transfer_amount = 0,
      cash_amount = 0,
      fiado_customer_name,
      fiado_amount = 0,
      fiado_abono = 0,
      notes,
      close_notes,
    } = body;

    // Validaciones básicas
    if (!employee_id || !shift_id) {
      return NextResponse.json(
        { error: 'Datos incompletos' },
        { status: 400 }
      );
    }

    if (items.length === 0 && combos.length === 0) {
      return NextResponse.json(
        { error: 'Debe incluir al menos un producto o combo' },
        { status: 400 }
      );
    }

    // Si se cierra, necesita método de pago
    if (close && !payment_method) {
      return NextResponse.json(
        { error: 'Se requiere método de pago para cerrar la venta' },
        { status: 400 }
      );
    }

    // Calcular totales
    const itemsSubtotal = items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0
    );
    const combosSubtotal = combos.reduce(
      (sum, combo) => sum + combo.final_price,
      0
    );
    const subtotal = itemsSubtotal + combosSubtotal;
    const total = subtotal;

    // Validar pago si se cierra
    if (close) {
      if (payment_method === 'cash' && cash_received < total) {
        return NextResponse.json(
          { error: 'Efectivo insuficiente' },
          { status: 400 }
        );
      }
      if (payment_method === 'mixed') {
        const totalPaid = (transfer_amount || 0) + (cash_received || 0);
        if (totalPaid < total) {
          return NextResponse.json(
            { error: 'Pago insuficiente' },
            { status: 400 }
          );
        }
      }
      if (payment_method === 'fiado') {
        if (!fiado_customer_name || fiado_customer_name.trim() === '') {
          return NextResponse.json(
            { error: 'Se requiere el nombre del cliente para fiado' },
            { status: 400 }
          );
        }
      }
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

    // Preparar datos de la venta
    const saleData: Record<string, unknown> = {
      employee_id,
      shift_id,
      subtotal,
      total,
      table_number: table_number || null,
      status: close ? 'closed' : 'open',
      opened_by_employee_id: employee_id,
      closed_by_employee_id: close ? employee_id : null,
      notes: notes || null,
      close_notes: close ? (close_notes || null) : null,
    };

    // Si se cierra, agregar datos de pago
    if (close && payment_method) {
      saleData.payment_method = payment_method;

      if (payment_method === 'cash') {
        saleData.cash_received = cash_received;
        saleData.cash_change = cash_change;
        saleData.cash_amount = total;
        saleData.transfer_amount = 0;
      } else if (payment_method === 'transfer') {
        saleData.cash_received = null;
        saleData.cash_change = null;
        saleData.cash_amount = 0;
        saleData.transfer_amount = total;
      } else if (payment_method === 'mixed') {
        saleData.cash_received = cash_received;
        saleData.cash_change = cash_change;
        saleData.cash_amount = cash_amount;
        saleData.transfer_amount = transfer_amount;
      } else if (payment_method === 'fiado') {
        saleData.cash_received = null;
        saleData.cash_change = null;
        saleData.cash_amount = fiado_abono;
        saleData.transfer_amount = 0;
        saleData.fiado_customer_name = fiado_customer_name;
        saleData.fiado_amount = fiado_amount || (total - fiado_abono);
        saleData.fiado_abono = fiado_abono;
        saleData.fiado_paid = false;
      }
    }

    // Crear venta
    const { data: sale, error: saleError } = await supabaseAdmin
      .from('sales')
      .insert(saleData)
      .select()
      .single();

    if (saleError) {
      console.error('Error creating sale:', saleError);
      return NextResponse.json(
        { error: 'Error al crear la venta' },
        { status: 500 }
      );
    }

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
        sale_id: sale.id,
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
          sale_id: sale.id,
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

    // Crear items de venta (el trigger descuenta inventario)
    const { error: itemsError } = await supabaseAdmin
      .from('sale_items')
      .insert(saleItems);

    if (itemsError) {
      // Rollback: eliminar la venta
      await supabaseAdmin.from('sales').delete().eq('id', sale.id);

      console.error('Error creating sale items:', itemsError);
      return NextResponse.json(
        { error: itemsError.message || 'Error al registrar los productos' },
        { status: 500 }
      );
    }

    // Obtener nombres de productos para auditoría
    const productIds = [...items.map(i => i.product_id), ...combos.flatMap(c => c.items.map(i => i.product_id))];
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, name')
      .in('id', productIds);
    const productMap = new Map(products?.map(p => [p.id, p.name]) || []);

    // Registrar creación en auditoría
    const auditItems = [
      ...items.map(i => ({
        product_name: productMap.get(i.product_id) || 'Desconocido',
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
      ...combos.flatMap(c => c.items.map(i => ({
        product_name: productMap.get(i.product_id) || 'Desconocido',
        quantity: i.quantity,
        unit_price: c.final_price / c.items.reduce((sum, it) => sum + it.quantity, 0),
      }))),
    ];

    await logSaleCreated(sale.id, employee_id, { total, table_number, status: close ? 'closed' : 'open' }, auditItems);

    // Si se cerró inmediatamente, registrar también el cierre
    if (close && payment_method) {
      await logSaleClosed(sale.id, employee_id, total, payment_method);
    }

    return NextResponse.json({
      success: true,
      sale: {
        id: sale.id,
        total,
        status: close ? 'closed' : 'open',
        table_number,
        payment_method: close ? payment_method : null,
        cash_change: close ? cash_change : null,
      },
    });
  } catch (error) {
    console.error('Sale creation error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
