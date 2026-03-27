import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

interface PartialPaymentItem {
  sale_item_id: string;
  quantity: number;
  amount: number;
}

interface CreatePartialPaymentRequest {
  employee_id: string;
  amount: number;
  payment_method: 'cash' | 'transfer' | 'mixed';
  cash_amount?: number;
  transfer_amount?: number;
  items: PartialPaymentItem[];
  notes?: string;
}

// GET: Obtener pagos parciales de una venta
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Obtener la venta para verificar que existe
    const { data: sale, error: saleError } = await supabaseAdmin
      .from('sales')
      .select('id, total')
      .eq('id', id)
      .single();

    if (saleError || !sale) {
      return NextResponse.json(
        { error: 'Venta no encontrada' },
        { status: 404 }
      );
    }

    // Obtener pagos parciales con sus items
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from('partial_payments')
      .select(`
        id,
        amount,
        payment_method,
        cash_amount,
        transfer_amount,
        employee_id,
        notes,
        created_at,
        employees!inner(name)
      `)
      .eq('sale_id', id)
      .order('created_at', { ascending: true });

    if (paymentsError) {
      console.error('Error fetching partial payments:', paymentsError);
      return NextResponse.json(
        { error: 'Error al obtener pagos parciales' },
        { status: 500 }
      );
    }

    // Obtener items de cada pago
    const paymentsWithItems = await Promise.all(
      (payments || []).map(async (payment) => {
        const { data: items } = await supabaseAdmin
          .from('partial_payment_items')
          .select(`
            id,
            sale_item_id,
            quantity,
            amount,
            sale_items!inner(
              product_id,
              products!inner(name)
            )
          `)
          .eq('partial_payment_id', payment.id);

        const employee = payment.employees as unknown as { name: string };

        return {
          id: payment.id,
          amount: payment.amount,
          payment_method: payment.payment_method,
          cash_amount: payment.cash_amount,
          transfer_amount: payment.transfer_amount,
          employee_name: employee?.name || 'Desconocido',
          notes: payment.notes,
          created_at: payment.created_at,
          items: (items || []).map((item) => {
            const saleItem = item.sale_items as unknown as {
              product_id: string;
              products: { name: string };
            };
            return {
              id: item.id,
              sale_item_id: item.sale_item_id,
              product_name: saleItem?.products?.name || 'Producto desconocido',
              quantity: item.quantity,
              amount: item.amount,
            };
          }),
        };
      })
    );

    // Calcular totales
    const totalPaid = paymentsWithItems.reduce((sum, p) => sum + p.amount, 0);
    const remaining = sale.total - totalPaid;

    return NextResponse.json({
      payments: paymentsWithItems,
      total_paid: totalPaid,
      remaining: remaining,
    });
  } catch (error) {
    console.error('Error in partial payments GET:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST: Crear un pago parcial
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: CreatePartialPaymentRequest = await request.json();

    const {
      employee_id,
      amount,
      payment_method,
      cash_amount = 0,
      transfer_amount = 0,
      items,
      notes,
    } = body;

    // Validaciones
    if (!employee_id || !amount || !payment_method) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: employee_id, amount, payment_method' },
        { status: 400 }
      );
    }

    // Verificar que la venta existe y está abierta
    const { data: sale, error: saleError } = await supabaseAdmin
      .from('sales')
      .select('id, total, status')
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
        { error: 'Solo se pueden hacer pagos parciales en cuentas abiertas' },
        { status: 400 }
      );
    }

    // Verificar que el monto no exceda lo que queda por pagar
    const { data: existingPayments } = await supabaseAdmin
      .from('partial_payments')
      .select('amount')
      .eq('sale_id', id);

    const totalPaid = (existingPayments || []).reduce((sum, p) => sum + p.amount, 0);
    const remaining = sale.total - totalPaid;

    if (amount > remaining) {
      return NextResponse.json(
        { error: `El monto excede lo que resta por pagar ($${remaining.toLocaleString()})` },
        { status: 400 }
      );
    }

    // Validar método de pago
    if (payment_method === 'mixed' && cash_amount + transfer_amount !== amount) {
      return NextResponse.json(
        { error: 'En pago mixto, efectivo + transferencia debe ser igual al monto total' },
        { status: 400 }
      );
    }

    // Crear el pago parcial
    const { data: partialPayment, error: createError } = await supabaseAdmin
      .from('partial_payments')
      .insert({
        sale_id: id,
        amount,
        payment_method,
        cash_amount: payment_method === 'cash' ? amount : (payment_method === 'mixed' ? cash_amount : 0),
        transfer_amount: payment_method === 'transfer' ? amount : (payment_method === 'mixed' ? transfer_amount : 0),
        employee_id,
        notes,
      })
      .select()
      .single();

    if (createError || !partialPayment) {
      console.error('Error creating partial payment:', createError);
      return NextResponse.json(
        { error: 'Error al crear el pago parcial' },
        { status: 500 }
      );
    }

    // Crear los items del pago parcial (solo si se especificaron productos)
    if (items && items.length > 0) {
      const paymentItems = items.map((item) => ({
        partial_payment_id: partialPayment.id,
        sale_item_id: item.sale_item_id,
        quantity: item.quantity,
        amount: item.amount,
      }));

      const { error: itemsError } = await supabaseAdmin
        .from('partial_payment_items')
        .insert(paymentItems);

      if (itemsError) {
        console.error('Error creating partial payment items:', itemsError);
        await supabaseAdmin.from('partial_payments').delete().eq('id', partialPayment.id);
        return NextResponse.json(
          { error: 'Error al guardar los items del pago' },
          { status: 500 }
        );
      }
    }

    // Calcular nuevo restante
    const newTotalPaid = totalPaid + amount;
    const newRemaining = sale.total - newTotalPaid;

    return NextResponse.json({
      success: true,
      payment: partialPayment,
      total_paid: newTotalPaid,
      remaining: newRemaining,
      message: `Pago parcial de $${amount.toLocaleString()} registrado correctamente`,
    });
  } catch (error) {
    console.error('Error in partial payments POST:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
