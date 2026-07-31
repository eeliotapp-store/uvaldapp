'use client';

import { useEffect, useState } from 'react';
import { useAuthStore, isOwner } from '@/stores/auth-store';
import { formatCurrency, formatDate, getLocalDate } from '@/lib/utils';
import type { DailyStats, WeeklyStats, MonthlyStats } from '@/types/database';

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
  total_units: number;
  shifts: EmployeeShiftEntry[];
}

const ALL_EMPLOYEES_VALUE = '__all__';

interface DayOverallEntry {
  dow: number;
  day_name: string;
  sales_count: number;
  occurrences: number;
  avg_sales_count: number;
}

interface DayProductEntry {
  product_name: string;
  day_units: number;
  day_revenue: number;
  pct_of_total: number;
  total_units: number;
  avg_units: number;
}

interface DayOfWeekReport {
  overall: DayOverallEntry[];
  products_by_day: Record<number, DayProductEntry[]>;
  min_units_threshold: number;
}

interface InventoryTurnoverReport {
  start_date: string;
  end_date: string;
  cogs: number;
  inventory_value_at_cost: number;
  turnover: number | null;
  excluded_units_sold: number;
  products_without_cost: string[];
}

interface ReorderProduct {
  product_id: string;
  product_name: string;
  category: string;
  current_stock: number;
  min_stock: number;
  units_last_30_days: number;
  daily_velocity: number;
  days_remaining: number;
  suggested_reorder: number;
}

interface ReorderNoMovementProduct {
  product_id: string;
  product_name: string;
  category: string;
  current_stock: number;
}

interface ReorderForecastReport {
  lookback_days: number;
  target_coverage_days: number;
  products: ReorderProduct[];
  products_without_recent_sales: ReorderNoMovementProduct[];
}

type TrendStatus = 'up' | 'down' | 'flat' | 'new' | 'stopped';

interface Trend {
  current: number;
  previous: number;
  pct_change: number | null;
  status: TrendStatus;
}

interface ProductTrendEntry {
  product_name: string;
  current_units: number;
  previous_units: number;
  pct_change: number | null;
  status: TrendStatus;
}

interface SalesTrendReport {
  overall: { week: Trend; month: Trend };
  products: { week: ProductTrendEntry[]; month: ProductTrendEntry[] };
  min_units_threshold: number;
}

