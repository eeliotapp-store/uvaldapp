import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET: Obtener pagos de un fiado
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: payments, error } = await supabaseAdmin
      .from('fiado_payments')
      .select(`
        id,
        amount,
        payment_method,
        cash_amount,
        transfer_amount,
        created_at,
        employees:employee_id (name)
      `)
      .eq('sale_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const { data: sale } = await supabaseAdmin
      .from('sales')
      .select('fiado_amount, fiado_paid')
      .eq('id', id)
      .single();

    const total_paid = payments?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
    const remaining = Math.max(0, (sale?.fiado_amount ?? 0) - total_paid);

    return NextResponse.json({ payments: payments || [], total_paid, remaining });
  } catch (error) {
    console.error('Error fetching fiado payments:', error);
    return NextResponse.json({ error: 'Error al obtener pagos' }, { status: 500 });
  }
}

// POST: Registrar un pago/abono de fiado
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { amount, payment_method, cash_amount, transfer_amount, employee_id } =
      await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 });
    }
    if (!payment_method) {
      return NextResponse.json({ error: 'Método de pago requerido' }, { status: 400 });
    }

    // Verificar que la venta existe y es un fiado no anulado
    const { data: sale, error: saleError } = await supabaseAdmin
      .from('sales')
      .select('id, payment_method, voided, fiado_amount, fiado_paid')
      .eq('id', id)
      .single();

    if (saleError || !sale) {
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
    }
    if (sale.payment_method !== 'fiado') {
      return NextResponse.json({ error: 'Esta venta no es un fiado' }, { status: 400 });
    }
    if (sale.voided) {
      return NextResponse.json({ error: 'La venta está anulada' }, { status: 400 });
    }
    if (sale.fiado_paid) {
      return NextResponse.json({ error: 'Este fiado ya está completamente pagado' }, { status: 400 });
    }

    // Calcular monto ya pagado
    const { data: existingPayments } = await supabaseAdmin
      .from('fiado_payments')
      .select('amount')
      .eq('sale_id', id);

    const total_paid_before = existingPayments?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
    const remaining_before = (sale.fiado_amount ?? 0) - total_paid_before;

    if (amount > remaining_before + 0.01) {
      return NextResponse.json(
        { error: `El monto excede el saldo pendiente ($${remaining_before.toLocaleString()})` },
        { status: 400 }
      );
    }

    // Calcular cash/transfer según método
    const finalCash = payment_method === 'cash'
      ? amount
      : payment_method === 'mixed'
      ? (cash_amount || 0)
      : 0;

    const finalTransfer = payment_method === 'transfer'
      ? amount
      : payment_method === 'mixed'
      ? (transfer_amount || 0)
      : 0;

    // Registrar el pago
    const { error: insertError } = await supabaseAdmin
      .from('fiado_payments')
      .insert({
        sale_id: id,
        amount,
        payment_method,
        cash_amount: finalCash,
        transfer_amount: finalTransfer,
        employee_id: employee_id || null,
      });

    if (insertError) throw insertError;

    // Si el pago cubre el saldo, marcar fiado como pagado
    const total_paid_after = total_paid_before + amount;
    const remaining_after = Math.max(0, (sale.fiado_amount ?? 0) - total_paid_after);
    const is_fully_paid = remaining_after < 0.01;

    if (is_fully_paid) {
      await supabaseAdmin
        .from('sales')
        .update({ fiado_paid: true, fiado_paid_at: new Date().toISOString() })
        .eq('id', id);
    }

    return NextResponse.json({
      success: true,
      total_paid: total_paid_after,
      remaining: remaining_after,
      is_fully_paid,
    });
  } catch (error) {
    console.error('Error registering fiado payment:', error);
    return NextResponse.json({ error: 'Error al registrar el pago' }, { status: 500 });
  }
}
