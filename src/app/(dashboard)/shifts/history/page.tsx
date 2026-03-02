'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore, isOwner } from '@/stores/auth-store';
import { formatCurrency, formatDate, formatTime, formatDateTime, getShiftTypeLabel } from '@/lib/utils';
import type { ShiftSummary } from '@/types/database';

export default function ShiftHistoryPage() {
  const employee = useAuthStore((state) => state.employee);
  const [shifts, setShifts] = useState<ShiftSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedShift, setSelectedShift] = useState<ShiftSummary | null>(null);
  const [filters, setFilters] = useState({
    start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // última semana
    end_date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadShifts();
  }, [filters]);

  const loadShifts = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('v_shift_summary')
        .select('*')
        .order('start_time', { ascending: false });

      if (filters.start_date) {
        query = query.gte('start_time', `${filters.start_date}T00:00:00`);
      }
      if (filters.end_date) {
        query = query.lte('start_time', `${filters.end_date}T23:59:59`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setShifts((data as ShiftSummary[]) || []);
    } catch (error) {
      console.error('Error loading shifts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Solo dueños pueden ver historial completo
  if (!isOwner(employee?.role)) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No tienes permisos para ver el historial de turnos</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Historial de Turnos</h1>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-200">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Desde</label>
          <input
            type="date"
            value={filters.start_date}
            onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Hasta</label>
          <input
            type="date"
            value={filters.end_date}
            onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Empleado</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Turno</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Inicio</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Fin</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Caja Inicial</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Caja Final</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Ventas</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Estado</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shifts.map((shift) => {
                  const expectedCash = shift.cash_start + shift.cash_sales + (shift.mixed_cash || 0) - (shift.total_change || 0);
                  const difference = shift.cash_end !== null ? shift.cash_end - expectedCash : null;

                  return (
                    <tr key={shift.shift_id} className={`hover:bg-gray-50 ${shift.is_active ? 'bg-green-50' : ''}`}>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{shift.employee_name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1">
                          <span>{shift.type === 'day' ? '☀️' : '🌙'}</span>
                          <span className="text-sm text-gray-600">{getShiftTypeLabel(shift.type)}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">{formatDate(shift.start_time)}</p>
                          <p className="text-gray-500">{formatTime(shift.start_time)}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {shift.end_time ? (
                          <div className="text-sm">
                            <p className="font-medium text-gray-900">{formatDate(shift.end_time)}</p>
                            <p className="text-gray-500">{formatTime(shift.end_time)}</p>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium">{formatCurrency(shift.cash_start)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {shift.cash_end !== null ? (
                          <span className="font-medium">{formatCurrency(shift.cash_end)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-green-600">{formatCurrency(shift.total_sales)}</span>
                        <p className="text-xs text-gray-500">{shift.transactions_count} trans.</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {shift.is_active ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            Activo
                          </span>
                        ) : difference !== null ? (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            difference === 0
                              ? 'bg-green-100 text-green-700'
                              : difference > 0
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-red-100 text-red-700'
                          }`}>
                            {difference === 0 ? 'Cuadrado' : difference > 0 ? `+${formatCurrency(difference)}` : formatCurrency(difference)}
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                            Cerrado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedShift(shift)}
                          className="text-amber-600 hover:text-amber-800 text-sm font-medium"
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {shifts.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No hay turnos en este periodo
            </div>
          )}
        </div>
      )}

      {/* Modal de detalle */}
      {selectedShift && (
        <ShiftDetailModal shift={selectedShift} onClose={() => setSelectedShift(null)} />
      )}
    </div>
  );
}

function ShiftDetailModal({ shift, onClose }: { shift: ShiftSummary; onClose: () => void }) {
  const expectedCash = shift.cash_start + shift.cash_sales + (shift.mixed_cash || 0) - (shift.total_change || 0);
  const difference = shift.cash_end !== null ? shift.cash_end - expectedCash : null;
  const totalTransfers = (shift.transfer_sales || 0) + (shift.mixed_transfer || 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Detalle de Turno</h2>
              <p className="text-sm text-gray-500">{shift.employee_name}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Info básica */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Tipo de turno</p>
                <p className="font-medium flex items-center gap-1">
                  <span>{shift.type === 'day' ? '☀️' : '🌙'}</span>
                  {getShiftTypeLabel(shift.type)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Estado</p>
                <p className="font-medium">
                  {shift.is_active ? (
                    <span className="text-green-600">Activo</span>
                  ) : (
                    <span className="text-gray-600">Cerrado</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Inicio</p>
                <p className="font-medium">{formatDateTime(shift.start_time)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Fin</p>
                <p className="font-medium">
                  {shift.end_time ? formatDateTime(shift.end_time) : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Efectivo */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Efectivo</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Caja inicial</span>
                <span className="font-medium">{formatCurrency(shift.cash_start)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Ventas en efectivo</span>
                <span className="font-medium text-green-600">+{formatCurrency(shift.cash_sales + (shift.mixed_cash || 0))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cambios entregados</span>
                <span className="font-medium text-red-600">-{formatCurrency(shift.total_change || 0)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <span className="font-bold">Efectivo esperado</span>
                <span className="font-bold">{formatCurrency(expectedCash)}</span>
              </div>
              {shift.cash_end !== null && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Efectivo contado</span>
                    <span className="font-medium">{formatCurrency(shift.cash_end)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">Diferencia</span>
                    <span className={`font-bold ${
                      difference === 0 ? 'text-green-600' : difference! > 0 ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {difference! >= 0 ? '+' : ''}{formatCurrency(difference!)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Transferencias */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Transferencias</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Inicial</span>
                <span className="font-medium">{formatCurrency(shift.transfer_start || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Ventas por transferencia</span>
                <span className="font-medium text-green-600">+{formatCurrency(totalTransfers)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <span className="font-bold">Total transferencias</span>
                <span className="font-bold">{formatCurrency((shift.transfer_start || 0) + totalTransfers)}</span>
              </div>
            </div>
          </div>

          {/* Resumen */}
          <div className="bg-amber-50 rounded-xl p-4">
            <h3 className="text-sm font-medium text-amber-800 uppercase tracking-wider mb-3">Resumen del Turno</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-700">Transacciones</span>
                <span className="font-medium">{shift.transactions_count}</span>
              </div>
              {shift.open_tabs_count > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-700">Cuentas abiertas</span>
                  <span className="font-medium text-amber-600">{shift.open_tabs_count}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-amber-200 pt-2">
                <span className="font-bold text-amber-900">Total ventas</span>
                <span className="font-bold text-xl text-amber-900">{formatCurrency(shift.total_sales)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
