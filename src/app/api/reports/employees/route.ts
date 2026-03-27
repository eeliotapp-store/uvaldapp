import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const employeeId = searchParams.get('employee_id');

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: 'start_date y end_date son requeridos' },
      { status: 400 }
    );
  }

  const startOfRange = `${startDate}T00:00:00`;
  const endOfRange = `${endDate}T23:59:59`;

  try {
    // 1. Obtener turnos en el rango
    let shiftsQuery = supabaseAdmin
      .from('shifts')
      .select('id, type, start_time, employee_id, employees:employees!shifts_employee_id_fkey(id, name)')
      .gte('start_time', startOfRange)
      .lte('start_time', endOfRange)
      .order('start_time', { ascending: true });

    if (employeeId) {
      shiftsQuery = shiftsQuery.eq('employee_id', employeeId);
    }

    const { data: shifts, error: shiftsError } = await shiftsQuery;
    if (shiftsError) throw shiftsError;
    if (!shifts || shifts.length === 0) {
      return NextResponse.json({ start_date: startDate, end_date: endDate, employees: [] });
    }

    const shiftIds = shifts.map((s) => s.id);

    // 2. Obtener ventas cerradas no anuladas de esos turnos
    const { data: sales, error: salesError } = await supabaseAdmin
      .from('sales')
      .select('id, total, payment_method, cash_amount, transfer_amount, shift_id')
      .in('shift_id', shiftIds)
      .eq('voided', false)
      .eq('status', 'closed');

    if (salesError) throw salesError;

    // 3. Obtener sale_items de esas ventas
    const saleIds = (sales || []).map((s) => s.id);
    let saleItems: { sale_id: string; quantity: number; unit_price: number; products: { name: string } | null }[] = [];

    if (saleIds.length > 0) {
      const { data: items, error: itemsError } = await supabaseAdmin
        .from('sale_items')
        .select('sale_id, quantity, unit_price, products(name)')
        .in('sale_id', saleIds);

      if (itemsError) throw itemsError;
      saleItems = (items || []) as unknown as typeof saleItems;
    }

    // 4. Agrupar por empleada
    const employeeMap = new Map<
      string,
      {
        employee_id: string;
        employee_name: string;
        shifts_count: number;
        total_sales: number;
        cash_sales: number;
        transfer_sales: number;
        transactions_count: number;
        shifts: {
          shift_id: string;
          date: string;
          type: string;
          total: number;
          cash: number;
          transfer: number;
          transactions: number;
        }[];
        products: Map<string, { product_name: string; quantity: number; total: number }>;
      }
    >();

    for (const shift of shifts) {
      const empId = shift.employee_id;
      const emp_data = shift.employees as unknown as { id: string; name: string } | null;
      const empName = emp_data?.name || 'Sin nombre';

      if (!employeeMap.has(empId)) {
        employeeMap.set(empId, {
          employee_id: empId,
          employee_name: empName,
          shifts_count: 0,
          total_sales: 0,
          cash_sales: 0,
          transfer_sales: 0,
          transactions_count: 0,
          shifts: [],
          products: new Map(),
        });
      }

      const emp = employeeMap.get(empId)!;
      const shiftSales = (sales || []).filter((s) => s.shift_id === shift.id);

      const shiftTotal = shiftSales.reduce((sum, s) => sum + (s.total || 0), 0);
      const shiftCash = shiftSales.reduce((sum, s) => sum + (s.cash_amount || 0), 0);
      const shiftTransfer = shiftSales.reduce((sum, s) => sum + (s.transfer_amount || 0), 0);

      emp.shifts_count++;
      emp.total_sales += shiftTotal;
      emp.cash_sales += shiftCash;
      emp.transfer_sales += shiftTransfer;
      emp.transactions_count += shiftSales.length;

      emp.shifts.push({
        shift_id: shift.id,
        date: shift.start_time.split('T')[0],
        type: shift.type,
        total: shiftTotal,
        cash: shiftCash,
        transfer: shiftTransfer,
        transactions: shiftSales.length,
      });

      // Productos por empleada
      for (const sale of shiftSales) {
        const items = saleItems.filter((i) => i.sale_id === sale.id);
        for (const item of items) {
          const productName = item.products?.name || 'Producto sin nombre';
          if (!emp.products.has(productName)) {
            emp.products.set(productName, { product_name: productName, quantity: 0, total: 0 });
          }
          const prod = emp.products.get(productName)!;
          prod.quantity += item.quantity;
          prod.total += item.quantity * (item.unit_price || 0);
        }
      }
    }

    // 5. Serializar y ordenar
    const employees = [...employeeMap.values()]
      .map((emp) => ({
        employee_id: emp.employee_id,
        employee_name: emp.employee_name,
        shifts_count: emp.shifts_count,
        total_sales: emp.total_sales,
        cash_sales: emp.cash_sales,
        transfer_sales: emp.transfer_sales,
        transactions_count: emp.transactions_count,
        shifts: emp.shifts,
        products: [...emp.products.values()].sort((a, b) => b.total - a.total),
      }))
      .sort((a, b) => b.total_sales - a.total_sales);

    return NextResponse.json({ start_date: startDate, end_date: endDate, employees });
  } catch (error) {
    console.error('Error en reporte de empleadas:', error);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
