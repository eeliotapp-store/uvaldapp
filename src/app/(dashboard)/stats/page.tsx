'use client';

import { useEffect, useState } from 'react';
import { useAuthStore, isOwner } from '@/stores/auth-store';
import { formatCurrency, formatDate, getLocalDate } from '@/lib/utils';
import type { DailyStats, WeeklyStats } from '@/types/database';

interface EmployeeOption {
  id: string;
  name: string;
  active: boolean;
}

interface EmployeeShiftProduct {
  product_name: string;
  quantity: number;
  total: number;
}

interface EmployeeShiftEntry {
  shift_id: string;
  date: string;
  type: 'day' | 'night';
  total: number;
  cash: number;
  transfer: number;
  transactions: number;
  products: EmployeeShiftProduct[];
}

interface EmployeeReportEntry {
  employee_id: string;
  employee_name: string;
  shifts_count: number;
  total_sales: number;
  cash_sales: number;
  transfer_sales: number;
  transactions_count: number;
  shifts: EmployeeShiftEntry[];
}

interface DayOverallEntry {
  dow: number;
  day_name: string;
  sales_count: number;
}

interface DayProductEntry {
  product_name: string;
  day_units: number;
  day_revenue: number;
  pct_of_total: number;
  total_units: number;
}

interface DayOfWeekReport {
  overall: DayOverallEntry[];
  products_by_day: Record<number, DayProductEntry[]>;
  min_units_threshold: number;
}

