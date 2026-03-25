import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending'; // pending | paid | all
    const customer_name = searchParams.get('customer_name');

    let query = supabaseAdmin
      .from('sales')
      .select(`
        id,
        fiado_customer_name,
        fiado_amount,
        fiado_abono,
        fiado_paid,
        fiado_paid_at,
        total,
        created_at,
        table_number,
        employees:employees!sales_employee_id_fkey (id, name)
      `)
      .eq('payment_method', 'fiado')
      .eq('voided', false)
      .order('created_at', { ascending: false });

    if (status === 'pending') {
      query = query.eq('fiado_paid', false);
    } else if (status === 'paid') {
      query = query.eq('fiado_paid', true);
    }

    if (customer_name) {
      query = query.ilike('fiado_customer_name', `%${customer_name}%`);
    }

    const { data: fiados, error } = await query;
    if (error) throw error;

    // Resumen general (sin filtros) para los contadores del encabezado
    const { data: allFiados } = await supabaseAdmin
      .from('sales')
      .select('fiado_amount, fiado_paid')
      .eq('payment_method', 'fiado')
      .eq('voided', false);

    const summary = { total_pending: 0, total_paid: 0, count_pending: 0, count_paid: 0 };
    allFiados?.forEach(f => {
      if (f.fiado_paid) {
        summary.count_paid++;
        summary.total_paid += f.fiado_amount || 0;
      } else {
        summary.count_pending++;
        summary.total_pending += f.fiado_amount || 0;
      }
    });

    return NextResponse.json({ fiados: fiados || [], summary });
  } catch (error) {
    console.error('Error fetching fiados:', error);
    return NextResponse.json({ error: 'Error al obtener fiados' }, { status: 500 });
  }
}
