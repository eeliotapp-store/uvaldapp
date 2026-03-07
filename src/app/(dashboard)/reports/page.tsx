'use client';

import { useEffect, useState } from 'react';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore, isOwner } from '@/stores/auth-store';

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
}

type ReportType = 'daily' | 'shift';

export default function ReportsPage() {
  const employee = useAuthStore((state) => state.employee);
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [shiftReport, setShiftReport] = useState<SingleShiftReport | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Solo owners y superadmin pueden ver reportes
  if (!employee || !isOwner(employee.role)) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500">No tienes permisos para ver reportes</p>
      </div>
    );
  }

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

  useEffect(() => {
    fetchDailyReport(selectedDate);
  }, [selectedDate]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6 print:hidden">
        <h1 className="text-2xl font-bold">Reportes</h1>
        <Button onClick={handlePrint} variant="outline">
          Imprimir
        </Button>
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
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="daily">Reporte del Día</option>
              <option value="shift">Reporte por Turno</option>
            </select>
          </div>

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
        </>
      )}
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
    </div>
  );
}

function ShiftReportView({ report }: { report: SingleShiftReport }) {
  const { shift, summary, products, payment_totals } = report;

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
    </div>
  );
}