export default function StatsPage() {
  const employee = useAuthStore((state) => state.employee);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats[]>([]);
  const [view, setView] = useState<'daily' | 'weekly' | 'employee' | 'dayOfWeek'>('daily');
  const [isLoading, setIsLoading] = useState(true);

  // Patrones por día de la semana
  const [dayOfWeekReport, setDayOfWeekReport] = useState<DayOfWeekReport | null>(null);
  const [isLoadingDayOfWeek, setIsLoadingDayOfWeek] = useState(false);
  const [selectedDow, setSelectedDow] = useState(() => new Date().getDay());

  // Reporte por empleada
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(getLocalDate());
  const [employeeReport, setEmployeeReport] = useState<EmployeeReportEntry | null>(null);
  const [isLoadingEmployeeReport, setIsLoadingEmployeeReport] = useState(false);
  const [employeeReportError, setEmployeeReportError] = useState('');
  const [hasSearchedEmployeeReport, setHasSearchedEmployeeReport] = useState(false);

  useEffect(() => {
    loadStats();
    loadEmployeeOptions();
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/reports/stats');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar estadísticas');

      setDailyStats((data.daily as DailyStats[]) || []);
      setWeeklyStats((data.weekly as WeeklyStats[]) || []);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadEmployeeOptions = async () => {
    try {
      const res = await fetch('/api/employees');
      const data = await res.json();
      const options: EmployeeOption[] = (data.employees || []).filter((e: EmployeeOption) => e.active);
      setEmployeeOptions(options);
      if (options.length > 0) setSelectedEmployeeId(options[0].id);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const loadDayOfWeekReport = async () => {
    if (dayOfWeekReport || isLoadingDayOfWeek) return; // ya cargado, no repetir (reporte histórico completo, pesado)
    setIsLoadingDayOfWeek(true);
    try {
      const res = await fetch('/api/reports/day-of-week');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar el reporte');
      setDayOfWeekReport(data as DayOfWeekReport);
    } catch (error) {
      console.error('Error loading day-of-week report:', error);
    } finally {
      setIsLoadingDayOfWeek(false);
    }
  };

  const fetchEmployeeReport = async () => {
    if (!selectedEmployeeId) return;
    setIsLoadingEmployeeReport(true);
    setEmployeeReportError('');
    try {
      const res = await fetch(
        `/api/reports/employees?start_date=${startDate}&end_date=${endDate}&employee_id=${selectedEmployeeId}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar el reporte');
      setEmployeeReport(data.employees?.[0] || null);
    } catch (error) {
      console.error('Error loading employee report:', error);
      setEmployeeReportError('No se pudo cargar el reporte de la empleada');
    } finally {
      setIsLoadingEmployeeReport(false);
      setHasSearchedEmployeeReport(true);
    }
  };

  // Dueños y superadmin pueden ver estadísticas completas
  if (!isOwner(employee?.role)) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No tienes permisos para ver las estadísticas</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Calcular totales
  const todayStats = dailyStats[0];
  const thisWeekStats = weeklyStats[0];

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Estadísticas</h1>

      {/* Resumen rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Hoy"
          value={formatCurrency(todayStats?.total_revenue || 0)}
          subValue={`${todayStats?.total_sales || 0} ventas`}
          color="green"
        />
        <StatCard
          label="Esta semana"
          value={formatCurrency(thisWeekStats?.total_revenue || 0)}
          subValue={`${thisWeekStats?.total_sales || 0} ventas`}
          color="blue"
        />
        <StatCard
          label="Efectivo hoy"
          value={formatCurrency(todayStats?.cash_revenue || 0)}
          color="amber"
        />
        <StatCard
          label="Transferencias hoy"
          value={formatCurrency(todayStats?.transfer_revenue || 0)}
          color="purple"
        />
      </div>

      {/* Selector de vista */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setView('daily')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            view === 'daily'
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Diario
        </button>
        <button
          onClick={() => setView('weekly')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            view === 'weekly'
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Semanal
        </button>
        <button
          onClick={() => setView('employee')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            view === 'employee'
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Por empleada
        </button>
        <button
          onClick={() => {
            setView('dayOfWeek');
            loadDayOfWeekReport();
          }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            view === 'dayOfWeek'
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Por día de la semana
        </button>
      </div>

      {/* Tabla de estadísticas */}
      {view === 'dayOfWeek' ? (
        <DayOfWeekView
          report={dayOfWeekReport}
          isLoading={isLoadingDayOfWeek}
          selectedDow={selectedDow}
          onSelectDow={setSelectedDow}
        />
      ) : view === 'employee' ? (
        <EmployeeShiftsView
          employeeOptions={employeeOptions}
          selectedEmployeeId={selectedEmployeeId}
          onSelectEmployee={setSelectedEmployeeId}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onSearch={fetchEmployeeReport}
          isLoading={isLoadingEmployeeReport}
          error={employeeReportError}
          report={employeeReport}
          hasSearched={hasSearchedEmployeeReport}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {view === 'daily' ? (
            <DailyStatsTable stats={dailyStats} />
          ) : (
            <WeeklyStatsTable stats={weeklyStats} />
          )}
        </div>
      )}
    </div>
  );
}

function EmployeeShiftsView({
  employeeOptions,
  selectedEmployeeId,
  onSelectEmployee,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onSearch,
  isLoading,
  error,
  report,
  hasSearched,
}: {
  employeeOptions: EmployeeOption[];
  selectedEmployeeId: string;
  onSelectEmployee: (id: string) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onSearch: () => void;
  isLoading: boolean;
  error: string;
  report: EmployeeReportEntry | null;
  hasSearched: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Empleada</label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => onSelectEmployee(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {employeeOptions.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={onSearch}
              disabled={isLoading || !selectedEmployeeId}
              className="w-full px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
          {error}
        </div>
      )}

      {!isLoading && !error && !hasSearched && (
        <div className="text-center py-12 text-gray-500 text-sm">
          Selecciona una empleada y un rango de fechas, luego presiona Buscar.
        </div>
      )}

      {!isLoading && !error && hasSearched && report === null && (
        <div className="text-center py-12 text-gray-500 text-sm">
          {employeeOptions.find((e) => e.id === selectedEmployeeId)?.name || 'La empleada'} no registró turnos en ese rango de fechas.
        </div>
      )}

      {report && report.shifts_count > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">{report.employee_name}</h3>
            <span className="text-xl font-bold text-green-700">{formatCurrency(report.total_sales)}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Turnos</p>
              <p className="text-lg font-bold text-gray-800">{report.shifts_count}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Ventas</p>
              <p className="text-lg font-bold text-gray-800">{report.transactions_count}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xs text-green-600">Efectivo</p>
              <p className="text-lg font-bold text-green-700">{formatCurrency(report.cash_sales)}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <p className="text-xs text-purple-600">Transferencias</p>
              <p className="text-lg font-bold text-purple-700">{formatCurrency(report.transfer_sales)}</p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-600">Turnos y productos vendidos</h4>
            {report.shifts.map((shift) => (
              <div key={shift.shift_id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-700">{formatDate(shift.date + 'T12:00:00')}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        shift.type === 'day' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
                      }`}
                    >
                      {shift.type === 'day' ? 'Día' : 'Noche'}
                    </span>
                    <span className="text-xs text-gray-500">{shift.transactions} ventas</span>
                  </div>
                  <span className="font-medium text-gray-800">{formatCurrency(shift.total)}</span>
                </div>

                {shift.products.length > 0 ? (
                  <div className="space-y-1 mt-2">
                    {shift.products.map((p) => (
                      <div
                        key={p.product_name}
                        className="flex items-center justify-between text-sm py-1 px-3 bg-gray-50 rounded-lg"
                      >
                        <span className="text-gray-700">
                          {p.product_name} <span className="text-gray-500">× {p.quantity}</span>
                        </span>
                        <span className="font-medium text-gray-800">{formatCurrency(p.total)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mt-2">Sin productos vendidos en este turno</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DayOfWeekView({
  report,
  isLoading,
  selectedDow,
  onSelectDow,
}: {
  report: DayOfWeekReport | null;
  isLoading: boolean;
  selectedDow: number;
  onSelectDow: (dow: number) => void;
}) {
  if (isLoading || !report) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const maxSales = Math.max(...report.overall.map((d) => d.sales_count), 1);
  const selectedDayName = report.overall.find((d) => d.dow === selectedDow)?.day_name || '';
  const products = report.products_by_day[selectedDow] || [];
  // Plural en español: lunes/martes/miércoles/jueves/viernes ya terminan en "s" y no cambian;
  // solo sábado y domingo agregan "s" (sábados, domingos)
  const dayNameLower = selectedDayName.toLowerCase();
  const dayNamePlural = dayNameLower.endsWith('s') ? dayNameLower : `${dayNameLower}s`;

  return (
    <div className="space-y-6">
      {/* Tabla general: ventas por día, histórico completo */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Ventas por día de la semana</h3>
        <p className="text-xs text-gray-500 mb-4">Histórico completo, todos los turnos registrados</p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-2 text-left text-sm font-medium text-gray-600">Día</th>
                <th className="py-2 text-right text-sm font-medium text-gray-600">Ventas</th>
                <th className="py-2 pl-4 text-left text-sm font-medium text-gray-600 w-1/2">&nbsp;</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {report.overall.map((d) => (
                <tr
                  key={d.dow}
                  className={d.dow === selectedDow ? 'bg-amber-50' : ''}
                >
                  <td className="py-2 text-sm text-gray-800 font-medium">{d.day_name}</td>
                  <td className="py-2 text-sm text-right text-gray-800">{d.sales_count}</td>
                  <td className="py-2 pl-4">
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${(d.sales_count / maxSales) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selector de día */}
      <div className="flex flex-wrap gap-2">
        {report.overall.map((d) => (
          <button
            key={d.dow}
            onClick={() => onSelectDow(d.dow)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              d.dow === selectedDow
                ? 'bg-amber-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {d.day_name}
          </button>
        ))}
      </div>

      {/* Productos que más se disparan el día seleccionado */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Productos que más se venden en {selectedDayName}</h3>
        <p className="text-xs text-gray-500 mb-1">
          % de las ventas históricas de cada producto que caen justo en este día (lo esperado sin ningún patrón sería ~14%).
          &quot;Unidades en todos los {dayNamePlural}&quot; es la <strong>suma de todos los {dayNamePlural}</strong> del historial (no un solo día puntual).
          Excluye productos dentro de combos y los que tienen menos de {report.min_units_threshold} unidades vendidas en total.
        </p>
        <p className="text-xs text-gray-500 mb-4 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-700 text-white">🔥 Fuerte</span>
            duplica o más lo esperado (≥28%) — acción clara
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="text-green-700 font-bold">↑ Notable</span>
            50% por encima de lo esperado (≥21%)
          </span>
        </p>
        {products.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No hay suficientes datos para {selectedDayName}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-2 text-left text-sm font-medium text-gray-600">Producto</th>
                  <th className="py-2 text-right text-sm font-medium text-gray-600">% en {selectedDayName}</th>
                  <th className="py-2 text-right text-sm font-medium text-gray-600">Unidades en todos los {dayNamePlural}</th>
                  <th className="py-2 text-right text-sm font-medium text-gray-600">Total histórico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map((p) => {
                  // Baseline sin ningún patrón: 1/7 de los días ≈ 14.3%
                  const strong = p.pct_of_total >= 28.6; // el doble o más
                  const notable = !strong && p.pct_of_total >= 21.4; // 1.5x o más
                  return (
                    <tr key={p.product_name} className={strong ? 'bg-green-50' : ''}>
                      <td className="py-2 text-sm text-gray-800">{p.product_name}</td>
                      <td className="py-2 text-sm text-right">
                        <span className={`font-bold ${strong || notable ? 'text-green-700' : 'text-gray-800'}`}>
                          {p.pct_of_total}%
                        </span>
                        {strong && (
                          <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-700 text-white align-middle">
                            🔥 Fuerte
                          </span>
                        )}
                        {notable && (
                          <span className="ml-2 text-[10px] font-bold text-green-700 align-middle">↑ Notable</span>
                        )}
                      </td>
                      <td className="py-2 text-sm text-right text-gray-800">{p.day_units}</td>
                      <td className="py-2 text-sm text-right text-gray-500">{p.total_units}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subValue,
  color,
}: {
  label: string;
  value: string;
  subValue?: string;
  color: 'green' | 'blue' | 'amber' | 'purple';
}) {
  const colors = {
    green: 'bg-green-50 border-green-200',
    blue: 'bg-blue-50 border-blue-200',
    amber: 'bg-amber-50 border-amber-200',
    purple: 'bg-purple-50 border-purple-200',
  };

  const textColors = {
    green: 'text-green-700',
    blue: 'text-blue-700',
    amber: 'text-amber-700',
    purple: 'text-purple-700',
  };

  return (
    <div className={`p-4 rounded-xl border ${colors[color]}`}>
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p className={`text-xl font-bold ${textColors[color]}`}>{value}</p>
      {subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}
    </div>
  );
}

function DailyStatsTable({ stats }: { stats: DailyStats[] }) {
  if (stats.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No hay datos disponibles
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Fecha</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Ventas</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Efectivo</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Transfer.</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {stats.map((stat, index) => (
            <tr key={stat.date} className={index === 0 ? 'bg-green-50' : ''}>
              <td className="px-4 py-3 text-sm">
                {index === 0 ? (
                  <span className="font-medium text-green-700">Hoy</span>
                ) : (
                  formatDate(stat.date)
                )}
              </td>
              <td className="px-4 py-3 text-sm text-right">{stat.total_sales}</td>
              <td className="px-4 py-3 text-sm text-right">{formatCurrency(stat.cash_revenue)}</td>
              <td className="px-4 py-3 text-sm text-right">{formatCurrency(stat.transfer_revenue)}</td>
              <td className="px-4 py-3 text-sm text-right font-bold">
                {formatCurrency(stat.total_revenue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WeeklyStatsTable({ stats }: { stats: WeeklyStats[] }) {
  if (stats.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No hay datos disponibles
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Semana</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Días</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Ventas</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Efectivo</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Transfer.</th>
            <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {stats.map((stat, index) => (
            <tr key={stat.week_start} className={index === 0 ? 'bg-blue-50' : ''}>
              <td className="px-4 py-3 text-sm">
                {index === 0 ? (
                  <span className="font-medium text-blue-700">Esta semana</span>
                ) : (
                  `${formatDate(stat.week_start)} - ${formatDate(stat.week_end)}`
                )}
              </td>
              <td className="px-4 py-3 text-sm text-right">{stat.days_worked}</td>
              <td className="px-4 py-3 text-sm text-right">{stat.total_sales}</td>
              <td className="px-4 py-3 text-sm text-right">{formatCurrency(stat.cash_revenue)}</td>
              <td className="px-4 py-3 text-sm text-right">{formatCurrency(stat.transfer_revenue)}</td>
              <td className="px-4 py-3 text-sm text-right font-bold">
                {formatCurrency(stat.total_revenue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
