import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// Supabase/PostgREST tiene un límite por defecto de filas por respuesta (1000) que trunca
// silenciosamente sin lanzar error — hay que paginar la SALIDA con .range(), no solo trocear
// la lista de IDs de entrada para no exceder el límite de longitud de URL.
async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

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
    type ShiftRow = { id: string; type: 'day' | 'night'; start_time: string; employee_id: string; employees: { id: string; name: string } | { id: string; name: string }[] | null };
    const shifts = await fetchAllRows<ShiftRow>((from, to) => {
      let q = supabaseAdmin
        .from('shifts')
        .select('id, type, start_time, employee_id, employees:employees!shifts_employee_id_fkey(id, name)')
        .gte('start_time', startOfRange)
        .lte('start_time', endOfRange)
        .order('start_time', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to);
      if (employeeId) q = q.eq('employee_id', employeeId);
      return q as unknown as PromiseLike<{ data: ShiftRow[] | null; error: { message: string } | null }>;
    });

    if (shifts.length === 0) {
      return NextResponse.json({ start_date: startDate, end_date: endDate, employees: [] });
    }

    const shiftIds = shifts.map((s) => s.id);

    // Supabase tiene límite de longitud de URL/headers para .in() — usar lotes de 200
    const BATCH = 200;

    // 2. Obtener ventas cerradas no anuladas de esos turnos
    type SaleRow = { id: string; total: number; payment_method: string | null; cash_amount: number | null; transfer_amount: number | null; shift_id: string };
    const sales: SaleRow[] = [];
    for (let i = 0; i < shiftIds.length; i += BATCH) {
      const idsBatch = shiftIds.slice(i, i + BATCH);
      const batchSales = await fetchAllRows<SaleRow>((from, to) =>
        supabaseAdmin
          .from('sales')
          .select('id, total, payment_method, cash_amount, transfer_amount, shift_id')
          .in('shift_id', idsBatch)
          .eq('voided', false)
          .eq('status', 'closed')
          .order('id', { ascending: true })
          .range(from, to)
      );
      sales.push(...batchSales);
    }

    // 3. Obtener sale_items de esas ventas
    type SaleItemRow = { sale_id: string; quantity: number; unit_price: number; products: { name: string } | { name: string }[] | null };
    const saleIds = sales.map((s) => s.id);
    const saleItems: SaleItemRow[] = [];

    for (let i = 0; i < saleIds.length; i += BATCH) {
      const idsBatch = saleIds.slice(i, i + BATCH);
      const batchItems = await fetchAllRows<SaleItemRow>((from, to) =>
        supabaseAdmin
          .from('sale_items')
          .select('sale_id, quantity, unit_price, products(name)')
          .in('sale_id', idsBatch)
          .order('id', { ascending: true })
          .range(from, to) as unknown as PromiseLike<{ data: SaleItemRow[] | null; error: { message: string } | null }>
      );
      saleItems.push(...batchItems);
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
          products: { product_name: string; quantity: number; total: number }[];
        }[];
        products: Map<string, { product_name: string; quantity: number; total: number }>;
      }
    >();

    for (const shift of shifts) {
      const empId = shift.employee_id;
      const emp_data = Array.isArray(shift.employees) ? shift.employees[0] : shift.employees;
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
      const shiftSales = sales.filter((s) => s.shift_id === shift.id);

      const shiftTotal = shiftSales.reduce((sum, s) => sum + (s.total || 0), 0);
      const shiftCash = shiftSales.reduce((sum, s) => sum + (s.cash_amount || 0), 0);
      const shiftTransfer = shiftSales.reduce((sum, s) => sum + (s.transfer_amount || 0), 0);

      emp.shifts_count++;
      emp.total_sales += shiftTotal;
      emp.cash_sales += shiftCash;
      emp.transfer_sales += shiftTransfer;
      emp.transactions_count += shiftSales.length;

      // Productos por turno y por empleada
      const shiftProducts = new Map<string, { product_name: string; quantity: number; total: number }>();
      for (const sale of shiftSales) {
        const items = saleItems.filter((i) => i.sale_id === sale.id);
        for (const item of items) {
          const productInfo = Array.isArray(item.products) ? item.products[0] : item.products;
          const productName = productInfo?.name || 'Producto sin nombre';
          const itemTotal = item.quantity * (item.unit_price || 0);

          if (!emp.products.has(productName)) {
            emp.products.set(productName, { product_name: productName, quantity: 0, total: 0 });
          }
          const empProd = emp.products.get(productName)!;
          empProd.quantity += item.quantity;
          empProd.total += itemTotal;

          if (!shiftProducts.has(productName)) {
            shiftProducts.set(productName, { product_name: productName, quantity: 0, total: 0 });
          }
          const shiftProd = shiftProducts.get(productName)!;
          shiftProd.quantity += item.quantity;
          shiftProd.total += itemTotal;
        }
      }

      emp.shifts.push({
        shift_id: shift.id,
        date: shift.start_time.split('T')[0],
        type: shift.type,
        total: shiftTotal,
        cash: shiftCash,
        transfer: shiftTransfer,
        transactions: shiftSales.length,
        products: [...shiftProducts.values()].sort((a, b) => b.quantity - a.quantity),
      });
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
        total_units: [...emp.products.values()].reduce((sum, p) => sum + p.quantity, 0),
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
