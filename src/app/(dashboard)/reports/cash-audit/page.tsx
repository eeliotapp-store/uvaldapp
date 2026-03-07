'use client';

import { useEffect, useState } from 'react';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore, isOwner } from '@/stores/auth-store';
import Link from 'next/link';

interface CashAuditEntry {
  shift_id: string;
  employee_id: string;
  employee_name: string;
  type: 'day' | 'night';
  start_time: string;
  end_time: string | null;
  cash_start: number;
  cash_end: number | null;
  cash_sales: number;
  expected_cash: number;
  difference: number | null;
  notes: string | null;
  is_active: boolean;
  previous_shift_end: number | null;
  gap_with_previous: number | null;
  has_discrepancy: boolean;
}

interface EmployeeAudit {
  employee_id: string;
  employee_name: string;
  shifts: CashAuditEntry[];
  total_discrepancies: number;
  total_missing: number;
}

interface AuditStats {
  total_shifts: number;
  shifts_with_discrepancy: number;
  total_gap: number;
  shifts_missing_cash: number;
  shifts_extra_cash: number;
}

interface CashAuditReport {
  start_date: string;
  end_date: string;
  entries: CashAuditEntry[];
  by_employee: EmployeeAudit[];
  stats: AuditStats;
}

export default function CashAuditPage() {
  const employee = useAuthStore((state) => state.employee);
  const [report, setReport] = useState<CashAuditReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'timeline' | 'by_employee'>('timeline');

  // Filtros
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);

  // Solo owners y superadmin pueden ver
  if (!employee || !isOwner(employee.role)) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500">No tienes permisos para ver esta página</p>
      </div>
    );
  }

  const fetchReport = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(
        `/api/reports/cash-audit?start_date=${startDate}&end_date=${endDate}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al cargar reporte');
      }

      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar reporte');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate]);

  const exportCSV = () => {
    if (!report) return;

    const lines: string[] = [];
    lines.push('AUDITORÍA DE CAJA');
    lines.push(`Período: ${formatDate(startDate + 'T12:00:00')} - ${formatDate(endDate + 'T12:00:00')}`);
    lines.push('');

    // Resumen
    lines.push('RESUMEN');
    lines.push(`Total turnos,${report.stats.total_shifts}`);
    lines.push(`Turnos con discrepancia,${report.stats.shifts_with_discrepancy}`);
    lines.push(`Dinero faltante total,${report.stats.total_gap}`);
    lines.push('');

    // Detalle
    lines.push('DETALLE DE TURNOS');
    lines.push('Fecha,Turno,Empleada,Caja Inicial,Ventas Efectivo,Caja Esperada,Caja Final,Diferencia,Cierre Anterior,Discrepancia,Observaciones');

    report.entries.forEach(entry => {
      const diff = entry.difference !== null ? entry.difference : 'N/A';
      const gap = entry.gap_with_previous !== null ? entry.gap_with_previous : 'N/A';
      const notes = entry.notes ? `"${entry.notes.replace(/"/g, '""')}"` : '';

      lines.push([
        formatDate(entry.start_time),
        entry.type === 'day' ? 'Día' : 'Noche',
        entry.employee_name,
        entry.cash_start,
        entry.cash_sales,
        entry.expected_cash,
        entry.cash_end ?? 'Activo',
        diff,
        entry.previous_shift_end ?? 'Primero',
        gap,
        notes,
      ].join(','));
    });

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `auditoria_caja_${startDate}_${endDate}.csv`;
    link.click();
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link href="/reports" className="text-blue-600 hover:underline text-sm mb-1 block">
            ← Volver a Reportes
          </Link>
          <h1 className="text-2xl font-bold">Auditoría de Caja</h1>
          <p className="text-gray-500 text-sm">Control de flujo de efectivo entre turnos</p>
        </div>
        {report && (
          <Button onClick={exportCSV} variant="outline" className="flex items-center gap-1">
            <DownloadIcon className="w-4 h-4" />
            CSV
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Desde
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hasta
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vista
            </label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as 'timeline' | 'by_employee')}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="timeline">Línea de tiempo</option>
              <option value="by_employee">Por empleada</option>
            </select>
          </div>
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
          <p className="mt-2 text-gray-500">Cargando auditoría...</p>
        </div>
      ) : report ? (
        <>
          {/* Resumen de alertas */}
          {report.stats.shifts_with_discrepancy > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <h3 className="text-red-800 font-semibold flex items-center gap-2">
                <AlertIcon className="w-5 h-5" />
                Alertas de Discrepancia
              </h3>
              <p className="text-red-700 mt-1">
                Se detectaron <strong>{report.stats.shifts_with_discrepancy}</strong> turnos donde
                la caja inicial no coincide con el cierre del turno anterior.
              </p>
              <p className="text-red-600 text-sm mt-1">
                Total faltante: <strong>{formatCurrency(report.stats.total_gap)}</strong>
              </p>
            </div>
          )}

          {/* Estadísticas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-sm text-gray-500">Total Turnos</p>
              <p className="text-2xl font-bold">{report.stats.total_shifts}</p>
            </div>
            <div className={`rounded-xl shadow-sm p-4 ${
              report.stats.shifts_with_discrepancy > 0 ? 'bg-red-50' : 'bg-green-50'
            }`}>
              <p className="text-sm text-gray-600">Con Discrepancia</p>
              <p className={`text-2xl font-bold ${
                report.stats.shifts_with_discrepancy > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {report.stats.shifts_with_discrepancy}
              </p>
            </div>
            <div className={`rounded-xl shadow-sm p-4 ${
              report.stats.shifts_missing_cash > 0 ? 'bg-orange-50' : 'bg-white'
            }`}>
              <p className="text-sm text-gray-500">Faltante en Caja</p>
              <p className="text-2xl font-bold text-orange-600">
                {report.stats.shifts_missing_cash}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-sm text-gray-500">Sobrante en Caja</p>
              <p className="text-2xl font-bold text-blue-600">
                {report.stats.shifts_extra_cash}
              </p>
            </div>
          </div>

          {/* Vista de línea de tiempo */}
          {viewMode === 'timeline' && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Historial de Turnos</h3>
              <div className="space-y-4">
                {report.entries.map((entry, index) => (
                  <div
                    key={entry.shift_id}
                    className={`border rounded-lg p-4 ${
                      entry.has_discrepancy
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-200'
                    }`}
                  >
                    {/* Alerta de discrepancia */}
                    {entry.has_discrepancy && entry.gap_with_previous !== null && (
                      <div className="bg-red-100 text-red-800 px-3 py-2 rounded-lg mb-3 text-sm">
                        <strong>⚠️ DISCREPANCIA:</strong> El turno anterior cerró con{' '}
                        <strong>{formatCurrency(entry.previous_shift_end || 0)}</strong> pero
                        este turno inició con <strong>{formatCurrency(entry.cash_start)}</strong>
                        {entry.gap_with_previous < 0 ? (
                          <span className="text-red-600">
                            {' '}(Faltan {formatCurrency(Math.abs(entry.gap_with_previous))})
                          </span>
                        ) : (
                          <span className="text-blue-600">
                            {' '}(Sobran {formatCurrency(entry.gap_with_previous)})
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            entry.type === 'day'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}>
                            {entry.type === 'day' ? '☀️ Día' : '🌙 Noche'}
                          </span>
                          <span className="font-medium">{entry.employee_name}</span>
                          {entry.is_active && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                              Activo
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {formatDate(entry.start_time)} {formatTime(entry.start_time)}
                          {entry.end_time && ` - ${formatTime(entry.end_time)}`}
                        </p>
                      </div>
                    </div>

                    {/* Flujo de caja */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 text-sm">
                      <div className="bg-gray-50 p-2 rounded">
                        <p className="text-gray-500 text-xs">Caja Inicial</p>
                        <p className="font-bold">{formatCurrency(entry.cash_start)}</p>
                      </div>
                      <div className="bg-green-50 p-2 rounded">
                        <p className="text-gray-500 text-xs">+ Ventas Efectivo</p>
                        <p className="font-bold text-green-600">
                          {formatCurrency(entry.cash_sales)}
                        </p>
                      </div>
                      <div className="bg-blue-50 p-2 rounded">
                        <p className="text-gray-500 text-xs">= Esperado</p>
                        <p className="font-bold text-blue-600">
                          {formatCurrency(entry.expected_cash)}
                        </p>
                      </div>
                      <div className="bg-gray-50 p-2 rounded">
                        <p className="text-gray-500 text-xs">Caja Final</p>
                        <p className="font-bold">
                          {entry.cash_end !== null ? formatCurrency(entry.cash_end) : '—'}
                        </p>
                      </div>
                      <div className={`p-2 rounded ${
                        entry.difference === null
                          ? 'bg-gray-50'
                          : entry.difference === 0
                            ? 'bg-green-50'
                            : entry.difference > 0
                              ? 'bg-blue-50'
                              : 'bg-red-50'
                      }`}>
                        <p className="text-gray-500 text-xs">Diferencia</p>
                        <p className={`font-bold ${
                          entry.difference === null
                            ? 'text-gray-400'
                            : entry.difference === 0
                              ? 'text-green-600'
                              : entry.difference > 0
                                ? 'text-blue-600'
                                : 'text-red-600'
                        }`}>
                          {entry.difference !== null
                            ? (entry.difference >= 0 ? '+' : '') + formatCurrency(entry.difference)
                            : '—'}
                        </p>
                      </div>
                    </div>

                    {/* Observaciones */}
                    {entry.notes && (
                      <div className="mt-3 bg-yellow-50 p-3 rounded-lg">
                        <p className="text-sm font-medium text-yellow-800">Observaciones:</p>
                        <p className="text-sm text-yellow-700">{entry.notes}</p>
                      </div>
                    )}

                    {/* Conexión con siguiente turno */}
                    {index < report.entries.length - 1 && (
                      <div className="mt-3 pt-3 border-t border-dashed border-gray-200 text-center">
                        <span className="text-gray-400 text-xs">↓</span>
                      </div>
                    )}
                  </div>
                ))}

                {report.entries.length === 0 && (
                  <p className="text-center text-gray-500 py-8">
                    No hay turnos registrados en este período
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Vista por empleada */}
          {viewMode === 'by_employee' && (
            <div className="space-y-6">
              {report.by_employee.map((emp) => (
                <div key={emp.employee_id} className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{emp.employee_name}</h3>
                      <p className="text-sm text-gray-500">
                        {emp.shifts.length} turno(s) en el período
                      </p>
                    </div>
                    {emp.total_missing > 0 && (
                      <div className="bg-red-100 text-red-800 px-3 py-1 rounded-lg text-sm">
                        Discrepancias: {formatCurrency(emp.total_missing)}
                      </div>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="text-left py-2 px-2">Fecha</th>
                          <th className="text-left py-2 px-2">Turno</th>
                          <th className="text-right py-2 px-2">Inicio</th>
                          <th className="text-right py-2 px-2">Ventas</th>
                          <th className="text-right py-2 px-2">Esperado</th>
                          <th className="text-right py-2 px-2">Final</th>
                          <th className="text-right py-2 px-2">Dif.</th>
                          <th className="text-center py-2 px-2">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {emp.shifts.map((shift) => (
                          <tr
                            key={shift.shift_id}
                            className={`border-b ${
                              shift.has_discrepancy ? 'bg-red-50' : ''
                            }`}
                          >
                            <td className="py-2 px-2">{formatDate(shift.start_time)}</td>
                            <td className="py-2 px-2">
                              {shift.type === 'day' ? '☀️' : '🌙'}
                            </td>
                            <td className="py-2 px-2 text-right">
                              {formatCurrency(shift.cash_start)}
                            </td>
                            <td className="py-2 px-2 text-right text-green-600">
                              +{formatCurrency(shift.cash_sales)}
                            </td>
                            <td className="py-2 px-2 text-right">
                              {formatCurrency(shift.expected_cash)}
                            </td>
                            <td className="py-2 px-2 text-right">
                              {shift.cash_end !== null
                                ? formatCurrency(shift.cash_end)
                                : '—'}
                            </td>
                            <td className={`py-2 px-2 text-right font-medium ${
                              shift.difference === null
                                ? 'text-gray-400'
                                : shift.difference === 0
                                  ? 'text-green-600'
                                  : shift.difference > 0
                                    ? 'text-blue-600'
                                    : 'text-red-600'
                            }`}>
                              {shift.difference !== null
                                ? formatCurrency(shift.difference)
                                : '—'}
                            </td>
                            <td className="py-2 px-2 text-center">
                              {shift.has_discrepancy && (
                                <span className="text-red-600" title="Discrepancia con turno anterior">
                                  ⚠️
                                </span>
                              )}
                              {shift.is_active && (
                                <span className="text-green-600">🟢</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

// Iconos
function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}
