import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET: Historial de ventas
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');
    const employee_id = searchParams.get('employee_id');
    const payment_method = searchParams.get('payment_method');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Solo mostrar ventas cerradas (las abiertas se muestran en open-tabs)
    // Incluir ventas donde status = 'closed' o status es null (ventas antiguas)
    // Especificar la relación explícita con employees debido a múltiples FKs
    let query = supabaseAdmin
      .from('sales')
      .select(`
        *,
        employees:employees!sales_employee_id_fkey (id, name),
        shifts (id, type),
        sale_items (
          id,
          quantity,
          unit_price,
          subtotal,
          products (id, name)
        )
      `)
      .or('status.eq.closed,status.is.null')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (start_date) {
      query = query.gte('created_at', `${start_date}T00:00:00`);
    }

    if (end_date) {
      query = query.lte('created_at', `${end_date}T23:59:59`);
    }

    if (employee_id) {
      query = query.eq('employee_id', employee_id);
    }

    if (payment_method) {
      query = query.eq('payment_method', payment_method);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Calcular totales
    const totals = {
      total_sales: 0,
      cash_sales: 0,
      transfer_sales: 0,
      transactions: 0,
      voided_count: 0,
    };

    data?.forEach((sale) => {
      if (!sale.voided) {
        totals.total_sales += sale.total;
        totals.transactions++;
        if (sale.payment_method === 'cash') {
          totals.cash_sales += sale.total;
        } else if (sale.payment_method === 'transfer') {
          totals.transfer_sales += sale.total;
        } else if (sale.payment_method === 'mixed') {
          // Para pago mixto, separar efectivo y transferencia
          totals.cash_sales += sale.cash_amount || 0;
          totals.transfer_sales += sale.transfer_amount || 0;
        }
      } else {
        totals.voided_count++;
      }
    });

    return NextResponse.json({ sales: data, totals });
  } catch (error) {
    console.error('Error fetching sales:', error);
    return NextResponse.json(
      { error: 'Error al obtener ventas' },
      { status: 500 }
    );
  }
}
