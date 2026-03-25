import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: sale, error: fetchError } = await supabaseAdmin
      .from('sales')
      .select('id, fiado_paid, payment_method')
      .eq('id', id)
      .single();

    if (fetchError || !sale) {
      return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 });
    }

    if (sale.payment_method !== 'fiado') {
      return NextResponse.json({ error: 'Esta venta no es un fiado' }, { status: 400 });
    }

    if (sale.fiado_paid) {
      return NextResponse.json({ error: 'Este fiado ya fue pagado' }, { status: 400 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('sales')
      .update({
        fiado_paid: true,
        fiado_paid_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking fiado as paid:', error);
    return NextResponse.json({ error: 'Error al registrar pago' }, { status: 500 });
  }
}
