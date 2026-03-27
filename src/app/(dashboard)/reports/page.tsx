'use client';

import { useEffect, useState } from 'react';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore, isOwner } from '@/stores/auth-store';
import Link from 'next/link';

interface Observation {
  id: string;
  content: string;
  created_at: string;
  employee_name: string;
  shift_type?: string;
}

interface ShiftReport {
  id: string;
  type: 'day' | 'night';
  employee_name: string;
  start_time: string;
  end_time: string | null;
  cash_start: number;
  cash_end: number | null;
  notes: string | null;
  is_active: boolean;
  summary: {
    total_sales: number;
    cash_sales: number;
    transfer_sales: number;
    transactions_count: number;
  } | null;
  sales_count: number;
  total: number;
  observations?: Observation[];
}

interface ProductSummary {
  product_id: string;
  product_name: string;
  quantity: number;
  total: number;
}

interface EmployeeProductSummary {
  employee_id: string;
  employee_name: string;
  products: ProductSummary[];
  total: number;
}

interface ShiftTypeSummary {
  total: number;
  employees: EmployeeProductSummary[];
  products: ProductSummary[];
}

interface DailyReport {
  date: string;
  shifts: ShiftReport[];
  day_totals: {
    total_sales: number;
    cash_sales: number;
    transfer_sales: number;
    transactions: number;
    voided_count: number;
    fiado_total: number;
    fiado_abonos: number;
  };
  products: ProductSummary[];
  by_shift_type: {
    day: ShiftTypeSummary;
    night: ShiftTypeSummary;
  };
  observations?: Observation[];
}

interface SingleShiftReport {
  shift: {
    id: string;
    type: 'day' | 'night';
    employee_name: string;
    start_time: string;
    end_time: string | null;
    cash_start: number;
    cash_end: number | null;
    notes: string | null;
    is_active: boolean;
  };
  summary: {
    total_sales: number;
    cash_sales: number;
    transfer_sales: number;
    transactions_count: number;
  };
  products: ProductSummary[];
  payment_totals: {
    cash: number;
    transfer: number;
    mixed_cash: number;
    mixed_transfer: number;
    fiado: number;
    fiado_abonos: number;
  };
  observations?: Observation[];
}

interface RangeReport {
  start_date: string;
  end_date: string;
  totals: {
    total_sales: number;
    cash_sales: number;
    transfer_sales: number;
    transactions: number;
    voided_count: number;
    shifts_count: number;
    fiado_total: number;
    fiado_abonos: number;
  };
  products: ProductSummary[];
  by_employee: EmployeeProductSummary[];
  daily_breakdown: {
    date: string;
    total: number;
    transactions: number;
    cash: number;
    transfer: number;
  }[];
  observations?: Observation[];
}

interface RankingProduct {
  rank: number;
  product_id: string;
  product_name: string;
  category: string | null;
  quantity: number;
  total: number;
}

interface RankingReport {
  period: string;
  start_date: string;
  end_date: string;
  ranking: RankingProduct[];
  summary: {
    total_products: number;
    total_quantity: number;
    total_revenue: number;
  };
  by_category: {
    category: string;
    quantity: number;
    total: number;
    products: number;
  }[];
}

interface InventoryCount {
  id: string;
  product_id: string;
  shift_id: string | null;
  employee_id: string;
  system_stock: number;
  real_stock: number;
  difference: number;
  notes: string | null;
  created_at: string;
  products: { id: string; name: string };
  employees: { id: string; name: string };
  shifts: { id: string; type: string; start_time: string } | null;
}

interface InventoryCountReport {
  counts: InventoryCount[];
  summary: {
    total_counts: number;
    counts_with_difference: number;
    total_positive_diff: number;
    total_negative_diff: number;
    products_counted: number;
    employees_involved: number;
  };
  by_product: {
    product_id: string;
    product_name: string;
    count_times: number;
    total_positive_diff: number;
    total_negative_diff: number;
  }[];
  start_date: string | null;
  end_date: string | null;
}

interface EmployeeShiftEntry {
  shift_id: string;
  date: string;
  type: 'day' | 'night';
  total: number;
  cash: number;
  transfer: number;
  transactions: number;
}

interface EmployeeSummary {
  employee_id: string;
  employee_name: string;
  shifts_count: number;
  total_sales: number;
  cash_sales: number;
  transfer_sales: number;
  transactions_count: number;
  shifts: EmployeeShiftEntry[];
  products: ProductSummary[];
}

interface EmployeeReport {
  start_date: string;
  end_date: string;
  employees: EmployeeSummary[];
}

type ReportType = 'daily' | 'shift' | 'range' | 'ranking' | 'inventory' | 'employee';

