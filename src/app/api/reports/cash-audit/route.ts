import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET: Auditoría de caja - historial de turnos con discrepancias
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');
    const employee_id = searchParams.get('employee_id');

    // Por defecto, últimos 7 días
    const endDate = end_date || new Date().toISOString().split('T')[0];
    const startDate = start_date || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Obtener todos los turnos en el rango
    let query = supabaseAdmin
      .from('shifts')
      .select(`
        id,
        employee_id,
        type,
        start_time,
        end_time,
        cash_start,
        cash_end,
        notes,
        is_active,
        employees (id, name)
      `)
      .gte('start_time', `${startDate}T00:00:00`)
      .lte('start_time', `${endDate}T23:59:59`)
      .order('start_time', { ascending: true });

    if (employee_id) {
      query = query.eq('employee_id', employee_id);
    }

    const { data: shifts, error } = await query;

    if (error) throw error;

    // Obtener resúmenes de ventas para cada turno
    const shiftIds = shifts?.map(s => s.id) || [];
    let summaries: Record<string, { cash_sales: number; transfer_sales: number; total_sales: number }> = {};

    if (shiftIds.length > 0) {
      const { data: summaryData } = await supabaseAdmin
        .from('v_shift_summary')
        .select('shift_id, cash_sales, transfer_sales, total_sales, mixed_cash, total_change')
        .in('shift_id', shiftIds);

      if (summaryData) {
        summaries = Object.fromEntries(
          summaryData.map(s => [
            s.shift_id,
            {
              cash_sales: (s.cash_sales || 0) + (s.mixed_cash || 0) - (s.total_change || 0),
              transfer_sales: s.transfer_sales || 0,
              total_sales: s.total_sales || 0,
            }
          ])
        );
      }
    }

    // Procesar turnos y detectar discrepancias
    interface CashAuditEntry {
      shift_id: string;
      employee_id: string;
      employee_name: string;
      type: string;
      start_time: string;
      end_time: string | null;
      cash_start: number;
      cash_end: number | null;
      cash_sales: number;
      expected_cash: number;
      difference: number | null;
      notes: string | null;
      is_active: boolean;
      // Comparación con turno anterior
      previous_shift_end: number | null;
      gap_with_previous: number | null;
      has_discrepancy: boolean;
    }

    const auditEntries: CashAuditEntry[] = [];
    let previousShiftEnd: number | null = null;

    shifts?.forEach((shift) => {
      const summary = summaries[shift.id] || { cash_sales: 0, transfer_sales: 0, total_sales: 0 };
      const expectedCash = shift.cash_start + summary.cash_sales;
      const difference = shift.cash_end !== null ? shift.cash_end - expectedCash : null;

      // Detectar discrepancia con turno anterior
      const gapWithPrevious = previousShiftEnd !== null ? shift.cash_start - previousShiftEnd : null;
      const hasDiscrepancy = gapWithPrevious !== null && gapWithPrevious !== 0;

      const getEmployeeName = () => {
        for (const emp of shift.employees) {
          if (emp.id === shift.employee_id) return emp.name;
        }
        return 'Unknown';
      };

      auditEntries.push({
        shift_id: shift.id,
        employee_id: shift.employee_id,
        employee_name: getEmployeeName(),
        type: shift.type,
        start_time: shift.start_time,
        end_time: shift.end_time,
        cash_start: shift.cash_start,
        cash_end: shift.cash_end,
        cash_sales: summary.cash_sales,
        expected_cash: expectedCash,
        difference,
        notes: shift.notes,
        is_active: shift.is_active,
        previous_shift_end: previousShiftEnd,
        gap_with_previous: gapWithPrevious,
        has_discrepancy: hasDiscrepancy,
      });

      // Actualizar para el siguiente turno
      if (shift.cash_end !== null) {
        previousShiftEnd = shift.cash_end;
      }
    });

    // Calcular estadísticas
    const stats = {
      total_shifts: auditEntries.length,
      shifts_with_discrepancy: auditEntries.filter(e => e.has_discrepancy).length,
      total_gap: auditEntries
        .filter(e => e.gap_with_previous !== null && e.gap_with_previous < 0)
        .reduce((sum, e) => sum + Math.abs(e.gap_with_previous || 0), 0),
      shifts_missing_cash: auditEntries.filter(e => e.difference !== null && e.difference < 0).length,
      shifts_extra_cash: auditEntries.filter(e => e.difference !== null && e.difference > 0).length,
    };

    // Agrupar por empleado
    const byEmployee: Record<string, {
      employee_id: string;
      employee_name: string;
      shifts: CashAuditEntry[];
      total_discrepancies: number;
      total_missing: number;
    }> = {};

    auditEntries.forEach(entry => {
      if (!byEmployee[entry.employee_id]) {
        byEmployee[entry.employee_id] = {
          employee_id: entry.employee_id,
          employee_name: entry.employee_name,
          shifts: [],
          total_discrepancies: 0,
          total_missing: 0,
        };
      }
      byEmployee[entry.employee_id].shifts.push(entry);
      if (entry.has_discrepancy && entry.gap_with_previous && entry.gap_with_previous < 0) {
        byEmployee[entry.employee_id].total_discrepancies++;
        byEmployee[entry.employee_id].total_missing += Math.abs(entry.gap_with_previous);
      }
    });

    return NextResponse.json({
      start_date: startDate,
      end_date: endDate,
      entries: auditEntries,
      by_employee: Object.values(byEmployee),
      stats,
    });
  } catch (error) {
    console.error('Cash audit error:', error);
    return NextResponse.json(
      { error: 'Error al generar auditoría de caja' },
      { status: 500 }
    );
  }
}
