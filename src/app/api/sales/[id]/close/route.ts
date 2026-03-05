import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logSaleClosed } from '@/lib/audit';

interface CloseTabRequest {
  employee_id: string;
  payment_method: 'cash' | 'transfer' | 'mixed' | 'fiado';
  cash_received?: number;
  cash_change?: number;
  transfer_amount?: number;
  cash_amount?: number;
  // Campos para fiado
  fiado_customer_name?: string;
  fiado_amount?: number;
  fiado_abono?: number;
}

// POST: Cerrar una cuenta abierta (procesar pago)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: CloseTabRequest = await request.json();
    const {
      employee_id,
      payment_method,
      cash_received = 0,
      cash_change = 0,
      transfer_amount = 0,
      cash_amount = 0,
      fiado_customer_name,
      fiado_amount = 0,
      fiado_abono = 0,
    } = body;

    if (!payment_method || !employee_id) {
      return NextResponse.json(
        { error: 'Se requiere método de pago y empleado' },
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

    const total = sale.total || 0;

    // Validar pago
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

    // Preparar datos de actualización
    const updateData: Record<string, unknown> = {
      status: 'closed',
      payment_method,
      closed_by_employee_id: employee_id,
    };

    if (payment_method === 'cash') {
      updateData.cash_received = cash_received;
      updateData.cash_change = cash_change;
      updateData.cash_amount = total;
      updateData.transfer_amount = 0;
    } else if (payment_method === 'transfer') {
      updateData.cash_received = null;
      updateData.cash_change = null;
      updateData.cash_amount = 0;
      updateData.transfer_amount = total;
    } else if (payment_method === 'mixed') {
      updateData.cash_received = cash_received;
      updateData.cash_change = cash_change;
      updateData.cash_amount = cash_amount;
      updateData.transfer_amount = transfer_amount;
    } else if (payment_method === 'fiado') {
      updateData.cash_received = null;
      updateData.cash_change = null;
      updateData.cash_amount = fiado_abono;
      updateData.transfer_amount = 0;
      updateData.fiado_customer_name = fiado_customer_name;
      updateData.fiado_amount = fiado_amount || (total - fiado_abono);
      updateData.fiado_abono = fiado_abono;
      updateData.fiado_paid = false;
    }

    // Actualizar la venta
    const { error: updateError } = await supabaseAdmin
      .from('sales')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('Error closing tab:', updateError);
      return NextResponse.json(
        { error: 'Error al cerrar la cuenta' },
        { status: 500 }
      );
    }

    // Registrar en auditoría
    await logSaleClosed(id, employee_id, total, payment_method);

    return NextResponse.json({
      success: true,
      sale: {
        id,
        total,
        payment_method,
        cash_change: payment_method === 'transfer' ? 0 : cash_change,
      },
    });
  } catch (error) {
    console.error('Close tab error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
