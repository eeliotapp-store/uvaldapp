import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

interface SaleItem {
  product_id: string;
  quantity: number;
  unit_price: number;
}

interface CreateSaleRequest {
  employee_id: string;
  shift_id: string;
  items: SaleItem[];
  table_number?: string;
  // Si close=true, se cierra inmediatamente con pago
  // Si close=false o no se envía, queda como cuenta abierta
  close?: boolean;
  payment_method?: 'cash' | 'transfer' | 'mixed';
  cash_received?: number;
  cash_change?: number;
  transfer_amount?: number;
  cash_amount?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateSaleRequest = await request.json();

    const {
      employee_id,
      shift_id,
      items,
      table_number,
      close = false,
      payment_method,
      cash_received = 0,
      cash_change = 0,
      transfer_amount = 0,
      cash_amount = 0,
    } = body;

    // Validaciones básicas
    if (!employee_id || !shift_id || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Datos incompletos' },
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
    const subtotal = items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0
    );
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
          { error: `Stock insuficiente para el producto` },
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

    // Crear items de venta (el trigger descuenta inventario)
    const saleItems = items.map((item) => ({
      sale_id: sale.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.unit_price * item.quantity,
    }));

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