export default function ReportsPage() {
  const employee = useAuthStore((state) => state.employee);
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [shiftReport, setShiftReport] = useState<SingleShiftReport | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [rangeReport, setRangeReport] = useState<RangeReport | null>(null);
  const [rankingReport, setRankingReport] = useState<RankingReport | null>(null);
  const [inventoryReport, setInventoryReport] = useState<InventoryCountReport | null>(null);
  const [employeeReport, setEmployeeReport] = useState<EmployeeReport | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [rankingPeriod, setRankingPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('week');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const canView = employee && isOwner(employee.role);

  const fetchDailyReport = async (date: string) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/reports/shifts?date=${date}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al cargar reporte');
      }

      setDailyReport(data);
      setShiftReport(null);
      setSelectedShiftId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar reporte');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchShiftReport = async (shiftId: string) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/reports/shifts?shift_id=${shiftId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al cargar reporte');
      }

      setShiftReport(data);
      setSelectedShiftId(shiftId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar reporte');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRangeReport = async (start: string, end: string) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/reports/shifts?start_date=${start}&end_date=${end}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al cargar reporte');
      }

      setRangeReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar reporte');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRankingReport = async (period: string) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/reports/ranking?period=${period}&limit=20`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al cargar ranking');
      }

      setRankingReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar ranking');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmployeeReport = async (start: string, end: string) => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/reports/employees?start_date=${start}&end_date=${end}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar reporte');
      setEmployeeReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar reporte');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInventoryReport = async (start: string, end: string) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/reports/inventory-counts?start_date=${start}&end_date=${end}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al cargar reporte de conteos');
      }

      setInventoryReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar reporte de conteos');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) return;
    if (reportType === 'daily' || reportType === 'shift') {
      fetchDailyReport(selectedDate);
    } else if (reportType === 'ranking') {
      fetchRankingReport(rankingPeriod);
    }
  }, [selectedDate, reportType, rankingPeriod, canView]);

  // Solo owners y superadmin pueden ver reportes
  if (!canView) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500">No tienes permisos para ver reportes</p>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  // Función para descargar CSV
  const downloadCSV = (filename: string, csvContent: string) => {
    const BOM = '\uFEFF'; // Para que Excel/Sheets reconozca UTF-8
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Exportar reporte diario a CSV
  const exportDailyReportCSV = () => {
    if (!dailyReport) return;

    const lines: string[] = [];
    const date = formatDate(dailyReport.date + 'T12:00:00');

    // Encabezado
    lines.push(`REPORTE DEL DÍA - ${date}`);
    lines.push('');

    // Resumen del día
    lines.push('RESUMEN DEL DÍA');
    lines.push('Concepto,Valor');
    lines.push(`Total Ventas,${dailyReport.day_totals.total_sales}`);
    lines.push(`Efectivo,${dailyReport.day_totals.cash_sales}`);
    lines.push(`Transferencias,${dailyReport.day_totals.transfer_sales}`);
    lines.push(`Transacciones,${dailyReport.day_totals.transactions}`);
    if (dailyReport.day_totals.fiado_total > 0) {
      lines.push(`Fiados,${dailyReport.day_totals.fiado_total}`);
    }
    lines.push('');

    // Turno Día
    if (dailyReport.by_shift_type?.day?.employees?.length > 0) {
      lines.push('TURNO DÍA');
      lines.push(`Total Turno Día,${dailyReport.by_shift_type.day.total}`);
      lines.push('');

      dailyReport.by_shift_type.day.employees.forEach(emp => {
        lines.push(`Empleada: ${emp.employee_name}`);
        lines.push('Producto,Unidades,Total');
        emp.products.forEach(p => {
          lines.push(`${p.product_name},${p.quantity},${p.total}`);
        });
        lines.push(`SUBTOTAL ${emp.employee_name},,${emp.total}`);
        lines.push('');
      });
    }

    // Turno Noche
    if (dailyReport.by_shift_type?.night?.employees?.length > 0) {
      lines.push('TURNO NOCHE');
      lines.push(`Total Turno Noche,${dailyReport.by_shift_type.night.total}`);
      lines.push('');

      dailyReport.by_shift_type.night.employees.forEach(emp => {
        lines.push(`Empleada: ${emp.employee_name}`);
        lines.push('Producto,Unidades,Total');
        emp.products.forEach(p => {
          lines.push(`${p.product_name},${p.quantity},${p.total}`);
        });
        lines.push(`SUBTOTAL ${emp.employee_name},,${emp.total}`);
        lines.push('');
      });
    }

    // Resumen total de productos
    lines.push('RESUMEN TOTAL DE PRODUCTOS');
    lines.push('Producto,Unidades,Total');
    dailyReport.products.forEach(p => {
      lines.push(`${p.product_name},${p.quantity},${p.total}`);
    });
    lines.push(`TOTAL,,${dailyReport.products.reduce((sum, p) => sum + p.total, 0)}`);

    const csvContent = lines.join('\n');
    const filename = `reporte_${dailyReport.date}.csv`;
    downloadCSV(filename, csvContent);
  };

  // Exportar reporte por turno a CSV
  const exportShiftReportCSV = () => {
    if (!shiftReport) return;

    const lines: string[] = [];
    const { shift, summary, products } = shiftReport;
    const shiftType = shift.type === 'day' ? 'Día' : 'Noche';
    const date = formatDate(shift.start_time);

    // Encabezado
    lines.push(`REPORTE DE TURNO ${shiftType.toUpperCase()} - ${date}`);
    lines.push(`Empleado: ${shift.employee_name}`);
    lines.push('');

    // Resumen
    lines.push('RESUMEN DE VENTAS');
    lines.push('Concepto,Valor');
    lines.push(`Total Ventas,${summary.total_sales}`);
    lines.push(`Efectivo,${summary.cash_sales}`);
    lines.push(`Transferencias,${summary.transfer_sales}`);
    lines.push(`Transacciones,${summary.transactions_count}`);
    lines.push('');

    // Caja
    lines.push('ESTADO DE CAJA');
    lines.push(`Caja Inicial,${shift.cash_start}`);
    lines.push(`Ventas Efectivo,${summary.cash_sales}`);
    lines.push(`Caja Esperada,${shift.cash_start + summary.cash_sales}`);
    if (shift.cash_end !== null) {
      lines.push(`Caja Final,${shift.cash_end}`);
      lines.push(`Diferencia,${shift.cash_end - shift.cash_start - summary.cash_sales}`);
    }
    lines.push('');

    // Observaciones
    if (shift.notes) {
      lines.push('OBSERVACIONES');
      lines.push(`"${shift.notes.replace(/"/g, '""')}"`);
      lines.push('');
    }

    // Productos
    lines.push('PRODUCTOS VENDIDOS');
    lines.push('Producto,Unidades,Total');
    products.forEach(p => {
      lines.push(`${p.product_name},${p.quantity},${p.total}`);
    });
    lines.push(`TOTAL,,${products.reduce((sum, p) => sum + p.total, 0)}`);

    const csvContent = lines.join('\n');
    const filename = `reporte_turno_${shift.type}_${date.replace(/\//g, '-')}.csv`;
    downloadCSV(filename, csvContent);
  };

  // Exportar reporte de rango de fechas a CSV
  const exportRangeReportCSV = () => {
    if (!rangeReport) return;

    const lines: string[] = [];

    // Encabezado
    lines.push(`REPORTE DE VENTAS - ${rangeReport.start_date} a ${rangeReport.end_date}`);
    lines.push('');

    // Resumen
    lines.push('RESUMEN DEL PERIODO');
    lines.push('Concepto,Valor');
    lines.push(`Total Ventas,${rangeReport.totals.total_sales}`);
    lines.push(`Efectivo,${rangeReport.totals.cash_sales}`);
    lines.push(`Transferencias,${rangeReport.totals.transfer_sales}`);
    lines.push(`Transacciones,${rangeReport.totals.transactions}`);
    lines.push(`Turnos,${rangeReport.totals.shifts_count}`);
    if (rangeReport.totals.fiado_total > 0) {
      lines.push(`Fiados,${rangeReport.totals.fiado_total}`);
    }
    lines.push('');

    // Desglose por día
    lines.push('VENTAS POR DÍA');
    lines.push('Fecha,Total,Transacciones,Efectivo,Transferencias');
    rangeReport.daily_breakdown.forEach(day => {
      lines.push(`${day.date},${day.total},${day.transactions},${day.cash},${day.transfer}`);
    });
    lines.push('');

    // Por empleada
    if (rangeReport.by_employee.length > 0) {
      lines.push('VENTAS POR EMPLEADA');
      rangeReport.by_employee.forEach(emp => {
        lines.push(`${emp.employee_name},${emp.total}`);
      });
      lines.push('');
    }

    // Productos
    lines.push('PRODUCTOS VENDIDOS');
    lines.push('Producto,Unidades,Total');
    rangeReport.products.forEach(p => {
      lines.push(`${p.product_name},${p.quantity},${p.total}`);
    });
    lines.push(`TOTAL,,${rangeReport.products.reduce((sum, p) => sum + p.total, 0)}`);

    const csvContent = lines.join('\n');
    const filename = `reporte_${rangeReport.start_date}_a_${rangeReport.end_date}.csv`;
    downloadCSV(filename, csvContent);
  };

  // Exportar ranking a CSV
  const exportRankingCSV = () => {
    if (!rankingReport) return;

    const lines: string[] = [];
    const periodName = {
      day: 'Hoy',
      week: 'Última semana',
      month: 'Último mes',
      year: 'Último año',
      all: 'Todo el tiempo',
      custom: 'Personalizado',
    }[rankingReport.period] || rankingReport.period;

    // Encabezado
    lines.push(`RANKING DE PRODUCTOS MÁS VENDIDOS - ${periodName}`);
    lines.push(`Período: ${rankingReport.start_date} a ${rankingReport.end_date}`);
    lines.push('');

    // Resumen
    lines.push('RESUMEN');
    lines.push(`Total Productos Diferentes,${rankingReport.summary.total_products}`);
    lines.push(`Total Unidades Vendidas,${rankingReport.summary.total_quantity}`);
    lines.push(`Total Ingresos,${rankingReport.summary.total_revenue}`);
    lines.push('');

    // Ranking
    lines.push('RANKING');
    lines.push('Posición,Producto,Categoría,Unidades,Total');
    rankingReport.ranking.forEach(p => {
      lines.push(`${p.rank},${p.product_name},${p.category || 'Sin categoría'},${p.quantity},${p.total}`);
    });
    lines.push('');

    // Por categoría
    lines.push('VENTAS POR CATEGORÍA');
    lines.push('Categoría,Unidades,Total,Productos');
    rankingReport.by_category.forEach(c => {
      lines.push(`${c.category},${c.quantity},${c.total},${c.products}`);
    });

    const csvContent = lines.join('\n');
    const filename = `ranking_${rankingReport.period}_${rankingReport.end_date}.csv`;
    downloadCSV(filename, csvContent);
  };

  // Exportar reporte por empleada a CSV
  const exportEmployeeReportCSV = () => {
    if (!employeeReport) return;

    const lines: string[] = [];
    lines.push(`REPORTE POR EMPLEADA - ${employeeReport.start_date} a ${employeeReport.end_date}`);
    lines.push('');

    employeeReport.employees.forEach((emp) => {
      lines.push(`EMPLEADA: ${emp.employee_name}`);
      lines.push('Concepto,Valor');
      lines.push(`Turnos trabajados,${emp.shifts_count}`);
      lines.push(`Total ventas,${emp.total_sales}`);
      lines.push(`Efectivo,${emp.cash_sales}`);
      lines.push(`Transferencias,${emp.transfer_sales}`);
      lines.push(`Transacciones,${emp.transactions_count}`);
      lines.push('');

      lines.push('TURNOS');
      lines.push('Fecha,Turno,Efectivo,Transferencias,Total,Transacciones');
      emp.shifts.forEach((s) => {
        lines.push(`${s.date},${s.type === 'day' ? 'Día' : 'Noche'},${s.cash},${s.transfer},${s.total},${s.transactions}`);
      });
      lines.push('');

      if (emp.products.length > 0) {
        lines.push('PRODUCTOS VENDIDOS');
        lines.push('Producto,Unidades,Total');
        emp.products.forEach((p) => {
          lines.push(`${p.product_name},${p.quantity},${p.total}`);
        });
      }

      lines.push('');
      lines.push('---');
      lines.push('');
    });

    downloadCSV(
      `reporte_empleadas_${employeeReport.start_date}_a_${employeeReport.end_date}.csv`,
      lines.join('\n')
    );
  };

  // Exportar historial de conteos a CSV
  const exportInventoryCountsCSV = () => {
    if (!inventoryReport) return;

    const lines: string[] = [];

    // Encabezado
    lines.push('HISTORIAL DE CONTEOS DE INVENTARIO');
    if (inventoryReport.start_date && inventoryReport.end_date) {
      lines.push(`Período: ${inventoryReport.start_date} a ${inventoryReport.end_date}`);
    }
    lines.push('');

    // Resumen
    lines.push('RESUMEN');
    lines.push(`Total Conteos,${inventoryReport.summary.total_counts}`);
    lines.push(`Conteos con Diferencia,${inventoryReport.summary.counts_with_difference}`);
    lines.push(`Productos Contados,${inventoryReport.summary.products_counted}`);
    lines.push(`Sobrantes Totales,+${inventoryReport.summary.total_positive_diff}`);
    lines.push(`Faltantes Totales,-${inventoryReport.summary.total_negative_diff}`);
    lines.push('');

    // Por producto
    lines.push('DIFERENCIAS POR PRODUCTO');
    lines.push('Producto,Conteos,Sobrantes,Faltantes');
    inventoryReport.by_product.forEach(p => {
      lines.push(`${p.product_name},${p.count_times},+${p.total_positive_diff},-${p.total_negative_diff}`);
    });
    lines.push('');

    // Historial detallado
    lines.push('HISTORIAL DETALLADO');
    lines.push('Fecha,Hora,Producto,Empleada,Turno,Stock Sistema,Stock Real,Diferencia,Notas');
    inventoryReport.counts.forEach(c => {
      const date = new Date(c.created_at);
      const dateStr = date.toISOString().split('T')[0];
      const timeStr = date.toTimeString().substring(0, 5);
      const shiftType = c.shifts?.type === 'day' ? 'Día' : c.shifts?.type === 'night' ? 'Noche' : '-';
      const notes = c.notes ? `"${c.notes.replace(/"/g, '""')}"` : '';
      lines.push(`${dateStr},${timeStr},${c.products?.name || '-'},${c.employees?.name || '-'},${shiftType},${c.system_stock},${c.real_stock},${c.difference},${notes}`);
    });

    const csvContent = lines.join('\n');
    const filename = `conteos_inventario_${inventoryReport.start_date || 'todos'}_a_${inventoryReport.end_date || 'todos'}.csv`;
    downloadCSV(filename, csvContent);
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Link a auditoría de caja */}
      <div className="mb-4 print:hidden">
        <Link
          href="/reports/cash-audit"
          className="inline-flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 rounded-lg transition-colors"
        >
          <CashIcon className="w-5 h-5" />
          <span>Auditoría de Caja</span>
          <span className="text-xs bg-red-200 px-2 py-0.5 rounded">Control de efectivo</span>
        </Link>
      </div>

      <div className="flex justify-between items-center mb-6 print:hidden">
        <h1 className="text-2xl font-bold">Reportes</h1>
        <div className="flex gap-2">
          {reportType === 'daily' && dailyReport && (
            <Button onClick={exportDailyReportCSV} variant="outline" className="flex items-center gap-1">
              <DownloadIcon className="w-4 h-4" />
              CSV
            </Button>
          )}
          {reportType === 'shift' && shiftReport && (
            <Button onClick={exportShiftReportCSV} variant="outline" className="flex items-center gap-1">
              <DownloadIcon className="w-4 h-4" />
              CSV
            </Button>
          )}
          {reportType === 'range' && rangeReport && (
            <Button onClick={exportRangeReportCSV} variant="outline" className="flex items-center gap-1">
              <DownloadIcon className="w-4 h-4" />
              CSV
            </Button>
          )}
          {reportType === 'ranking' && rankingReport && (
            <Button onClick={exportRankingCSV} variant="outline" className="flex items-center gap-1">
              <DownloadIcon className="w-4 h-4" />
              CSV
            </Button>
          )}
          {reportType === 'inventory' && inventoryReport && (
            <Button onClick={exportInventoryCountsCSV} variant="outline" className="flex items-center gap-1">
              <DownloadIcon className="w-4 h-4" />
              CSV
            </Button>
          )}
          {reportType === 'employee' && employeeReport && (
            <Button onClick={exportEmployeeReportCSV} variant="outline" className="flex items-center gap-1">
              <DownloadIcon className="w-4 h-4" />
              CSV
            </Button>
          )}
          <Button onClick={handlePrint} variant="outline">
            Imprimir
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6 print:hidden">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Reporte
            </label>
            <select
              value={reportType}
              onChange={(e) => {
                setReportType(e.target.value as ReportType);
                setShiftReport(null);
                setSelectedShiftId(null);
                setRangeReport(null);
                setRankingReport(null);
                setInventoryReport(null);
                setEmployeeReport(null);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="daily">Reporte del Día</option>
              <option value="shift">Reporte por Turno</option>
              <option value="range">Rango de Fechas</option>
              <option value="ranking">Ranking de Productos</option>
              <option value="inventory">Historial de Conteos</option>
              <option value="employee">Reporte por Empleada</option>
            </select>
          </div>

          {(reportType === 'daily' || reportType === 'shift') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

          {reportType === 'shift' && dailyReport && dailyReport.shifts.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Turno
              </label>
              <select
                value={selectedShiftId || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    fetchShiftReport(e.target.value);
                  }
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Seleccionar turno...</option>
                {dailyReport.shifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.type === 'day' ? 'Día' : 'Noche'} - {shift.employee_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {reportType === 'range' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Inicio
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Fin
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <Button onClick={() => fetchRangeReport(startDate, endDate)}>
                Generar Reporte
              </Button>
            </>
          )}

          {reportType === 'ranking' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Período
              </label>
              <select
                value={rankingPeriod}
                onChange={(e) => setRankingPeriod(e.target.value as typeof rankingPeriod)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="day">Hoy</option>
                <option value="week">Última Semana</option>
                <option value="month">Último Mes</option>
                <option value="year">Último Año</option>
                <option value="all">Todo el Tiempo</option>
              </select>
            </div>
          )}

          {reportType === 'inventory' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Inicio
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Fin
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <Button onClick={() => fetchInventoryReport(startDate, endDate)}>
                Generar Reporte
              </Button>
            </>
          )}

          {reportType === 'employee' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Inicio
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Fin
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <Button onClick={() => fetchEmployeeReport(startDate, endDate)}>
                Generar Reporte
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-4">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2 text-gray-500">Cargando reporte...</p>
        </div>
      ) : (
        <>
          {/* Reporte del Día */}
          {reportType === 'daily' && dailyReport && (
            <DailyReportView report={dailyReport} onSelectShift={fetchShiftReport} />
          )}

          {/* Reporte por Turno */}
          {reportType === 'shift' && shiftReport && (
            <ShiftReportView report={shiftReport} />
          )}

          {reportType === 'shift' && !shiftReport && dailyReport && dailyReport.shifts.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <p className="text-gray-500">No hay turnos registrados para esta fecha</p>
            </div>
          )}

          {reportType === 'shift' && !shiftReport && dailyReport && dailyReport.shifts.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <p className="text-gray-500">Selecciona un turno para ver el reporte</p>
            </div>
          )}

          {/* Reporte de Rango de Fechas */}
          {reportType === 'range' && rangeReport && (
            <RangeReportView report={rangeReport} />
          )}

          {reportType === 'range' && !rangeReport && (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <p className="text-gray-500">Selecciona un rango de fechas y haz clic en &quot;Generar Reporte&quot;</p>
            </div>
          )}

          {/* Ranking de Productos */}
          {reportType === 'ranking' && rankingReport && (
            <RankingReportView report={rankingReport} />
          )}

          {/* Historial de Conteos de Inventario */}
          {reportType === 'inventory' && inventoryReport && (
            <InventoryCountReportView report={inventoryReport} />
          )}

          {reportType === 'inventory' && !inventoryReport && (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <p className="text-gray-500">Selecciona un rango de fechas y haz clic en &quot;Generar Reporte&quot;</p>
            </div>
          )}

          {/* Reporte por Empleada */}
          {reportType === 'employee' && employeeReport && (
            <EmployeeReportView report={employeeReport} />
          )}

          {reportType === 'employee' && !employeeReport && (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <p className="text-gray-500">Selecciona un rango de fechas y haz clic en &quot;Generar Reporte&quot;</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmployeeReportView({ report }: { report: EmployeeReport }) {
  if (report.employees.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 text-center">
        <p className="text-gray-500">No hay turnos registrados en este período</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="bg-white rounded-xl shadow-sm p-6 print:shadow-none print:border">
        <h2 className="text-xl font-bold mb-1">Reporte por Empleada</h2>
        <p className="text-gray-500 text-sm">
          {formatDate(report.start_date + 'T12:00:00')} — {formatDate(report.end_date + 'T12:00:00')}
          {' · '}{report.employees.length} empleada{report.employees.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Resumen general */}
      <div className="bg-white rounded-xl shadow-sm p-6 print:shadow-none print:border">
        <h3 className="font-semibold text-gray-700 mb-3">Resumen comparativo</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 font-medium text-gray-600">Empleada</th>
                <th className="text-right py-2 font-medium text-gray-600">Turnos</th>
                <th className="text-right py-2 font-medium text-gray-600">Transacciones</th>
                <th className="text-right py-2 font-medium text-gray-600">Efectivo</th>
                <th className="text-right py-2 font-medium text-gray-600">Transferencias</th>
                <th className="text-right py-2 font-medium text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {report.employees.map((emp) => (
                <tr key={emp.employee_id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 font-medium text-gray-900">{emp.employee_name}</td>
                  <td className="py-2 text-right text-gray-600">{emp.shifts_count}</td>
                  <td className="py-2 text-right text-gray-600">{emp.transactions_count}</td>
                  <td className="py-2 text-right text-gray-600">{formatCurrency(emp.cash_sales)}</td>
                  <td className="py-2 text-right text-gray-600">{formatCurrency(emp.transfer_sales)}</td>
                  <td className="py-2 text-right font-bold text-gray-900">{formatCurrency(emp.total_sales)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50">
                <td className="py-2 font-bold text-gray-900">TOTAL</td>
                <td className="py-2 text-right font-bold">{report.employees.reduce((s, e) => s + e.shifts_count, 0)}</td>
                <td className="py-2 text-right font-bold">{report.employees.reduce((s, e) => s + e.transactions_count, 0)}</td>
                <td className="py-2 text-right font-bold">{formatCurrency(report.employees.reduce((s, e) => s + e.cash_sales, 0))}</td>
                <td className="py-2 text-right font-bold">{formatCurrency(report.employees.reduce((s, e) => s + e.transfer_sales, 0))}</td>
                <td className="py-2 text-right font-bold text-green-700">{formatCurrency(report.employees.reduce((s, e) => s + e.total_sales, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Detalle por empleada */}
      {report.employees.map((emp) => (
        <div key={emp.employee_id} className="bg-white rounded-xl shadow-sm p-6 print:shadow-none print:border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">{emp.employee_name}</h3>
            <span className="text-xl font-bold text-green-700">{formatCurrency(emp.total_sales)}</span>
          </div>

          {/* Métricas rápidas */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Turnos</p>
              <p className="text-lg font-bold text-gray-800">{emp.shifts_count}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Transacciones</p>
              <p className="text-lg font-bold text-gray-800">{emp.transactions_count}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xs text-green-600">Efectivo</p>
              <p className="text-lg font-bold text-green-700">{formatCurrency(emp.cash_sales)}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <p className="text-xs text-purple-600">Transferencias</p>
              <p className="text-lg font-bold text-purple-700">{formatCurrency(emp.transfer_sales)}</p>
            </div>
          </div>

          {/* Turnos trabajados */}
          <div>
            <h4 className="text-sm font-semibold text-gray-600 mb-2">Turnos trabajados</h4>
            <div className="space-y-1">
              {emp.shifts.map((s) => (
                <div key={s.shift_id} className="flex items-center justify-between text-sm py-1.5 px-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500">{formatDate(s.date + 'T12:00:00')}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.type === 'day' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {s.type === 'day' ? 'Día' : 'Noche'}
                    </span>
                    <span className="text-gray-400">{s.transactions} ventas</span>
                  </div>
                  <span className="font-medium text-gray-800">{formatCurrency(s.total)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top productos */}
          {emp.products.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-600 mb-2">Productos vendidos</h4>
              <div className="space-y-1">
                {emp.products.slice(0, 10).map((p) => (
                  <div key={p.product_name} className="flex items-center justify-between text-sm py-1 px-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-700">{p.product_name} <span className="text-gray-400">× {p.quantity}</span></span>
                    <span className="font-medium text-gray-800">{formatCurrency(p.total)}</span>
                  </div>
                ))}
                {emp.products.length > 10 && (
                  <p className="text-xs text-gray-400 text-center pt-1">y {emp.products.length - 10} productos más...</p>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DailyReportView({
  report,
  onSelectShift,
}: {
  report: DailyReport;
  onSelectShift: (shiftId: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Encabezado del reporte */}
      <div className="bg-white rounded-xl shadow-sm p-6 print:shadow-none print:border">
        <h2 className="text-xl font-bold mb-2">
          Reporte del Día - {formatDate(report.date + 'T12:00:00')}
        </h2>
        <p className="text-gray-500 text-sm">
          {report.shifts.length} turno(s) registrado(s)
        </p>
      </div>

      {/* Resumen del día */}
      <div className="bg-white rounded-xl shadow-sm p-6 print:shadow-none print:border">
        <h3 className="text-lg font-semibold mb-4">Resumen del Día</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-600">Total Ventas</p>
            <p className="text-2xl font-bold text-blue-700">
              {formatCurrency(report.day_totals.total_sales)}
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-600">Efectivo</p>
            <p className="text-2xl font-bold text-green-700">
              {formatCurrency(report.day_totals.cash_sales)}
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm text-purple-600">Transferencias</p>
            <p className="text-2xl font-bold text-purple-700">
              {formatCurrency(report.day_totals.transfer_sales)}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Transacciones</p>
            <p className="text-2xl font-bold text-gray-700">
              {report.day_totals.transactions}
            </p>
          </div>
        </div>

        {/* Info adicional */}
        {(report.day_totals.fiado_total > 0 || report.day_totals.voided_count > 0) && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 gap-4">
            {report.day_totals.fiado_total > 0 && (
              <div className="bg-orange-50 p-3 rounded-lg">
                <p className="text-sm text-orange-600">Fiados</p>
                <p className="text-lg font-bold text-orange-700">
                  {formatCurrency(report.day_totals.fiado_total)}
                </p>
                {report.day_totals.fiado_abonos > 0 && (
                  <p className="text-xs text-orange-500">
                    Abonos: {formatCurrency(report.day_totals.fiado_abonos)}
                  </p>
                )}
              </div>
            )}
            {report.day_totals.voided_count > 0 && (
              <div className="bg-red-50 p-3 rounded-lg">
                <p className="text-sm text-red-600">Ventas Anuladas</p>
                <p className="text-lg font-bold text-red-700">
                  {report.day_totals.voided_count}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Turnos del día */}
      <div className="bg-white rounded-xl shadow-sm p-6 print:shadow-none print:border">
        <h3 className="text-lg font-semibold mb-4">Turnos</h3>
        <div className="space-y-4">
          {report.shifts.map((shift) => (
            <div
              key={shift.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer print:cursor-default"
              onClick={() => onSelectShift(shift.id)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      shift.type === 'day'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-indigo-100 text-indigo-800'
                    }`}>
                      {shift.type === 'day' ? 'Día' : 'Noche'}
                    </span>
                    <span className="font-medium">{shift.employee_name}</span>
                    {shift.is_active && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                        Activo
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatTime(shift.start_time)}
                    {shift.end_time && ` - ${formatTime(shift.end_time)}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{formatCurrency(shift.total)}</p>
                  <p className="text-sm text-gray-500">{shift.sales_count} ventas</p>
                </div>
              </div>

              {/* Observaciones */}
              {shift.notes && (
                <div className="mt-3 bg-yellow-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-yellow-800">Observaciones:</p>
                  <p className="text-sm text-yellow-700">{shift.notes}</p>
                </div>
              )}

              {/* Detalles de caja */}
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Caja inicial:</span>
                  <span className="ml-2 font-medium">{formatCurrency(shift.cash_start)}</span>
                </div>
                {shift.cash_end !== null && (
                  <>
                    <div>
                      <span className="text-gray-500">Caja final:</span>
                      <span className="ml-2 font-medium">{formatCurrency(shift.cash_end)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Diferencia:</span>
                      <span className={`ml-2 font-medium ${
                        (shift.cash_end - shift.cash_start - (shift.summary?.cash_sales || 0)) >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {formatCurrency(shift.cash_end - shift.cash_start - (shift.summary?.cash_sales || 0))}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}

          {report.shifts.length === 0 && (
            <p className="text-center text-gray-500 py-4">
              No hay turnos registrados para este día
            </p>
          )}
        </div>
      </div>

      {/* Ventas por Turno de Día */}
      {report.by_shift_type?.day && report.by_shift_type.day.employees.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 print:shadow-none print:border">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">☀️</span>
            <div>
              <h3 className="text-lg font-semibold">Turno Día</h3>
              <p className="text-sm text-gray-500">
                Total: {formatCurrency(report.by_shift_type.day.total)}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {report.by_shift_type.day.employees.map((emp) => (
              <div key={emp.employee_id} className="border border-yellow-200 rounded-lg p-4 bg-yellow-50/50">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-yellow-800">{emp.employee_name}</h4>
                  <span className="font-bold text-yellow-700">{formatCurrency(emp.total)}</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-yellow-200">
                      <th className="text-left py-1 px-2">Producto</th>
                      <th className="text-center py-1 px-2">Unidades</th>
                      <th className="text-right py-1 px-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emp.products.map((product, idx) => (
                      <tr key={idx} className="border-b border-yellow-100">
                        <td className="py-1 px-2">{product.product_name}</td>
                        <td className="text-center py-1 px-2 font-medium">{product.quantity}</td>
                        <td className="text-right py-1 px-2">{formatCurrency(product.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* Total del turno de día */}
          <div className="mt-4 pt-4 border-t border-yellow-200">
            <h4 className="font-semibold mb-2">Resumen Turno Día</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-yellow-100">
                  <th className="text-left py-2 px-2">Producto</th>
                  <th className="text-center py-2 px-2">Unidades</th>
                  <th className="text-right py-2 px-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {report.by_shift_type.day.products.map((product, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="py-1 px-2">{product.product_name}</td>
                    <td className="text-center py-1 px-2 font-medium">{product.quantity}</td>
                    <td className="text-right py-1 px-2">{formatCurrency(product.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold bg-yellow-100">
                  <td className="py-2 px-2">TOTAL TURNO DÍA</td>
                  <td className="text-center py-2 px-2">
                    {report.by_shift_type.day.products.reduce((sum, p) => sum + p.quantity, 0)}
                  </td>
                  <td className="text-right py-2 px-2">
                    {formatCurrency(report.by_shift_type.day.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Ventas por Turno de Noche */}
      {report.by_shift_type?.night && report.by_shift_type.night.employees.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 print:shadow-none print:border">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🌙</span>
            <div>
              <h3 className="text-lg font-semibold">Turno Noche</h3>
              <p className="text-sm text-gray-500">
                Total: {formatCurrency(report.by_shift_type.night.total)}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {report.by_shift_type.night.employees.map((emp) => (
              <div key={emp.employee_id} className="border border-indigo-200 rounded-lg p-4 bg-indigo-50/50">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-indigo-800">{emp.employee_name}</h4>
                  <span className="font-bold text-indigo-700">{formatCurrency(emp.total)}</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-indigo-200">
                      <th className="text-left py-1 px-2">Producto</th>
                      <th className="text-center py-1 px-2">Unidades</th>
                      <th className="text-right py-1 px-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emp.products.map((product, idx) => (
                      <tr key={idx} className="border-b border-indigo-100">
                        <td className="py-1 px-2">{product.product_name}</td>
                        <td className="text-center py-1 px-2 font-medium">{product.quantity}</td>
                        <td className="text-right py-1 px-2">{formatCurrency(product.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* Total del turno de noche */}
          <div className="mt-4 pt-4 border-t border-indigo-200">
            <h4 className="font-semibold mb-2">Resumen Turno Noche</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-indigo-100">
                  <th className="text-left py-2 px-2">Producto</th>
                  <th className="text-center py-2 px-2">Unidades</th>
                  <th className="text-right py-2 px-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {report.by_shift_type.night.products.map((product, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="py-1 px-2">{product.product_name}</td>
                    <td className="text-center py-1 px-2 font-medium">{product.quantity}</td>
                    <td className="text-right py-1 px-2">{formatCurrency(product.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold bg-indigo-100">
                  <td className="py-2 px-2">TOTAL TURNO NOCHE</td>
                  <td className="text-center py-2 px-2">
                    {report.by_shift_type.night.products.reduce((sum, p) => sum + p.quantity, 0)}
                  </td>
                  <td className="text-right py-2 px-2">
                    {formatCurrency(report.by_shift_type.night.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Resumen Total del Día (todos los productos) */}
      <div className="bg-white rounded-xl shadow-sm p-6 print:shadow-none print:border">
        <h3 className="text-lg font-semibold mb-4">Resumen Total del Día</h3>
        {report.products.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2">Producto</th>
                  <th className="text-center py-2 px-2">Unidades</th>
                  <th className="text-right py-2 px-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {report.products.map((product, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-2 px-2">{product.product_name}</td>
                    <td className="text-center py-2 px-2 font-medium">{product.quantity}</td>
                    <td className="text-right py-2 px-2 font-medium">
                      {formatCurrency(product.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold bg-blue-50">
                  <td className="py-2 px-2">TOTAL DEL DÍA</td>
                  <td className="text-center py-2 px-2">
                    {report.products.reduce((sum, p) => sum + p.quantity, 0)}
                  </td>
                  <td className="text-right py-2 px-2">
                    {formatCurrency(report.products.reduce((sum, p) => sum + p.total, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="text-center text-gray-500 py-4">No hay productos vendidos</p>
        )}
      </div>

      {/* Observaciones del día */}
      {report.observations && report.observations.length > 0 && (
        <div className="bg-amber-50 rounded-xl shadow-sm p-6 print:shadow-none print:border border border-amber-200">
          <h3 className="text-lg font-semibold mb-4 text-amber-800 flex items-center gap-2">
            <NoteIcon className="w-5 h-5" />
            Observaciones del Día ({report.observations.length})
          </h3>
          <div className="space-y-3">
            {report.observations.map((obs) => (
              <div key={obs.id} className="bg-white p-3 rounded-lg border border-amber-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-amber-900">{obs.employee_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    obs.shift_type === 'day'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}>
                    {obs.shift_type === 'day' ? 'Día' : 'Noche'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTime(obs.created_at)}
                  </span>
                </div>
                <p className="text-gray-700">{obs.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function ShiftReportView({ report }: { report: SingleShiftReport }) {
  const { shift, summary, products, payment_totals, observations } = report;

  return (
    <div className="space-y-6">
      {/* Encabezado del turno */}
      <div className="bg-white rounded-xl shadow-sm p-6 print:shadow-none print:border">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold mb-1">
              Reporte de Turno - {shift.type === 'day' ? 'Día' : 'Noche'}
            </h2>
            <p className="text-gray-600">{shift.employee_name}</p>
            <p className="text-sm text-gray-500">
              {formatDate(shift.start_time)} | {formatTime(shift.start_time)}
              {shift.end_time && ` - ${formatTime(shift.end_time)}`}
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            shift.is_active
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-800'
          }`}>
            {shift.is_active ? 'Activo' : 'Cerrado'}
          </div>
        </div>
      </div>

      {/* Resumen de ventas */}
      <div className="bg-white rounded-xl shadow-sm p-6 print:shadow-none print:border">
        <h3 className="text-lg font-semibold mb-4">Resumen de Ventas</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-600">Total Ventas</p>
            <p className="text-2xl font-bold text-blue-700">
              {formatCurrency(summary.total_sales)}
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-600">Efectivo</p>
            <p className="text-2xl font-bold text-green-700">
              {formatCurrency(summary.cash_sales)}
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm text-purple-600">Transferencias</p>
            <p className="text-2xl font-bold text-purple-700">
              {formatCurrency(summary.transfer_sales)}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Transacciones</p>
            <p className="text-2xl font-bold text-gray-700">
              {summary.transactions_count}
            </p>
          </div>
        </div>

        {/* Detalles de pago */}
        {(payment_totals.fiado > 0 || payment_totals.mixed_cash > 0) && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Detalle por Método de Pago</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {payment_totals.fiado > 0 && (
                <div className="bg-orange-50 p-2 rounded">
                  <span className="text-orange-600">Fiados:</span>
                  <span className="ml-2 font-medium text-orange-700">
                    {formatCurrency(payment_totals.fiado)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Caja */}
      <div className="bg-white rounded-xl shadow-sm p-6 print:shadow-none print:border">
        <h3 className="text-lg font-semibold mb-4">Estado de Caja</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Caja Inicial</p>
            <p className="text-xl font-bold">{formatCurrency(shift.cash_start)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Ventas Efectivo</p>
            <p className="text-xl font-bold text-green-600">
              +{formatCurrency(summary.cash_sales)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Esperado</p>
            <p className="text-xl font-bold">
              {formatCurrency(shift.cash_start + summary.cash_sales)}
            </p>
          </div>
          {shift.cash_end !== null && (
            <div>
              <p className="text-sm text-gray-500">Caja Final</p>
              <p className="text-xl font-bold">{formatCurrency(shift.cash_end)}</p>
              <p className={`text-sm ${
                (shift.cash_end - shift.cash_start - summary.cash_sales) >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}>
                Diferencia: {formatCurrency(shift.cash_end - shift.cash_start - summary.cash_sales)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Observaciones */}
      {shift.notes && (
        <div className="bg-yellow-50 rounded-xl shadow-sm p-6 print:shadow-none print:border border border-yellow-200">
          <h3 className="text-lg font-semibold mb-2 text-yellow-800">Observaciones</h3>
          <p className="text-yellow-700 whitespace-pre-wrap">{shift.notes}</p>
        </div>
      )}

      {/* Productos vendidos */}
      <div className="bg-white rounded-xl shadow-sm p-6 print:shadow-none print:border">
        <h3 className="text-lg font-semibold mb-4">Productos Vendidos</h3>
        {products.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2">Producto</th>
                  <th className="text-center py-2 px-2">Unidades</th>
                  <th className="text-right py-2 px-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-2 px-2">{product.product_name}</td>
                    <td className="text-center py-2 px-2 font-medium">{product.quantity}</td>
                    <td className="text-right py-2 px-2 font-medium">
                      {formatCurrency(product.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold bg-gray-50">
                  <td className="py-2 px-2">TOTAL</td>
                  <td className="text-center py-2 px-2">
                    {products.reduce((sum, p) => sum + p.quantity, 0)}
                  </td>
                  <td className="text-right py-2 px-2">
                    {formatCurrency(products.reduce((sum, p) => sum + p.total, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="text-center text-gray-500 py-4">No hay productos vendidos en este turno</p>
        )}
      </div>

      {/* Observaciones del turno */}
      {observations && observations.length > 0 && (
        <div className="bg-amber-50 rounded-xl shadow-sm p-6 print:shadow-none print:border border border-amber-200">
          <h3 className="text-lg font-semibold mb-4 text-amber-800 flex items-center gap-2">
            <NoteIcon className="w-5 h-5" />
            Observaciones del Turno ({observations.length})
          </h3>
          <div className="space-y-3">
            {observations.map((obs) => (
              <div key={obs.id} className="bg-white p-3 rounded-lg border border-amber-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-amber-900">{obs.employee_name}</span>
                  <span className="text-xs text-gray-500">
                    {formatTime(obs.created_at)}
                  </span>
                </div>
                <p className="text-gray-700">{obs.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Vista de reporte de rango de fechas
function RangeReportView({ report }: { report: RangeReport }) {
  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="bg-white rounded-xl shadow-sm p-6 print:shadow-none print:border">
        <h2 className="text-xl font-bold mb-2">
          Reporte de Ventas
        </h2>
        <p className="text-gray-500">
          {formatDate(report.start_date + 'T12:00:00')} - {formatDate(report.end_date + 'T12:00:00')}
        </p>
      </div>

      {/* Resumen del período */}
      <div className="bg-white rounded-xl shadow-sm p-6 print:shadow-none print:border">
        <h3 className="text-lg font-semibold mb-4">Resumen del Período</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-600">Total Ventas</p>
            <p className="text-2xl font-bold text-blue-700">
              {formatCurrency(report.totals.total_sales)}
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-600">Efectivo</p>
            <p className="text-2xl font-bold text-green-700">
              {formatCurrency(report.totals.cash_sales)}
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm text-purple-600">Transferencias</p>
            <p className="text-2xl font-bold text-purple-700">
              {formatCurrency(report.totals.transfer_sales)}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Transacciones</p>
            <p className="text-2xl font-bold text-gray-700">
              {report.totals.transactions}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div className="bg-orange-50 p-3 rounded-lg">
            <p className="text-orange-600">Turnos</p>
            <p className="text-lg font-bold text-orange-700">{report.totals.shifts_count}</p>
          </div>
          {report.totals.fiado_total > 0 && (
            <div className="bg-yellow-50 p-3 rounded-lg">
              <p className="text-yellow-600">Fiados</p>
              <p className="text-lg font-bold text-yellow-700">{formatCurrency(report.totals.fiado_total)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Desglose por día */}
      {report.daily_breakdown.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 print:shadow-none print:border">
          <h3 className="text-lg font-semibold mb-4">Ventas por Día</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2">Fecha</th>
                  <th className="text-right py-2 px-2">Total</th>
                  <th className="text-right py-2 px-2">Efectivo</th>
                  <th className="text-right py-2 px-2">Transfer</th>
                  <th className="text-center py-2 px-2">Ventas</th>
                </tr>
              </thead>
              <tbody>
                {report.daily_breakdown.map((day, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="py-2 px-2">{formatDate(day.date + 'T12:00:00')}</td>
                    <td className="text-right py-2 px-2 font-medium">{formatCurrency(day.total)}</td>
                    <td className="text-right py-2 px-2 text-green-600">{formatCurrency(day.cash)}</td>
                    <td className="text-right py-2 px-2 text-purple-600">{formatCurrency(day.transfer)}</td>
                    <td className="text-center py-2 px-2">{day.transactions}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold bg-blue-50">
                  <td className="py-2 px-2">TOTAL</td>
                  <td className="text-right py-2 px-2">{formatCurrency(report.totals.total_sales)}</td>
                  <td className="text-right py-2 px-2 text-green-600">{formatCurrency(report.totals.cash_sales)}</td>
                  <td className="text-right py-2 px-2 text-purple-600">{formatCurrency(report.totals.transfer_sales)}</td>
                  <td className="text-center py-2 px-2">{report.totals.transactions}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Ventas por empleada */}
      {report.by_employee.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 print:shadow-none print:border">
          <h3 className="text-lg font-semibold mb-4">Ventas por Empleada</h3>
          <div className="space-y-4">
            {report.by_employee.map((emp) => (
              <div key={emp.employee_id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold">{emp.employee_name}</h4>
                  <span className="font-bold text-blue-600">{formatCurrency(emp.total)}</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-1 px-2">Producto</th>
                      <th className="text-center py-1 px-2">Unidades</th>
                      <th className="text-right py-1 px-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emp.products.map((product, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="py-1 px-2">{product.product_name}</td>
                        <td className="text-center py-1 px-2 font-medium">{product.quantity}</td>
                        <td className="text-right py-1 px-2">{formatCurrency(product.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Productos vendidos */}
      <div className="bg-white rounded-xl shadow-sm p-6 print:shadow-none print:border">
        <h3 className="text-lg font-semibold mb-4">Resumen de Productos</h3>
        {report.products.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2">Producto</th>
                  <th className="text-center py-2 px-2">Unidades</th>
                  <th className="text-right py-2 px-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {report.products.map((product, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-2 px-2">{product.product_name}</td>
                    <td className="text-center py-2 px-2 font-medium">{product.quantity}</td>
                    <td className="text-right py-2 px-2 font-medium">
                      {formatCurrency(product.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold bg-blue-50">
                  <td className="py-2 px-2">TOTAL</td>
                  <td className="text-center py-2 px-2">
                    {report.products.reduce((sum, p) => sum + p.quantity, 0)}
                  </td>
                  <td className="text-right py-2 px-2">
                    {formatCurrency(report.products.reduce((sum, p) => sum + p.total, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="text-center text-gray-500 py-4">No hay productos vendidos en este período</p>
        )}
      </div>

      {/* Observaciones del período */}
      {report.observations && report.observations.length > 0 && (
        <div className="bg-amber-50 rounded-xl shadow-sm p-6 print:shadow-none print:border border border-amber-200">
          <h3 className="text-lg font-semibold mb-4 text-amber-800 flex items-center gap-2">
            <NoteIcon className="w-5 h-5" />
            Observaciones del Período ({report.observations.length})
          </h3>
          <div className="space-y-3">
            {report.observations.map((obs) => (
              <div key={obs.id} className="bg-white p-3 rounded-lg border border-amber-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-amber-900">{obs.employee_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    obs.shift_type === 'day'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}>
                    {obs.shift_type === 'day' ? 'Día' : 'Noche'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDate(obs.created_at)} {formatTime(obs.created_at)}
                  </span>
                </div>
                <p className="text-gray-700">{obs.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Vista de ranking de productos
function RankingReportView({ report }: { report: RankingReport }) {
  const periodName = {
    day: 'Hoy',
    week: 'Última Semana',
    month: 'Último Mes',
    year: 'Último Año',
    all: 'Todo el Tiempo',
    custom: 'Período Personalizado',
  }[report.period] || report.period;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl shadow-sm p-6 text-white print:bg-amber-100 print:text-amber-900">
        <div className="flex items-center gap-3 mb-2">
          <TrophyIcon className="w-8 h-8" />
          <h2 className="text-xl font-bold">Ranking de Productos Más Vendidos</h2>
        </div>
        <p className="opacity-90">
          {periodName} ({formatDate(report.start_date + 'T12:00:00')} - {formatDate(report.end_date + 'T12:00:00')})
        </p>
      </div>

      {/* Resumen */}
      <div className="bg-white rounded-xl shadow-sm p-6 print:shadow-none print:border">
        <h3 className="text-lg font-semibold mb-4">Resumen</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-amber-50 p-4 rounded-lg text-center">
            <p className="text-sm text-amber-600">Productos Diferentes</p>
            <p className="text-2xl font-bold text-amber-700">
              {report.summary.total_products}
            </p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg text-center">
            <p className="text-sm text-orange-600">Unidades Vendidas</p>
            <p className="text-2xl font-bold text-orange-700">
              {report.summary.total_quantity}
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <p className="text-sm text-green-600">Total Ingresos</p>
            <p className="text-2xl font-bold text-green-700">
              {formatCurrency(report.summary.total_revenue)}
            </p>
          </div>
        </div>
      </div>

      {/* Top 3 Podio */}
      {report.ranking.length >= 3 && (
        <div className="bg-white rounded-xl shadow-sm p-6 print:shadow-none print:border">
          <h3 className="text-lg font-semibold mb-4 text-center">Top 3</h3>
          <div className="flex justify-center items-end gap-4">
            {/* 2do lugar */}
            <div className="flex flex-col items-center">
              <div className="bg-gray-200 w-20 h-20 rounded-full flex items-center justify-center mb-2">
                <span className="text-2xl font-bold text-gray-600">2</span>
              </div>
              <p className="text-sm font-medium text-center max-w-24 truncate">{report.ranking[1]?.product_name}</p>
              <p className="text-lg font-bold text-gray-600">{report.ranking[1]?.quantity}</p>
            </div>
            {/* 1er lugar */}
            <div className="flex flex-col items-center -mt-4">
              <div className="bg-amber-400 w-24 h-24 rounded-full flex items-center justify-center mb-2 shadow-lg">
                <span className="text-3xl font-bold text-white">1</span>
              </div>
              <p className="text-sm font-medium text-center max-w-28 truncate">{report.ranking[0]?.product_name}</p>
              <p className="text-xl font-bold text-amber-600">{report.ranking[0]?.quantity}</p>
            </div>
            {/* 3er lugar */}
            <div className="flex flex-col items-center">
              <div className="bg-orange-300 w-16 h-16 rounded-full flex items-center justify-center mb-2">
                <span className="text-xl font-bold text-orange-800">3</span>
              </div>
              <p className="text-sm font-medium text-center max-w-20 truncate">{report.ranking[2]?.product_name}</p>
              <p className="text-lg font-bold text-orange-600">{report.ranking[2]?.quantity}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabla completa de ranking */}
      <div className="bg-white rounded-xl shadow-sm p-6 print:shadow-none print:border">
        <h3 className="text-lg font-semibold mb-4">Ranking Completo</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-center py-2 px-2 w-16">#</th>
                <th className="text-left py-2 px-2">Producto</th>
                <th className="text-left py-2 px-2">Categoría</th>
                <th className="text-center py-2 px-2">Unidades</th>
                <th className="text-right py-2 px-2">Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {report.ranking.map((product) => (
                <tr key={`${product.product_id}-${product.rank}`} className={`border-b border-gray-100 ${product.rank <= 3 ? 'bg-amber-50' : ''}`}>
                  <td className="text-center py-2 px-2">
                    {product.rank <= 3 ? (
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold ${
                        product.rank === 1 ? 'bg-amber-500' : product.rank === 2 ? 'bg-gray-400' : 'bg-orange-400'
                      }`}>
                        {product.rank}
                      </span>
                    ) : (
                      <span className="text-gray-500">{product.rank}</span>
                    )}
                  </td>
                  <td className="py-2 px-2 font-medium">{product.product_name}</td>
                  <td className="py-2 px-2 text-gray-500">{product.category || 'Sin categoría'}</td>
                  <td className="text-center py-2 px-2 font-bold">{product.quantity}</td>
                  <td className="text-right py-2 px-2 font-medium text-green-600">
                    {formatCurrency(product.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ventas por categoría */}
      {report.by_category.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 print:shadow-none print:border">
          <h3 className="text-lg font-semibold mb-4">Ventas por Categoría</h3>
          <div className="space-y-3">
            {report.by_category.map((cat, idx) => {
              const percentage = report.summary.total_quantity > 0
                ? (cat.quantity / report.summary.total_quantity) * 100
                : 0;
              return (
                <div key={idx} className="flex items-center gap-4">
                  <div className="w-32 text-sm font-medium truncate">{cat.category}</div>
                  <div className="flex-1">
                    <div className="bg-gray-200 rounded-full h-6 relative">
                      <div
                        className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-full h-6 flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(percentage, 5)}%` }}
                      >
                        <span className="text-xs font-bold text-white">{percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="w-20 text-right text-sm font-bold">{cat.quantity} uds</div>
                  <div className="w-24 text-right text-sm font-medium text-green-600">
                    {formatCurrency(cat.total)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Vista de historial de conteos de inventario
function InventoryCountReportView({ report }: { report: InventoryCountReport }) {
  return (
    <div className="space-y-4">
      {/* Encabezado simple */}
      <div className="bg-white rounded-xl shadow-sm p-4 print:shadow-none print:border flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Historial de Conteos</h2>
          {report.start_date && report.end_date && (
            <p className="text-sm text-gray-500">
              {formatDate(report.start_date + 'T12:00:00')} - {formatDate(report.end_date + 'T12:00:00')}
            </p>
          )}
        </div>
        <div className="flex gap-4 text-sm">
          <div className="text-center">
            <p className="text-gray-500">Total</p>
            <p className="font-bold text-lg">{report.summary.total_counts}</p>
          </div>
          <div className="text-center">
            <p className="text-green-600">Sobrantes</p>
            <p className="font-bold text-lg text-green-600">+{report.summary.total_positive_diff}</p>
          </div>
          <div className="text-center">
            <p className="text-red-600">Faltantes</p>
            <p className="font-bold text-lg text-red-600">-{report.summary.total_negative_diff}</p>
          </div>
        </div>
      </div>

      {/* Tabla de conteos */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden print:shadow-none print:border">
        {report.counts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Fecha</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Hora</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Producto</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Empleada</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600">Turno</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Sistema</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Real</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Dif.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.counts.map((count) => (
                  <tr
                    key={count.id}
                    className={
                      count.difference !== 0
                        ? count.difference > 0
                          ? 'bg-green-50'
                          : 'bg-red-50'
                        : 'hover:bg-gray-50'
                    }
                  >
                    <td className="py-3 px-4">{formatDate(count.created_at)}</td>
                    <td className="py-3 px-4 text-gray-500">{formatTime(count.created_at)}</td>
                    <td className="py-3 px-4 font-medium">{count.products?.name || '-'}</td>
                    <td className="py-3 px-4">{count.employees?.name || '-'}</td>
                    <td className="text-center py-3 px-4">
                      {count.shifts ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          count.shifts.type === 'day'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {count.shifts.type === 'day' ? 'Día' : 'Noche'}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="text-right py-3 px-4">{count.system_stock}</td>
                    <td className="text-right py-3 px-4">{count.real_stock}</td>
                    <td className={`text-right py-3 px-4 font-bold ${
                      count.difference > 0
                        ? 'text-green-600'
                        : count.difference < 0
                          ? 'text-red-600'
                          : 'text-gray-400'
                    }`}>
                      {count.difference > 0 ? '+' : ''}{count.difference}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">
            No hay conteos de inventario en este período
          </p>
        )}
      </div>
    </div>
  );
}

// Icono de inventario
function InventoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

// Icono de trofeo
function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 6a2 2 0 100 4 2 2 0 000-4z"/>
      <path fillRule="evenodd" d="M6 3a1 1 0 00-1 1v1H4a2 2 0 00-2 2v1a4 4 0 004 4h.5c.3 1.2.9 2.3 1.6 3.2L7 17.1v1.4l-1.7 1.7a1 1 0 00.7 1.7h12a1 1 0 00.7-1.7L17 18.5v-1.4l-1.1-1.9c.7-.9 1.3-2 1.6-3.2H18a4 4 0 004-4V6a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6zm0 2h12v5a6 6 0 01-12 0V5zm-2 2H3v1a2 2 0 002 2h.1A8 8 0 014 7zm16 0h1v1a2 2 0 01-2 2h-.1c.1-.6.1-1.3.1-2V7z" clipRule="evenodd"/>
    </svg>
  );
}

// Icono de descarga
function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

// Icono de caja/dinero
function CashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
