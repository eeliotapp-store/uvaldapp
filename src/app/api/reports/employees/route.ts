import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { buildEmployeeReport, type EmployeeShiftRow, type EmployeeSaleRow, type EmployeeSaleItemRow } from '@/lib/reports/employees';

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
    const shifts = await fetchAllRows<EmployeeShiftRow>((from, to) => {
      let q = supabaseAdmin
        .from('shifts')
        .select('id, type, start_time, employee_id, employees:employees!shifts_employee_id_fkey(id, name)')
        .gte('start_time', startOfRange)
        .lte('start_time', endOfRange)
        .order('start_time', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to);
      if (employeeId) q = q.eq('employee_id', employeeId);
      return q as unknown as PromiseLike<{ data: EmployeeShiftRow[] | null; error: { message: string } | null }>;
    });

    if (shifts.length === 0) {
      return NextResponse.json({ start_date: startDate, end_date: endDate, employees: [] });
    }

    const shiftIds = shifts.map((s) => s.id);

    // Supabase tiene límite de longitud de URL/headers para .in() — usar lotes de 200
    const BATCH = 200;

    // 2. Obtener ventas cerradas no anuladas de esos turnos
    const sales: EmployeeSaleRow[] = [];
    for (let i = 0; i < shiftIds.length; i += BATCH) {
      const idsBatch = shiftIds.slice(i, i + BATCH);
      const batchSales = await fetchAllRows<EmployeeSaleRow>((from, to) =>
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
    const saleIds = sales.map((s) => s.id);
    const saleItems: EmployeeSaleItemRow[] = [];

    for (let i = 0; i < saleIds.length; i += BATCH) {
      const idsBatch = saleIds.slice(i, i + BATCH);
      const batchItems = await fetchAllRows<EmployeeSaleItemRow>((from, to) =>
        supabaseAdmin
          .from('sale_items')
          .select('sale_id, quantity, unit_price, products(name)')
          .in('sale_id', idsBatch)
          .order('id', { ascending: true })
          .range(from, to) as unknown as PromiseLike<{ data: EmployeeSaleItemRow[] | null; error: { message: string } | null }>
      );
      saleItems.push(...batchItems);
    }

    const employees = buildEmployeeReport(shifts, sales, saleItems);

    return NextResponse.json({ start_date: startDate, end_date: endDate, employees });
  } catch (error) {
    console.error('Error en reporte de empleadas:', error);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