export default function StatsPage() {
  const employee = useAuthStore((state) => state.employee);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [view, setView] = useState<'daily' | 'weekly' | 'employee' | 'dayOfWeek' | 'turnover' | 'reorder' | 'trend'>('daily');
  const [isLoading, setIsLoading] = useState(true);

  // Patrones por día de la semana
  const [dayOfWeekReport, setDayOfWeekReport] = useState<DayOfWeekReport | null>(null);
  const [isLoadingDayOfWeek, setIsLoadingDayOfWeek] = useState(false);
  const [selectedDow, setSelectedDow] = useState(() => new Date().getDay());

  // Pronóstico de reabastecimiento
  const [reorderReport, setReorderReport] = useState<ReorderForecastReport | null>(null);
  const [isLoadingReorder, setIsLoadingReorder] = useState(false);

  // Tendencia de ventas
  const [trendReport, setTrendReport] = useState<SalesTrendReport | null>(null);
  const [isLoadingTrend, setIsLoadingTrend] = useState(false);
  const [trendPeriod, setTrendPeriod] = useState<'week' | 'month'>('week');

  // Reporte por empleada
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(ALL_EMPLOYEES_VALUE);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(getLocalDate());
  const [employeeReport, setEmployeeReport] = useState<EmployeeReportEntry | null>(null);
  const [employeesRanking, setEmployeesRanking] = useState<EmployeeReportEntry[] | null>(null);
  const [rankingSortBy, setRankingSortBy] = useState<'sales' | 'units' | 'avg_ticket'>('sales');
  const [isLoadingEmployeeReport, setIsLoadingEmployeeReport] = useState(false);
  const [employeeReportError, setEmployeeReportError] = useState('');
  const [hasSearchedEmployeeReport, setHasSearchedEmployeeReport] = useState(false);

  // Rotación de inventario
  const [turnoverStartDate, setTurnoverStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [turnoverEndDate, setTurnoverEndDate] = useState(getLocalDate());
  const [turnoverReport, setTurnoverReport] = useState<InventoryTurnoverReport | null>(null);
  const [isLoadingTurnover, setIsLoadingTurnover] = useState(false);
  const [turnoverError, setTurnoverError] = useState('');
  const [hasSearchedTurnover, setHasSearchedTurnover] = useState(false);

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
      setMonthlyStats((data.monthly as MonthlyStats[]) || []);
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

  const loadReorderReport = async () => {
    if (reorderReport || isLoadingReorder) return; // ya cargado, no repetir
    setIsLoadingReorder(true);
    try {
      const res = await fetch('/api/reports/reorder-forecast');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar el reporte');
      setReorderReport(data as ReorderForecastReport);
    } catch (error) {
      console.error('Error loading reorder forecast:', error);
    } finally {
      setIsLoadingReorder(false);
    }
  };

  const loadTrendReport = async () => {
    if (trendReport || isLoadingTrend) return; // ya cargado, no repetir
    setIsLoadingTrend(true);
    try {
      const res = await fetch('/api/reports/sales-trend');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar el reporte');
      setTrendReport(data as SalesTrendReport);
    } catch (error) {
      console.error('Error loading sales trend:', error);
    } finally {
      setIsLoadingTrend(false);
    }
  };

  const fetchEmployeeReport = async () => {
    const isAll = selectedEmployeeId === ALL_EMPLOYEES_VALUE;
    setIsLoadingEmployeeReport(true);
    setEmployeeReportError('');
    try {
      const url = isAll
        ? `/api/reports/employees?start_date=${startDate}&end_date=${endDate}`
        : `/api/reports/employees?start_date=${startDate}&end_date=${endDate}&employee_id=${selectedEmployeeId}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar el reporte');

      if (isAll) {
        setEmployeesRanking((data.employees as EmployeeReportEntry[]) || []);
        setEmployeeReport(null);
      } else {
        setEmployeeReport(data.employees?.[0] || null);
        setEmployeesRanking(null);
      }
    } catch (error) {
      console.error('Error loading employee report:', error);
      setEmployeeReportError('No se pudo cargar el reporte de la empleada');
    } finally {
      setIsLoadingEmployeeReport(false);
      setHasSearchedEmployeeReport(true);
    }
  };

  const fetchTurnoverReport = async () => {
    setIsLoadingTurnover(true);
    setTurnoverError('');
    try {
      const res = await fetch(
        `/api/reports/inventory-turnover?start_date=${turnoverStartDate}&end_date=${turnoverEndDate}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar el reporte');
      setTurnoverReport(data as InventoryTurnoverReport);
    } catch (error) {
      console.error('Error loading turnover report:', error);
      setTurnoverError('No se pudo cargar la rotación de inventario');
    } finally {
      setIsLoadingTurnover(false);
      setHasSearchedTurnover(true);
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
        <button
          onClick={() => setView('turnover')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            view === 'turnover'
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Rotación de inventario
        </button>
        <button
          onClick={() => {
            setView('reorder');
            loadReorderReport();
          }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            view === 'reorder'
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Reabastecimiento
        </button>
        <button
          onClick={() => {
            setView('trend');
            loadTrendReport();
          }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            view === 'trend'
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Tendencia
        </button>
      </div>

      {/* Tabla de estadísticas */}
      {view === 'trend' ? (
        <SalesTrendView
          report={trendReport}
          isLoading={isLoadingTrend}
          period={trendPeriod}
          onPeriodChange={setTrendPeriod}
          weeklyStats={weeklyStats}
          monthlyStats={monthlyStats}
        />
      ) : view === 'reorder' ? (
        <ReorderForecastView report={reorderReport} isLoading={isLoadingReorder} />
      ) : view === 'turnover' ? (
        <InventoryTurnoverView
          startDate={turnoverStartDate}
          endDate={turnoverEndDate}
          onStartDateChange={setTurnoverStartDate}
          onEndDateChange={setTurnoverEndDate}
          onSearch={fetchTurnoverReport}
          isLoading={isLoadingTurnover}
          error={turnoverError}
          report={turnoverReport}
          hasSearched={hasSearchedTurnover}
        />
      ) : view === 'dayOfWeek' ? (
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
          ranking={employeesRanking}
          rankingSortBy={rankingSortBy}
          onRankingSortByChange={setRankingSortBy}
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
  ranking,
  rankingSortBy,
  onRankingSortByChange,
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
  ranking: EmployeeReportEntry[] | null;
  rankingSortBy: 'sales' | 'units' | 'avg_ticket';
  onRankingSortByChange: (sortBy: 'sales' | 'units' | 'avg_ticket') => void;
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
              <option value={ALL_EMPLOYEES_VALUE}>Todas las empleadas</option>
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

      {selectedEmployeeId !== ALL_EMPLOYEES_VALUE && !isLoading && !error && hasSearched && report === null && (
        <div className="text-center py-12 text-gray-500 text-sm">
          {employeeOptions.find((e) => e.id === selectedEmployeeId)?.name || 'La empleada'} no registró turnos en ese rango de fechas.
        </div>
      )}

      {selectedEmployeeId === ALL_EMPLOYEES_VALUE && !isLoading && !error && hasSearched && ranking && ranking.length === 0 && (
        <div className="text-center py-12 text-gray-500 text-sm">
          Ninguna empleada registró turnos en ese rango de fechas.
        </div>
      )}

      {selectedEmployeeId === ALL_EMPLOYEES_VALUE && ranking && ranking.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Ranking de empleadas</h3>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => onRankingSortByChange('sales')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  rankingSortBy === 'sales' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                Por ventas ($)
              </button>
              <button
                onClick={() => onRankingSortByChange('units')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  rankingSortBy === 'units' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                Por unidades vendidas
              </button>
              <button
                onClick={() => onRankingSortByChange('avg_ticket')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  rankingSortBy === 'avg_ticket' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                Por ticket promedio
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Ticket promedio = total vendido ÷ número de ventas. Indica cuánto deja en promedio cada cliente atendido — útil para comparar más allá de quién vendió más en total.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-2 text-left text-sm font-medium text-gray-600">#</th>
                  <th className="py-2 text-left text-sm font-medium text-gray-600">Empleada</th>
                  <th className="py-2 text-right text-sm font-medium text-gray-600">Turnos</th>
                  <th className="py-2 text-right text-sm font-medium text-gray-600">Unidades vendidas</th>
                  <th className="py-2 text-right text-sm font-medium text-gray-600">Total ventas</th>
                  <th className="py-2 text-right text-sm font-medium text-gray-600">Ticket promedio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...ranking]
                  .map((emp) => ({
                    ...emp,
                    avg_ticket: emp.transactions_count > 0 ? emp.total_sales / emp.transactions_count : 0,
                  }))
                  .sort((a, b) => {
                    if (rankingSortBy === 'sales') return b.total_sales - a.total_sales;
                    if (rankingSortBy === 'units') return b.total_units - a.total_units;
                    return b.avg_ticket - a.avg_ticket;
                  })
                  .map((emp, index) => (
                    <tr key={emp.employee_id} className={index === 0 ? 'bg-green-50' : ''}>
                      <td className="py-2 text-sm text-gray-500">{index + 1}</td>
                      <td className="py-2 text-sm text-gray-800 font-medium">
                        {index === 0 && '🏆 '}
                        {emp.employee_name}
                      </td>
                      <td className="py-2 text-sm text-right text-gray-800">{emp.shifts_count}</td>
                      <td
                        className={`py-2 text-sm text-right ${
                          rankingSortBy === 'units' ? 'font-bold text-green-700' : 'text-gray-800'
                        }`}
                      >
                        {emp.total_units}
                      </td>
                      <td
                        className={`py-2 text-sm text-right ${
                          rankingSortBy === 'sales' ? 'font-bold text-green-700' : 'text-gray-800'
                        }`}
                      >
                        {formatCurrency(emp.total_sales)}
                      </td>
                      <td
                        className={`py-2 text-sm text-right ${
                          rankingSortBy === 'avg_ticket' ? 'font-bold text-green-700' : 'text-gray-800'
                        }`}
                      >
                        {formatCurrency(emp.avg_ticket)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedEmployeeId !== ALL_EMPLOYEES_VALUE && report && report.shifts_count > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">{report.employee_name}</h3>
            <span className="text-xl font-bold text-green-700">{formatCurrency(report.total_sales)}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Turnos</p>
              <p className="text-lg font-bold text-gray-800">{report.shifts_count}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500">Ventas</p>
              <p className="text-lg font-bold text-gray-800">{report.transactions_count}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-xs text-amber-600">Ticket promedio</p>
              <p className="text-lg font-bold text-amber-700">
                {formatCurrency(report.transactions_count > 0 ? report.total_sales / report.transactions_count : 0)}
              </p>
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

  const todayDow = new Date().getDay();
  const today = report.overall.find((d) => d.dow === todayDow);
  const todayProducts = [...(report.products_by_day[todayDow] || [])]
    .sort((a, b) => b.avg_units - a.avg_units)
    .slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Predicción para hoy */}
      {today && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-1">Predicción para hoy — {today.day_name}</h3>
          <p className="text-xs text-blue-800 mb-4">
            Promedio histórico basado en {today.occurrences} {today.day_name.toLowerCase()}
            {today.day_name.toLowerCase().endsWith('s') ? '' : 's'} anteriores. No es un pronóstico con tendencia,
            solo el promedio de lo que ha pasado hasta ahora en este día de la semana.
          </p>
          <p className="text-3xl font-bold text-blue-900 mb-4">
            ~{today.avg_sales_count} <span className="text-base font-medium text-blue-700">ventas esperadas hoy</span>
          </p>
          {todayProducts.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {todayProducts.map((p) => (
                <div key={p.product_name} className="bg-white rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500 truncate" title={p.product_name}>
                    {p.product_name}
                  </p>
                  <p className="text-lg font-bold text-blue-900">~{p.avg_units}</p>
                  <p className="text-[10px] text-gray-400">unidades</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
                  <th className="py-2 text-right text-sm font-medium text-gray-600">Promedio por {dayNameLower}</th>
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
                      <td className="py-2 text-sm text-right text-blue-700 font-medium">~{p.avg_units}</td>
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

function InventoryTurnoverView({
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
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onSearch: () => void;
  isLoading: boolean;
  error: string;
  report: InventoryTurnoverReport | null;
  hasSearched: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
              disabled={isLoading}
              className="w-full px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Calculando...' : 'Calcular'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>
      )}

      {!isLoading && !error && !hasSearched && (
        <div className="text-center py-12 text-gray-500 text-sm">
          Elige un rango de fechas y presiona Calcular.
        </div>
      )}

      {report && (
        <>
          {/* Número principal */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm text-gray-500 mb-1">Rotación de inventario (aproximada)</p>
            {report.turnover === null ? (
              <p className="text-lg font-bold text-gray-800">
                No se pudo calcular — el inventario valorizado a costo es $0. Revisa que tus productos tengan costo de compra y stock registrado.
              </p>
            ) : (
              <p className="text-4xl font-bold text-amber-700">
                {report.turnover.toLocaleString('es-CO', { maximumFractionDigits: 2 })}{' '}
                <span className="text-lg font-medium text-gray-500">veces</span>
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Costo de lo vendido en el rango</p>
                <p className="text-lg font-bold text-gray-800">{formatCurrency(report.cogs)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Inventario actual (valorizado a costo)</p>
                <p className="text-lg font-bold text-gray-800">{formatCurrency(report.inventory_value_at_cost)}</p>
              </div>
            </div>
          </div>

          {/* Cómo leerlo */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 space-y-3">
            <h3 className="text-sm font-bold text-amber-900">¿Cómo se lee este número?</h3>
            <p className="text-sm text-amber-900">
              La rotación te dice cuántas veces &quot;diste la vuelta&quot; a tu inventario en el rango de fechas que
              elegiste — es decir, cuántas veces vendiste el equivalente al valor de lo que tienes hoy en existencias.
            </p>
            <ul className="text-sm text-amber-900 list-disc list-inside space-y-1">
              <li>
                <strong>Número alto</strong> = tu plata se mueve rápido: compras, vendes, repones. Es señal de buen
                flujo de caja.
              </li>
              <li>
                <strong>Número bajo (menor a 1)</strong> = tienes plata &quot;quieta&quot; guardada en productos que no
                se están vendiendo al ritmo de tu inventario. Vale la pena revisar si hay algo estancado.
              </li>
            </ul>
            {report.turnover !== null && (
              <p className="text-sm text-amber-900 bg-amber-100 rounded-lg p-3">
                En tu caso: vendiste {formatCurrency(report.cogs)} en costo de mercancía, y tu inventario actual vale{' '}
                {formatCurrency(report.inventory_value_at_cost)} a costo → rotaste tu inventario{' '}
                <strong>{report.turnover.toLocaleString('es-CO', { maximumFractionDigits: 2 })} veces</strong> en este
                período.
              </p>
            )}
          </div>

          {/* Transparencia de datos */}
          {report.products_without_cost.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-600 mb-1">
                <strong>{report.products_without_cost.length} producto(s) sin costo de compra registrado</strong> — no
                se incluyeron en este cálculo (ni en ventas ni en inventario)
                {report.excluded_units_sold > 0 && (
                  <> · se excluyeron {report.excluded_units_sold} unidades vendidas en el rango</>
                )}
                :
              </p>
              <p className="text-xs text-gray-500">{report.products_without_cost.join(', ')}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReorderForecastView({
  report,
  isLoading,
}: {
  report: ReorderForecastReport | null;
  isLoading: boolean;
}) {
  if (isLoading || !report) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Pronóstico de reabastecimiento</h3>
        <p className="text-xs text-gray-500 mb-4">
          Calculado con el ritmo de ventas de los últimos {report.lookback_days} días. &quot;Comprar sugerido&quot; es
          la cantidad para llegar a cubrir {report.target_coverage_days} días de colchón al ritmo actual — ajústalo
          según tus tiempos reales de entrega del proveedor.
        </p>
        <p className="text-xs text-gray-500 mb-4 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-700 text-white">
              🔴 Urgente
            </span>
            se acaba en menos de 7 días
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
              🟡 Pronto
            </span>
            se acaba entre 7 y 14 días
          </span>
        </p>

        {report.products.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No hay suficientes ventas recientes para calcular un pronóstico.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-2 text-left text-sm font-medium text-gray-600">Producto</th>
                  <th className="py-2 text-right text-sm font-medium text-gray-600">Stock actual</th>
                  <th className="py-2 text-right text-sm font-medium text-gray-600">Venta/día</th>
                  <th className="py-2 text-right text-sm font-medium text-gray-600">Días restantes</th>
                  <th className="py-2 text-right text-sm font-medium text-gray-600">Comprar sugerido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {report.products.map((p) => {
                  const urgent = p.days_remaining < 7;
                  const soon = !urgent && p.days_remaining < 14;
                  return (
                    <tr key={p.product_id} className={urgent ? 'bg-red-50' : ''}>
                      <td className="py-2 text-sm text-gray-800">{p.product_name}</td>
                      <td className="py-2 text-sm text-right text-gray-800">{p.current_stock}</td>
                      <td className="py-2 text-sm text-right text-gray-500">{p.daily_velocity}</td>
                      <td className="py-2 text-sm text-right">
                        <span
                          className={`font-bold ${
                            urgent ? 'text-red-700' : soon ? 'text-amber-700' : 'text-gray-800'
                          }`}
                        >
                          {p.days_remaining}
                        </span>
                        {urgent && (
                          <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-700 text-white align-middle">
                            🔴 Urgente
                          </span>
                        )}
                        {soon && (
                          <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 align-middle">
                            🟡 Pronto
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-sm text-right font-medium text-gray-800">
                        {p.suggested_reorder > 0 ? p.suggested_reorder : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {report.products_without_recent_sales.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-600 mb-1">
            <strong>{report.products_without_recent_sales.length} producto(s) con stock pero sin ventas</strong> en
            los últimos {report.lookback_days} días — candidatos a revisar (posible sobre-stock o producto que ya no
            se mueve):
          </p>
          <p className="text-xs text-gray-500">
            {report.products_without_recent_sales.map((p) => `${p.product_name} (${p.current_stock})`).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}

function TrendBadge({ trend, size = 'sm' }: { trend: Trend | ProductTrendEntry; size?: 'sm' | 'lg' }) {
  const big = size === 'lg';
  if (trend.status === 'new') {
    return (
      <span className={`inline-block px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700 ${big ? 'text-sm' : 'text-[10px]'}`}>
        🆕 Nuevo
      </span>
    );
  }
  if (trend.status === 'stopped') {
    return (
      <span className={`inline-block px-2 py-0.5 rounded-full font-bold bg-gray-200 text-gray-600 ${big ? 'text-sm' : 'text-[10px]'}`}>
        ⛔ Dejó de venderse
      </span>
    );
  }
  const color = trend.status === 'up' ? 'text-green-700' : trend.status === 'down' ? 'text-red-700' : 'text-gray-500';
  const arrow = trend.status === 'up' ? '▲' : trend.status === 'down' ? '▼' : '—';
  return (
    <span className={`font-bold ${color} ${big ? 'text-lg' : 'text-sm'}`}>
      {arrow} {trend.pct_change !== null ? `${Math.abs(trend.pct_change)}%` : '—'}
    </span>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Formato compacto para etiquetas sobre barras angostas: $20.7M, $850K
function formatCompactCOP(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

function RevenueBarChart({ title, bars }: { title: string; bars: { label: string; value: number }[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const maxValue = Math.max(...bars.map((b) => b.value), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-bold text-gray-900 mb-4">{title}</h3>
      {bars.length === 0 ? (
        <p className="text-sm text-gray-500">No hay suficientes datos todavía.</p>
      ) : (
        <div className="flex items-end justify-around gap-2 h-48">
          {bars.map((b, i) => {
            const heightPct = Math.max((b.value / maxValue) * 100, 2);
            const isHovered = hoverIndex === i;
            return (
              <div
                key={b.label}
                className="flex flex-col items-center justify-end h-full flex-1 relative outline-none"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                onFocus={() => setHoverIndex(i)}
                onBlur={() => setHoverIndex(null)}
                tabIndex={0}
              >
                {isHovered && (
                  <div className="absolute -top-9 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                    {formatCurrency(b.value)}
                  </div>
                )}
                <span className="text-[11px] font-medium text-gray-700 mb-1">{formatCompactCOP(b.value)}</span>
                <div
                  className={`w-full max-w-[24px] rounded-t transition-colors ${isHovered ? 'bg-amber-600' : 'bg-amber-500'}`}
                  style={{ height: `${heightPct}%` }}
                />
                <span className="text-[10px] text-gray-500 mt-2">{b.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SalesTrendView({
  report,
  isLoading,
  period,
  onPeriodChange,
  weeklyStats,
  monthlyStats,
}: {
  report: SalesTrendReport | null;
  isLoading: boolean;
  period: 'week' | 'month';
  onPeriodChange: (period: 'week' | 'month') => void;
  weeklyStats: WeeklyStats[];
  monthlyStats: MonthlyStats[];
}) {
  if (isLoading || !report) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const overall = report.overall[period];
  const products = report.products[period];
  const gainers = products.filter((p) => p.status === 'up').sort((a, b) => (b.pct_change ?? 0) - (a.pct_change ?? 0)).slice(0, 8);
  const decliners = products.filter((p) => p.status === 'down').sort((a, b) => (a.pct_change ?? 0) - (b.pct_change ?? 0)).slice(0, 8);
  const newProducts = products.filter((p) => p.status === 'new');
  const stoppedProducts = products.filter((p) => p.status === 'stopped');
  const periodLabel = period === 'week' ? 'últimos 7 días' : 'últimos 30 días';
  const previousLabel = period === 'week' ? '7 días anteriores' : '30 días anteriores';

  const monthBars = [...monthlyStats]
    .slice(0, 6)
    .reverse()
    .map((m) => ({
      label: capitalize(new Date(`${m.month_start}T12:00:00`).toLocaleDateString('es-CO', { month: 'short' }).replace('.', '')),
      value: m.total_revenue,
    }));

  const weekBars = [...weeklyStats]
    .slice(0, 4)
    .reverse()
    .map((w) => ({
      label: new Date(`${w.week_start}T12:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' }),
      value: w.total_revenue,
    }));

  return (
    <div className="space-y-6">
      {/* Historial visual: últimos 6 meses y últimas 4 semanas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RevenueBarChart title="Ventas por mes — últimos 6 meses" bars={monthBars} />
        <RevenueBarChart title="Ventas por semana — últimas 4 semanas" bars={weekBars} />
      </div>

      {/* Selector de período */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => onPeriodChange('week')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            period === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          Semana
        </button>
        <button
          onClick={() => onPeriodChange('month')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            period === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          Mes
        </button>
      </div>

      {/* Tendencia general */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-sm text-gray-500 mb-1">Ventas totales — {periodLabel} vs. {previousLabel}</p>
        <div className="flex items-baseline gap-3 flex-wrap">
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(overall.current)}</p>
          <TrendBadge trend={overall} size="lg" />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Período anterior: {formatCurrency(overall.previous)}
        </p>
      </div>

      <p className="text-xs text-gray-500">
        Compara unidades vendidas (no $, porque un cambio de precio no significa que guste más o menos). Excluye
        productos dentro de combos. Solo se muestran productos con al menos {report.min_units_threshold} unidades
        combinadas entre ambos períodos, para evitar ruido estadístico.
      </p>

      {/* Subiendo / bajando */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-bold text-gray-900 mb-3">📈 Ganando terreno</h3>
          {gainers.length === 0 ? (
            <p className="text-sm text-gray-500">No hay productos con crecimiento notable en este período.</p>
          ) : (
            <div className="space-y-1">
              {gainers.map((p) => (
                <div key={p.product_name} className="flex items-center justify-between text-sm py-1.5 px-3 bg-green-50 rounded-lg">
                  <span className="text-gray-800">
                    {p.product_name} <span className="text-gray-400">({p.previous_units} → {p.current_units})</span>
                  </span>
                  <TrendBadge trend={p} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-bold text-gray-900 mb-3">📉 Perdiendo terreno</h3>
          {decliners.length === 0 ? (
            <p className="text-sm text-gray-500">No hay productos con caída notable en este período.</p>
          ) : (
            <div className="space-y-1">
              {decliners.map((p) => (
                <div key={p.product_name} className="flex items-center justify-between text-sm py-1.5 px-3 bg-red-50 rounded-lg">
                  <span className="text-gray-800">
                    {p.product_name} <span className="text-gray-400">({p.previous_units} → {p.current_units})</span>
                  </span>
                  <TrendBadge trend={p} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {(newProducts.length > 0 || stoppedProducts.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {newProducts.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs font-bold text-blue-900 mb-1">🆕 Nuevos en este período</p>
              <p className="text-xs text-blue-800">
                {newProducts.map((p) => `${p.product_name} (${p.current_units})`).join(', ')}
              </p>
            </div>
          )}
          {stoppedProducts.length > 0 && (
            <div className="bg-gray-100 border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-bold text-gray-700 mb-1">⛔ Dejaron de venderse</p>
              <p className="text-xs text-gray-600">
                {stoppedProducts.map((p) => `${p.product_name} (vendía ${p.previous_units})`).join(', ')}
              </p>
            </div>
          )}
        </div>
      )}
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
