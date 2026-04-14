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
        opened_by:employees!sales_opened_by_employee_id_fkey (id, name),
        closed_by:employees!sales_closed_by_employee_id_fkey (id, name),
        taken_over_by:employees!sales_taken_over_by_employee_id_fkey (id, name),
        shifts (id, type),
        sale_items (
          id,
          quantity,
          unit_price,
          subtotal,
          is_michelada,
          combo_id,
          added_by_employee_id,
          products (id, name),
          combos (id, name)
        )
      `)
      .or('status.eq.closed,status.is.null')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Día hábil: 6am Colombia → 5:59am Colombia del día siguiente (igual que en reportes)
    const TZ = '-05:00';
    if (start_date) {
      query = query.gte('created_at', `${start_date}T06:00:00${TZ}`);
    }

    if (end_date) {
      const [ey, em, ed] = end_date.split('-').map(Number);
      const endNext = new Date(ey, em - 1, ed + 1);
      const endNextDate = `${endNext.getFullYear()}-${String(endNext.getMonth() + 1).padStart(2, '0')}-${String(endNext.getDate()).padStart(2, '0')}`;
      query = query.lte('created_at', `${endNextDate}T05:59:59${TZ}`);
    }

    if (employee_id) {
      query = query.eq('employee_id', employee_id);
    }

    if (payment_method) {
      query = query.eq('payment_method', payment_method);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Obtener IDs únicos de empleados que agregaron items
    const addedByIds = new Set<string>();
    data?.forEach((sale) => {
      sale.sale_items?.forEach((item: { added_by_employee_id?: string | null }) => {
        if (item.added_by_employee_id) {
          addedByIds.add(item.added_by_employee_id);
        }
      });
    });

    // Obtener nombres de empleados y cuentas abiertas en paralelo
    let employeeMap: Record<string, string> = {};
    const employeesPromise = addedByIds.size > 0
      ? supabaseAdmin.from('employees').select('id, name').in('id', Array.from(addedByIds))
      : Promise.resolve({ data: [] });

    const [employeesResult, openTabsResult] = await Promise.all([
      employeesPromise,
      supabaseAdmin.from('v_open_tabs').select('*'),
    ]);

    if (employeesResult.data) {
      employeeMap = Object.fromEntries(employeesResult.data.map((e: { id: string; name: string }) => [e.id, e.name]));
    }

    // Agregar added_by a cada item
    const salesWithAddedBy = data?.map((sale) => ({
      ...sale,
      sale_items: sale.sale_items?.map((item: { added_by_employee_id?: string | null }) => ({
        ...item,
        added_by: item.added_by_employee_id
          ? { id: item.added_by_employee_id, name: employeeMap[item.added_by_employee_id] || null }
          : null,
      })),
    }));

    // Calcular totales
    const totals = {
      total_sales: 0,
      cash_sales: 0,
      transfer_sales: 0,
      transactions: 0,
      voided_count: 0,
    };

    salesWithAddedBy?.forEach((sale) => {
      if (!sale.voided) {
        totals.total_sales += sale.total;
        totals.transactions++;
        if (sale.payment_method === 'cash') {
          totals.cash_sales += sale.cash_amount ?? sale.total;
        } else if (sale.payment_method === 'transfer') {
          totals.transfer_sales += sale.transfer_amount ?? sale.total;
        } else if (sale.payment_method === 'mixed') {
          // Para pago mixto, separar efectivo y transferencia
          totals.cash_sales += sale.cash_amount || 0;
          totals.transfer_sales += sale.transfer_amount || 0;
        }
      } else {
        totals.voided_count++;
      }
    });

    return NextResponse.json({ sales: salesWithAddedBy, totals, open_tabs: openTabsResult.data || [] });
  } catch (error) {
    console.error('Error fetching sales:', error);
    return NextResponse.json(
      { error: 'Error al obtener ventas' },
      { status: 500 }
    );
  }
}
