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

type ViewKey = 'daily' | 'weekly' | 'employee' | 'dayOfWeek' | 'monthCycle' | 'turnover' | 'reorder' | 'trend' | 'concentration';

interface DayOverallEntry {
  dow: number;
  day_name: string;
  sales_count: number;
  revenue: number;
  occurrences: number;
  avg_sales_count: number;
  avg_revenue: number;
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

interface DomEntry {
  dom: number;
  sales_count: number;
  revenue: number;
  occurrences: number;
  avg_sales_count: number;
  avg_revenue: number;
}

interface WeekOfMonthEntry {
  week_bucket: number;
  label: string;
  sales_count: number;
  revenue: number;
  occurrences: number;
  avg_sales_count: number;
  avg_revenue: number;
}

interface MonthCycleReport {
  by_day: DomEntry[];
  by_week: WeekOfMonthEntry[];
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

interface ConcentrationItem {
  product_name: string;
  revenue: number;
  pct_of_total: number;
  cumulative_pct: number;
}

interface ConcentrationBucket {
  total_revenue: number;
  items: ConcentrationItem[];
  products_for_50pct: number;
  products_for_80pct: number;
}

interface RevenueConcentrationReport {
  week: ConcentrationBucket;
  month: ConcentrationBucket;
}

function ViewArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function ViewClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ViewCalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function ViewUsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function ViewBarsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function ViewRefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function ViewBoxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function ViewTrendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function ViewTagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}

function ViewCoinCalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h4m-4 8h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 16a2 2 0 100-4 2 2 0 000 4z" />
    </svg>
  );
}

export default function StatsPage() {
  const employee = useAuthStore((state) => state.employee);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [view, setView] = useState<ViewKey | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Patrones por día de la semana
  const [dayOfWeekReport, setDayOfWeekReport] = useState<DayOfWeekReport | null>(null);
  const [isLoadingDayOfWeek, setIsLoadingDayOfWeek] = useState(false);
  const [selectedDow, setSelectedDow] = useState(() => new Date().getDay());

  // Patrones por día/semana del mes (quincena)
  const [monthCycleReport, setMonthCycleReport] = useState<MonthCycleReport | null>(null);
  const [isLoadingMonthCycle, setIsLoadingMonthCycle] = useState(false);

  // Pronóstico de reabastecimiento
  const [reorderReport, setReorderReport] = useState<ReorderForecastReport | null>(null);
  const [isLoadingReorder, setIsLoadingReorder] = useState(false);

  // Tendencia de ventas
  const [trendReport, setTrendReport] = useState<SalesTrendReport | null>(null);
  const [isLoadingTrend, setIsLoadingTrend] = useState(false);
  const [trendPeriod, setTrendPeriod] = useState<'week' | 'month'>('week');

  // Concentración de ingresos (Pareto de productos)
  const [concentrationReport, setConcentrationReport] = useState<RevenueConcentrationReport | null>(null);
  const [isLoadingConcentration, setIsLoadingConcentration] = useState(false);
  const [concentrationPeriod, setConcentrationPeriod] = useState<'week' | 'month'>('month');

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

  const loadMonthCycleReport = async () => {
    if (monthCycleReport || isLoadingMonthCycle) return; // ya cargado, no repetir (reporte histórico completo, pesado)
    setIsLoadingMonthCycle(true);
    try {
      const res = await fetch('/api/reports/day-of-month');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar el reporte');
      setMonthCycleReport(data as MonthCycleReport);
    } catch (error) {
      console.error('Error loading month-cycle report:', error);
    } finally {
      setIsLoadingMonthCycle(false);
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

  const loadConcentrationReport = async () => {
    if (concentrationReport || isLoadingConcentration) return; // ya cargado, no repetir
    setIsLoadingConcentration(true);
    try {
      const res = await fetch('/api/reports/revenue-concentration');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar el reporte');
      setConcentrationReport(data as RevenueConcentrationReport);
    } catch (error) {
      console.error('Error loading revenue concentration:', error);
    } finally {
      setIsLoadingConcentration(false);
    }
  };

  const handleSelectView = (key: ViewKey) => {
    setView(key);
    if (key === 'dayOfWeek') loadDayOfWeekReport();
    else if (key === 'monthCycle') loadMonthCycleReport();
    else if (key === 'reorder') loadReorderReport();
    else if (key === 'trend') loadTrendReport();
    else if (key === 'concentration') loadConcentrationReport();
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
        <p className="text-gray-500 dark:text-neutral-400">No tienes permisos para ver las estadísticas</p>
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

  return (
    <div className="max-w-6xl mx-auto">
      {view === null ? (
        /* Menú de reportes — mosaico tipo bento */
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 md:auto-rows-[120px] gap-2">
            {/* Diario — 1x1 */}
            <button
              onClick={() => handleSelectView('daily')}
              className="md:col-start-1 md:row-start-1 rounded-2xl bg-white dark:bg-neutral-800 border border-gray-100 dark:border-neutral-800 shadow-sm p-3 flex flex-col justify-between text-left h-full hover:-translate-y-0.5 transition-transform"
            >
              <span className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <ViewClockIcon className="w-4 h-4" />
              </span>
              <span>
                <span className="block text-sm font-bold text-gray-900 dark:text-neutral-100">Diario</span>
                <span className="block text-[10px] font-mono tracking-tight text-gray-500 dark:text-neutral-400 mt-0.5">Ventas día por día</span>
              </span>
            </button>

            {/* Semanal — 1x1 */}
            <button
              onClick={() => handleSelectView('weekly')}
              className="md:col-start-2 md:row-start-1 rounded-2xl bg-white dark:bg-neutral-800 border border-gray-100 dark:border-neutral-800 shadow-sm p-3 flex flex-col justify-between text-left h-full hover:-translate-y-0.5 transition-transform"
            >
              <span className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <ViewCalendarIcon className="w-4 h-4" />
              </span>
              <span>
                <span className="block text-2xl font-handwrite font-bold leading-none text-gray-900 dark:text-neutral-100">Semanal</span>
                <span className="block text-[10px] font-mono tracking-tight text-gray-500 dark:text-neutral-400 mt-0.5">Resumen por semana</span>
              </span>
            </button>

            {/* Por empleada — 2x2, grande y oscura */}
            <button
              onClick={() => handleSelectView('employee')}
              className="col-span-2 md:col-start-3 md:col-span-2 md:row-start-1 md:row-span-2 relative overflow-hidden rounded-2xl bg-neutral-900 dark:bg-black p-5 flex flex-col justify-between text-left text-white min-h-[110px] h-full hover:-translate-y-0.5 transition-transform"
            >
              <div className="absolute -right-10 -top-10 w-32 h-32 bg-amber-500/25 rounded-full blur-2xl pointer-events-none" />
              <span className="relative w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-400">
                <ViewUsersIcon className="w-5 h-5" />
              </span>
              <span className="relative">
                <span className="block text-xl font-display font-bold tracking-tight">Por empleada</span>
                <span className="block text-xs font-mono tracking-tight text-neutral-400 mt-1">Ranking y turnos</span>
              </span>
            </button>

            {/* Rotación de inventario — 1x1 */}
            <button
              onClick={() => handleSelectView('turnover')}
              className="md:col-start-1 md:row-start-2 rounded-2xl bg-white dark:bg-neutral-800 border border-gray-100 dark:border-neutral-800 shadow-sm p-3 flex flex-col justify-between text-left h-full hover:-translate-y-0.5 transition-transform"
            >
              <span className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <ViewRefreshIcon className="w-4 h-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-gray-900 dark:text-neutral-100">Rotación de inventario</span>
                <span className="block text-[10px] font-mono tracking-tight text-gray-500 dark:text-neutral-400 mt-0.5">Qué tan rápido se mueve tu stock</span>
              </span>
            </button>

            {/* Por día del mes — 1x1, llena el hueco intencional */}
            <button
              onClick={() => handleSelectView('monthCycle')}
              className="md:col-start-2 md:row-start-2 rounded-2xl bg-white dark:bg-neutral-800 border border-gray-100 dark:border-neutral-800 shadow-sm p-3 flex flex-col justify-between text-left h-full hover:-translate-y-0.5 transition-transform"
            >
              <span className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900 flex items-center justify-center text-sky-600 dark:text-sky-400">
                <ViewCoinCalendarIcon className="w-4 h-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-gray-900 dark:text-neutral-100">Por día del mes</span>
                <span className="block text-[10px] font-mono tracking-tight text-gray-500 dark:text-neutral-400 mt-0.5">Semanas y días que más venden</span>
              </span>
            </button>

            {/* Por día de la semana — 2x2, grande y oscura */}
            <button
              onClick={() => handleSelectView('dayOfWeek')}
              className="col-span-2 md:col-start-1 md:col-span-2 md:row-start-3 md:row-span-2 relative overflow-hidden rounded-2xl bg-neutral-900 dark:bg-black p-5 flex flex-col justify-between text-left text-white min-h-[110px] h-full hover:-translate-y-0.5 transition-transform"
            >
              <div className="absolute -right-10 -top-10 w-32 h-32 bg-amber-500/25 rounded-full blur-2xl pointer-events-none" />
              <span className="relative w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-400">
                <ViewBarsIcon className="w-5 h-5" />
              </span>
              <span className="relative">
                <span className="block text-4xl font-handwrite font-bold leading-none">Por día de la semana</span>
                <span className="block text-xs font-mono tracking-tight text-neutral-400 mt-1">Patrones históricos</span>
              </span>
            </button>

            {/* Productos clave — 1x2, alta, ámbar */}
            <button
              onClick={() => handleSelectView('concentration')}
              className="md:col-start-3 md:row-start-3 md:row-span-2 rounded-2xl bg-amber-500 p-4 flex flex-col justify-between text-left text-white min-h-[52px] h-full hover:-translate-y-0.5 transition-transform"
            >
              <span className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <ViewTagIcon className="w-4 h-4" />
              </span>
              <span>
                <span className="block text-3xl font-handwrite font-bold leading-none">Productos clave</span>
                <span className="block text-xs font-mono tracking-tight text-amber-100 mt-1">De dónde viene tu plata</span>
              </span>
            </button>

            {/* Reabastecimiento — 1x1 */}
            <button
              onClick={() => handleSelectView('reorder')}
              className="md:col-start-4 md:row-start-3 rounded-2xl bg-white dark:bg-neutral-800 border border-gray-100 dark:border-neutral-800 shadow-sm p-3 flex flex-col justify-between text-left h-full hover:-translate-y-0.5 transition-transform"
            >
              <span className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <ViewBoxIcon className="w-4 h-4" />
              </span>
              <span>
                <span className="block text-sm font-bold text-gray-900 dark:text-neutral-100">Reabastecimiento</span>
                <span className="block text-[10px] font-mono tracking-tight text-gray-500 dark:text-neutral-400 mt-0.5">Qué comprar y cuándo</span>
              </span>
            </button>

            {/* Tendencia — 1x1 */}
            <button
              onClick={() => handleSelectView('trend')}
              className="md:col-start-4 md:row-start-4 rounded-2xl bg-white dark:bg-neutral-800 border border-gray-100 dark:border-neutral-800 shadow-sm p-3 flex flex-col justify-between text-left h-full hover:-translate-y-0.5 transition-transform"
            >
              <span className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900 flex items-center justify-center text-teal-600 dark:text-teal-400">
                <ViewTrendIcon className="w-4 h-4" />
              </span>
              <span>
                <span className="block text-2xl font-handwrite font-bold leading-none text-gray-900 dark:text-neutral-100">Tendencia</span>
                <span className="block text-[10px] font-mono tracking-tight text-gray-500 dark:text-neutral-400 mt-0.5">Subiendo o bajando</span>
              </span>
            </button>
          </div>
        </div>
      ) : (
        /* Vista de detalle del reporte seleccionado */
        <div>
          <button
            onClick={() => setView(null)}
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-100 transition-colors"
          >
            <ViewArrowLeftIcon className="w-3.5 h-3.5" />
            Volver
          </button>

          <div className="max-h-[calc(100vh-150px)] overflow-y-auto pr-1 -mr-1">
          {view === 'concentration' ? (
            <RevenueConcentrationView
              report={concentrationReport}
              isLoading={isLoadingConcentration}
              period={concentrationPeriod}
              onPeriodChange={setConcentrationPeriod}
            />
          ) : view === 'trend' ? (
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
          ) : view === 'monthCycle' ? (
            <MonthCycleView report={monthCycleReport} isLoading={isLoadingMonthCycle} />
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
            <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm overflow-hidden">
              {view === 'daily' ? (
                <DailyStatsTable stats={dailyStats} />
              ) : (
                <WeeklyStatsTable stats={weeklyStats} />
              )}
            </div>
          )}
          </div>
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
      <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-neutral-400 mb-1">Empleada</label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => onSelectEmployee(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
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
            <label className="block text-xs font-medium text-gray-500 dark:text-neutral-400 mb-1">Desde</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-neutral-400 mb-1">Hasta</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={onSearch}
              disabled={isLoading || !selectedEmployeeId}
              className="w-full px-4 py-2 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-xl p-3">
          {error}
        </div>
      )}

      {!isLoading && !error && !hasSearched && (
        <div className="text-center py-12 text-gray-500 dark:text-neutral-400 text-sm">
          Selecciona una empleada y un rango de fechas, luego presiona Buscar.
        </div>
      )}

      {selectedEmployeeId !== ALL_EMPLOYEES_VALUE && !isLoading && !error && hasSearched && report === null && (
        <div className="text-center py-12 text-gray-500 dark:text-neutral-400 text-sm">
          {employeeOptions.find((e) => e.id === selectedEmployeeId)?.name || 'La empleada'} no registró turnos en ese rango de fechas.
        </div>
      )}

      {selectedEmployeeId === ALL_EMPLOYEES_VALUE && !isLoading && !error && hasSearched && ranking && ranking.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-neutral-400 text-sm">
          Ninguna empleada registró turnos en ese rango de fechas.
        </div>
      )}

      {selectedEmployeeId === ALL_EMPLOYEES_VALUE && ranking && ranking.length > 0 && (
        <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-neutral-100">Ranking de empleadas</h3>
            <div className="flex gap-1 bg-gray-100 dark:bg-neutral-700 rounded-xl p-1">
              <button
                onClick={() => onRankingSortByChange('sales')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  rankingSortBy === 'sales' ? 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 shadow-sm' : 'text-gray-500 dark:text-neutral-400'
                }`}
              >
                Por ventas ($)
              </button>
              <button
                onClick={() => onRankingSortByChange('units')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  rankingSortBy === 'units' ? 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 shadow-sm' : 'text-gray-500 dark:text-neutral-400'
                }`}
              >
                Por unidades vendidas
              </button>
              <button
                onClick={() => onRankingSortByChange('avg_ticket')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  rankingSortBy === 'avg_ticket' ? 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 shadow-sm' : 'text-gray-500 dark:text-neutral-400'
                }`}
              >
                Por ticket promedio
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-neutral-400 mb-3">
            Ticket promedio = total vendido ÷ número de ventas. Indica cuánto deja en promedio cada cliente atendido — útil para comparar más allá de quién vendió más en total.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-neutral-700">
                  <th className="py-2 text-left text-sm font-medium text-gray-600 dark:text-neutral-300">#</th>
                  <th className="py-2 text-left text-sm font-medium text-gray-600 dark:text-neutral-300">Empleada</th>
                  <th className="py-2 text-right text-sm font-medium text-gray-600 dark:text-neutral-300">Turnos</th>
                  <th className="py-2 text-right text-sm font-medium text-gray-600 dark:text-neutral-300">Unidades vendidas</th>
                  <th className="py-2 text-right text-sm font-medium text-gray-600 dark:text-neutral-300">Total ventas</th>
                  <th className="py-2 text-right text-sm font-medium text-gray-600 dark:text-neutral-300">Ticket promedio</th>
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
                    <tr key={emp.employee_id} className={index === 0 ? 'bg-green-50 dark:bg-green-950' : ''}>
                      <td className="py-2 text-sm text-gray-500 dark:text-neutral-400">{index + 1}</td>
                      <td className="py-2 text-sm text-gray-800 dark:text-neutral-100 font-medium">
                        {index === 0 && '🏆 '}
                        {emp.employee_name}
                      </td>
                      <td className="py-2 text-sm text-right text-gray-800 dark:text-neutral-100">{emp.shifts_count}</td>
                      <td
                        className={`py-2 text-sm text-right ${
                          rankingSortBy === 'units' ? 'font-bold text-green-700 dark:text-green-400' : 'text-gray-800 dark:text-neutral-100'
                        }`}
                      >
                        {emp.total_units}
                      </td>
                      <td
                        className={`py-2 text-sm text-right ${
                          rankingSortBy === 'sales' ? 'font-bold text-green-700 dark:text-green-400' : 'text-gray-800 dark:text-neutral-100'
                        }`}
                      >
                        {formatCurrency(emp.total_sales)}
                      </td>
                      <td
                        className={`py-2 text-sm text-right ${
                          rankingSortBy === 'avg_ticket' ? 'font-bold text-green-700 dark:text-green-400' : 'text-gray-800 dark:text-neutral-100'
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
        <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 dark:text-neutral-100">{report.employee_name}</h3>
            <span className="text-xl font-bold text-green-700 dark:text-green-400">{formatCurrency(report.total_sales)}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-gray-50 dark:bg-neutral-950 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 dark:text-neutral-400">Turnos</p>
              <p className="text-lg font-bold text-gray-800 dark:text-neutral-100">{report.shifts_count}</p>
            </div>
            <div className="bg-gray-50 dark:bg-neutral-950 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 dark:text-neutral-400">Ventas</p>
              <p className="text-lg font-bold text-gray-800 dark:text-neutral-100">{report.transactions_count}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950 rounded-xl p-3 text-center">
              <p className="text-xs text-amber-600 dark:text-amber-400">Ticket promedio</p>
              <p className="text-lg font-bold text-amber-700 dark:text-amber-400">
                {formatCurrency(report.transactions_count > 0 ? report.total_sales / report.transactions_count : 0)}
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-950 rounded-xl p-3 text-center">
              <p className="text-xs text-green-600 dark:text-green-400">Efectivo</p>
              <p className="text-lg font-bold text-green-700 dark:text-green-400">{formatCurrency(report.cash_sales)}</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-950 rounded-xl p-3 text-center">
              <p className="text-xs text-purple-600 dark:text-purple-400">Transferencias</p>
              <p className="text-lg font-bold text-purple-700 dark:text-purple-400">{formatCurrency(report.transfer_sales)}</p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-600 dark:text-neutral-300">Turnos y productos vendidos</h4>
            {report.shifts.map((shift) => (
              <div key={shift.shift_id} className="border border-gray-100 dark:border-neutral-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 dark:text-neutral-300">{formatDate(shift.date + 'T12:00:00')}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        shift.type === 'day' ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-400' : 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-400'
                      }`}
                    >
                      {shift.type === 'day' ? 'Día' : 'Noche'}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-neutral-400">{shift.transactions} ventas</span>
                  </div>
                  <span className="font-medium text-gray-800 dark:text-neutral-100">{formatCurrency(shift.total)}</span>
                </div>

                {shift.products.length > 0 ? (
                  <div className="space-y-1 mt-2">
                    {shift.products.map((p) => (
                      <div
                        key={p.product_name}
                        className="flex items-center justify-between text-sm py-1 px-3 bg-gray-50 dark:bg-neutral-950 rounded-xl"
                      >
                        <span className="text-gray-700 dark:text-neutral-300">
                          {p.product_name} <span className="text-gray-500 dark:text-neutral-400">× {p.quantity}</span>
                        </span>
                        <span className="font-medium text-gray-800 dark:text-neutral-100">{formatCurrency(p.total)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-neutral-400 mt-2">Sin productos vendidos en este turno</p>
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

  const selectedDayName = report.overall.find((d) => d.dow === selectedDow)?.day_name || '';
  const products = report.products_by_day[selectedDow] || [];

  const todayDow = new Date().getDay();
  const today = report.overall.find((d) => d.dow === todayDow);
  const todayProducts = [...(report.products_by_day[todayDow] || [])]
    .sort((a, b) => b.avg_units - a.avg_units)
    .slice(0, 4);

  const dowThClass = 'py-1.5 text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-neutral-400';

  return (
    <div className="space-y-3">
      {/* Predicción para hoy */}
      {today && (
        <div className="relative overflow-hidden bg-amber-50 dark:bg-neutral-900 border border-amber-200 dark:border-neutral-800 rounded-2xl p-4">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-amber-500/25 rounded-full blur-3xl pointer-events-none hidden dark:block" />
          <div className="relative flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="text-xl font-display font-bold text-amber-900 dark:text-amber-300">Predicción para hoy — {today.day_name}</h3>
            <p className="text-[10px] font-mono text-amber-700 dark:text-amber-400">
              Promedio de {today.occurrences} {today.day_name.toLowerCase()}{today.day_name.toLowerCase().endsWith('s') ? '' : 's'} anteriores (no es tendencia)
            </p>
          </div>
          <p className="relative text-3xl font-bold text-amber-900 dark:text-amber-300 mt-1 mb-3">
            {formatCurrency(today.avg_revenue)}{' '}
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">~{today.avg_sales_count} ventas esperadas hoy</span>
          </p>
          {todayProducts.length > 0 && (
            <div className="relative grid grid-cols-4 gap-2">
              {todayProducts.map((p) => (
                <div key={p.product_name} className="bg-white dark:bg-neutral-800 rounded-xl p-2 text-center">
                  <p className="text-[10px] text-gray-500 dark:text-neutral-400 truncate" title={p.product_name}>
                    {p.product_name}
                  </p>
                  <p className="text-base font-bold text-amber-900 dark:text-amber-300">~{p.avg_units}</p>
                  <p className="text-[9px] font-mono text-gray-400">unidades</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
        {/* Tabla general: ventas por día — cada fila selecciona el día (reemplaza el selector aparte) */}
        <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm p-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-neutral-100">Ventas por día de la semana</h3>
          <p className="text-[10px] font-mono text-gray-500 dark:text-neutral-400 mb-2">Promedio por día · clic en un día para ver el detalle</p>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-neutral-700">
                <th className={`${dowThClass} text-left`}>Día</th>
                <th className={`${dowThClass} text-right`}>Promedio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
              {report.overall.map((d) => (
                <tr
                  key={d.dow}
                  onClick={() => onSelectDow(d.dow)}
                  className={`cursor-pointer transition-colors ${
                    d.dow === selectedDow ? 'bg-amber-50 dark:bg-amber-500/10' : 'hover:bg-gray-50 dark:hover:bg-neutral-800/60'
                  }`}
                >
                  <td className="py-1.5">
                    <span className="block text-sm text-gray-800 dark:text-neutral-100 font-medium">{d.day_name}</span>
                    <span className="block text-[9px] font-mono text-gray-400 dark:text-neutral-500">
                      {d.sales_count} ventas en {d.occurrences} {d.day_name.toLowerCase()}{d.day_name.toLowerCase().endsWith('s') ? '' : 's'}
                    </span>
                  </td>
                  <td className="py-1.5 text-sm text-right font-mono font-bold text-gray-900 dark:text-neutral-100">{formatCurrency(d.avg_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Productos que más se disparan el día seleccionado */}
        <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm p-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-neutral-100">Productos que más se venden en {selectedDayName}</h3>
          <p className="text-[10px] font-mono text-gray-500 dark:text-neutral-400 mb-2 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span>% esperado sin patrón ~14% · excluye combos · mín. {report.min_units_threshold} unidades</span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-700 text-white">🔥 Fuerte</span>
              ≥28%
            </span>
            <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400 font-bold">↑ Notable ≥21%</span>
          </p>
          {products.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-neutral-400 text-center py-6">No hay suficientes datos para {selectedDayName}.</p>
          ) : (
            <div className="max-h-[280px] overflow-y-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-neutral-700">
                    <th className={`${dowThClass} sticky top-0 bg-white dark:bg-neutral-800 text-left`}>Producto</th>
                    <th className={`${dowThClass} sticky top-0 bg-white dark:bg-neutral-800 text-right`}>%</th>
                    <th className={`${dowThClass} sticky top-0 bg-white dark:bg-neutral-800 text-right`}>Prom.</th>
                    <th className={`${dowThClass} sticky top-0 bg-white dark:bg-neutral-800 text-right`}>Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
                  {products.map((p) => {
                    // Baseline sin ningún patrón: 1/7 de los días ≈ 14.3%
                    const strong = p.pct_of_total >= 28.6; // el doble o más
                    const notable = !strong && p.pct_of_total >= 21.4; // 1.5x o más
                    return (
                      <tr key={p.product_name} className={strong ? 'bg-green-50 dark:bg-green-950' : ''}>
                        <td className="py-1.5 text-sm text-gray-800 dark:text-neutral-100 truncate max-w-[140px]">{p.product_name}</td>
                        <td className="py-1.5 text-sm text-right">
                          <span className={`font-bold font-mono ${strong || notable ? 'text-green-700 dark:text-green-400' : 'text-gray-800 dark:text-neutral-100'}`}>
                            {p.pct_of_total}%
                          </span>
                          {strong && <span className="ml-1">🔥</span>}
                          {notable && <span className="ml-1 text-green-700 dark:text-green-400">↑</span>}
                        </td>
                        <td className="py-1.5 text-sm text-right font-mono text-amber-700 dark:text-amber-400 font-medium">~{p.avg_units}</td>
                        <td className="py-1.5 text-sm text-right font-mono text-gray-500 dark:text-neutral-400">{p.total_units}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function domIntensityClass(value: number, max: number, occurrences: number): string {
  if (occurrences === 0) return 'bg-gray-50 dark:bg-neutral-900 text-gray-300 dark:text-neutral-700';
  const ratio = max > 0 ? value / max : 0;
  if (ratio >= 0.8) return 'bg-amber-500 text-white';
  if (ratio >= 0.6) return 'bg-amber-300 dark:bg-amber-700 text-amber-900 dark:text-white';
  if (ratio >= 0.4) return 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300';
  if (ratio >= 0.2) return 'bg-amber-50 dark:bg-neutral-800 text-amber-700 dark:text-neutral-300';
  return 'bg-gray-50 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400';
}

function MonthCycleView({
  report,
  isLoading,
}: {
  report: MonthCycleReport | null;
  isLoading: boolean;
}) {
  if (isLoading || !report) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const maxWeekAvg = Math.max(...report.by_week.map((w) => w.avg_revenue), 1);
  const daysWithData = report.by_day.filter((d) => d.occurrences > 0);
  const maxDayAvg = Math.max(...daysWithData.map((d) => d.avg_revenue), 1);
  const topDay = daysWithData.length > 0
    ? daysWithData.reduce((best, d) => (d.avg_revenue > best.avg_revenue ? d : best))
    : null;

  const monthCycleThClass = 'py-1.5 text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-neutral-400';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
      {/* Por semana del mes */}
      <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm p-4">
        <h3 className="text-sm font-bold text-gray-900 dark:text-neutral-100">Por semana del mes</h3>
        <p className="text-[10px] font-mono text-gray-500 dark:text-neutral-400 mb-2">Promedio por franja de 7 días · útil para ver el efecto quincena</p>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 dark:border-neutral-700">
              <th className={`${monthCycleThClass} text-left`}>Semana</th>
              <th className={`${monthCycleThClass} text-right`}>Promedio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
            {report.by_week.map((w) => (
              <tr key={w.week_bucket} className={w.avg_revenue === maxWeekAvg && w.avg_revenue > 0 ? 'bg-amber-50 dark:bg-amber-500/10' : ''}>
                <td className="py-1.5">
                  <span className="block text-sm text-gray-800 dark:text-neutral-100 font-medium">
                    {w.label} {w.avg_revenue === maxWeekAvg && w.avg_revenue > 0 ? '🔥' : ''}
                  </span>
                  <span className="block text-[9px] font-mono text-gray-400 dark:text-neutral-500">
                    {w.sales_count} ventas en {w.occurrences} meses
                  </span>
                </td>
                <td className="py-1.5 text-sm text-right font-mono font-bold text-gray-900 dark:text-neutral-100">{formatCurrency(w.avg_revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Por día del mes: mapa de calor */}
      <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm p-4">
        <h3 className="text-sm font-bold text-gray-900 dark:text-neutral-100">Por día del mes</h3>
        <p className="text-[10px] font-mono text-gray-500 dark:text-neutral-400 mb-2">
          {topDay ? (
            <>Mejor día: <strong className="text-gray-700 dark:text-neutral-200">el {topDay.dom}</strong>, ~{formatCurrency(topDay.avg_revenue)} en promedio</>
          ) : (
            'Sin suficientes datos todavía.'
          )}
        </p>
        <div className="grid grid-cols-7 gap-1">
          {report.by_day.map((d) => (
            <div
              key={d.dom}
              title={`Día ${d.dom}: ${formatCurrency(d.avg_revenue)} en promedio (${d.occurrences} veces en el histórico)`}
              className={`rounded-lg py-1 text-center ${domIntensityClass(d.avg_revenue, maxDayAvg, d.occurrences)}`}
            >
              <p className="text-[9px] font-mono opacity-70">{d.dom}</p>
              <p className="text-[9px] font-bold leading-tight">{d.occurrences > 0 ? formatCompactCOP(d.avg_revenue) : '—'}</p>
            </div>
          ))}
        </div>
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
      <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-neutral-400 mb-1">Desde</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-neutral-400 mb-1">Hasta</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={onSearch}
              disabled={isLoading}
              className="w-full px-4 py-2 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Calculando...' : 'Calcular'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-xl p-3">{error}</div>
      )}

      {!isLoading && !error && !hasSearched && (
        <div className="text-center py-12 text-gray-500 dark:text-neutral-400 text-sm">
          Elige un rango de fechas y presiona Calcular.
        </div>
      )}

      {report && (
        <>
          {/* Número principal */}
          <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm p-6">
            <p className="text-sm text-gray-500 dark:text-neutral-400 mb-1">Rotación de inventario (aproximada)</p>
            {report.turnover === null ? (
              <p className="text-lg font-bold text-gray-800 dark:text-neutral-100">
                No se pudo calcular — el inventario valorizado a costo es $0. Revisa que tus productos tengan costo de compra y stock registrado.
              </p>
            ) : (
              <p className="text-4xl font-bold text-amber-700 dark:text-amber-400">
                {report.turnover.toLocaleString('es-CO', { maximumFractionDigits: 2 })}{' '}
                <span className="text-lg font-medium text-gray-500 dark:text-neutral-400">veces</span>
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-gray-50 dark:bg-neutral-950 rounded-xl p-3">
                <p className="text-xs text-gray-500 dark:text-neutral-400">Costo de lo vendido en el rango</p>
                <p className="text-lg font-bold text-gray-800 dark:text-neutral-100">{formatCurrency(report.cogs)}</p>
              </div>
              <div className="bg-gray-50 dark:bg-neutral-950 rounded-xl p-3">
                <p className="text-xs text-gray-500 dark:text-neutral-400">Inventario actual (valorizado a costo)</p>
                <p className="text-lg font-bold text-gray-800 dark:text-neutral-100">{formatCurrency(report.inventory_value_at_cost)}</p>
              </div>
            </div>
          </div>

          {/* Cómo leerlo */}
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300">¿Cómo se lee este número?</h3>
            <p className="text-sm text-amber-900 dark:text-amber-300">
              La rotación te dice cuántas veces &quot;diste la vuelta&quot; a tu inventario en el rango de fechas que
              elegiste — es decir, cuántas veces vendiste el equivalente al valor de lo que tienes hoy en existencias.
            </p>
            <ul className="text-sm text-amber-900 dark:text-amber-300 list-disc list-inside space-y-1">
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
              <p className="text-sm text-amber-900 dark:text-amber-300 bg-amber-100 dark:bg-amber-900 rounded-xl p-3">
                En tu caso: vendiste {formatCurrency(report.cogs)} en costo de mercancía, y tu inventario actual vale{' '}
                {formatCurrency(report.inventory_value_at_cost)} a costo → rotaste tu inventario{' '}
                <strong>{report.turnover.toLocaleString('es-CO', { maximumFractionDigits: 2 })} veces</strong> en este
                período.
              </p>
            )}
          </div>

          {/* Transparencia de datos */}
          {report.products_without_cost.length > 0 && (
            <div className="bg-gray-50 dark:bg-neutral-950 border border-gray-100 dark:border-neutral-800 rounded-2xl p-4">
              <p className="text-xs text-gray-600 dark:text-neutral-300 mb-1">
                <strong>{report.products_without_cost.length} producto(s) sin costo de compra registrado</strong> — no
                se incluyeron en este cálculo (ni en ventas ni en inventario)
                {report.excluded_units_sold > 0 && (
                  <> · se excluyeron {report.excluded_units_sold} unidades vendidas en el rango</>
                )}
                :
              </p>
              <p className="text-xs text-gray-500 dark:text-neutral-400">{report.products_without_cost.join(', ')}</p>
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
      <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-neutral-100 mb-1">Pronóstico de reabastecimiento</h3>
        <p className="text-xs text-gray-500 dark:text-neutral-400 mb-4">
          Calculado con el ritmo de ventas de los últimos {report.lookback_days} días. &quot;Comprar sugerido&quot; es
          la cantidad para llegar a cubrir {report.target_coverage_days} días de colchón al ritmo actual — ajústalo
          según tus tiempos reales de entrega del proveedor.
        </p>
        <p className="text-xs text-gray-500 dark:text-neutral-400 mb-4 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-700 text-white">
              🔴 Urgente
            </span>
            se acaba en menos de 7 días
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-400">
              🟡 Pronto
            </span>
            se acaba entre 7 y 14 días
          </span>
        </p>

        {report.products.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-neutral-400 text-center py-8">
            No hay suficientes ventas recientes para calcular un pronóstico.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-neutral-700">
                  <th className="py-2 text-left text-sm font-medium text-gray-600 dark:text-neutral-300">Producto</th>
                  <th className="py-2 text-right text-sm font-medium text-gray-600 dark:text-neutral-300">Stock actual</th>
                  <th className="py-2 text-right text-sm font-medium text-gray-600 dark:text-neutral-300">Venta/día</th>
                  <th className="py-2 text-right text-sm font-medium text-gray-600 dark:text-neutral-300">Días restantes</th>
                  <th className="py-2 text-right text-sm font-medium text-gray-600 dark:text-neutral-300">Comprar sugerido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {report.products.map((p) => {
                  const urgent = p.days_remaining < 7;
                  const soon = !urgent && p.days_remaining < 14;
                  return (
                    <tr key={p.product_id} className={urgent ? 'bg-red-50 dark:bg-red-950' : ''}>
                      <td className="py-2 text-sm text-gray-800 dark:text-neutral-100">{p.product_name}</td>
                      <td className="py-2 text-sm text-right text-gray-800 dark:text-neutral-100">{p.current_stock}</td>
                      <td className="py-2 text-sm text-right text-gray-500 dark:text-neutral-400">{p.daily_velocity}</td>
                      <td className="py-2 text-sm text-right">
                        <span
                          className={`font-bold ${
                            urgent ? 'text-red-700 dark:text-red-400' : soon ? 'text-amber-700 dark:text-amber-400' : 'text-gray-800 dark:text-neutral-100'
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
                          <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-400 align-middle">
                            🟡 Pronto
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-sm text-right font-medium text-gray-800 dark:text-neutral-100">
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
        <div className="bg-gray-50 dark:bg-neutral-950 border border-gray-100 dark:border-neutral-800 rounded-2xl p-4">
          <p className="text-xs text-gray-600 dark:text-neutral-300 mb-1">
            <strong>{report.products_without_recent_sales.length} producto(s) con stock pero sin ventas</strong> en
            los últimos {report.lookback_days} días — candidatos a revisar (posible sobre-stock o producto que ya no
            se mueve):
          </p>
          <p className="text-xs text-gray-500 dark:text-neutral-400">
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
      <span className={`inline-block px-2 py-0.5 rounded-full font-bold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-400 ${big ? 'text-sm' : 'text-[10px]'}`}>
        🆕 Nuevo
      </span>
    );
  }
  if (trend.status === 'stopped') {
    return (
      <span className={`inline-block px-2 py-0.5 rounded-full font-bold bg-gray-200 dark:bg-neutral-700 text-gray-600 dark:text-neutral-300 ${big ? 'text-sm' : 'text-[10px]'}`}>
        ⛔ Dejó de venderse
      </span>
    );
  }
  const color = trend.status === 'up' ? 'text-green-700 dark:text-green-400' : trend.status === 'down' ? 'text-red-700 dark:text-red-400' : 'text-gray-500 dark:text-neutral-400';
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

function RevenueBarChart({ title, bars, compact = false }: { title: string; bars: { label: string; value: number }[]; compact?: boolean }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const maxValue = Math.max(...bars.map((b) => b.value), 1);

  return (
    <div className={`h-full bg-white dark:bg-neutral-800 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm flex flex-col ${compact ? 'p-3' : 'p-6'}`}>
      <h3 className={`font-bold text-gray-900 dark:text-neutral-100 ${compact ? 'text-xs mb-1' : 'text-sm mb-4'}`}>{title}</h3>
      {bars.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-neutral-400">No hay suficientes datos todavía.</p>
      ) : (
        <div className={`flex items-end justify-around gap-2 flex-1 ${compact ? 'min-h-0' : 'h-48'}`}>
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
                <span className="text-[11px] font-medium text-gray-700 dark:text-neutral-300 mb-1">{formatCompactCOP(b.value)}</span>
                <div
                  className={`w-full max-w-[24px] rounded-t transition-colors ${isHovered ? 'bg-amber-600' : 'bg-amber-500'}`}
                  style={{ height: `${heightPct}%` }}
                />
                <span className="text-[10px] text-gray-500 dark:text-neutral-400 mt-2">{b.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RevenueConcentrationView({
  report,
  isLoading,
  period,
  onPeriodChange,
}: {
  report: RevenueConcentrationReport | null;
  isLoading: boolean;
  period: 'week' | 'month';
  onPeriodChange: (period: 'week' | 'month') => void;
}) {
  if (isLoading || !report) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const bucket = report[period];
  const periodLabel = period === 'week' ? 'los últimos 7 días' : 'los últimos 30 días';

  return (
    <div className="space-y-6">
      {/* Selector de período */}
      <div className="flex gap-1 bg-gray-100 dark:bg-neutral-700 rounded-xl p-1 w-fit">
        <button
          onClick={() => onPeriodChange('week')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            period === 'week' ? 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 shadow-sm' : 'text-gray-500 dark:text-neutral-400'
          }`}
        >
          Semana
        </button>
        <button
          onClick={() => onPeriodChange('month')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            period === 'month' ? 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 shadow-sm' : 'text-gray-500 dark:text-neutral-400'
          }`}
        >
          Mes
        </button>
      </div>

      {bucket.items.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-neutral-400 text-sm">No hay suficientes ventas en {periodLabel}.</div>
      ) : (
        <>
          {/* Titular */}
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-2xl p-6">
            <p className="text-sm text-amber-900 dark:text-amber-300 mb-1">
              En {periodLabel}, vendiste {formatCurrency(bucket.total_revenue)} en total.
            </p>
            <p className="text-2xl font-bold text-amber-900 dark:text-amber-300">
              {bucket.products_for_50pct} producto{bucket.products_for_50pct !== 1 ? 's' : ''} = 50% de tus ingresos
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-400 mt-1">
              Y con {bucket.products_for_80pct} producto{bucket.products_for_80pct !== 1 ? 's' : ''} ya cubres el 80%.
              Esos son los productos en los que <strong>nunca te puedes quedar sin stock</strong>.
            </p>
          </div>

          {/* Tabla */}
          <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm p-6">
            <h3 className="text-sm font-bold text-gray-900 dark:text-neutral-100 mb-1">Productos ordenados por ingresos</h3>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mb-4 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-600 text-white">
                  🎯 Núcleo (50%)
                </span>
                estos productos ya suman la mitad de tus ingresos
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-400">
                  80%
                </span>
                hasta aquí llegas al 80% del total
              </span>
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-neutral-700">
                    <th className="py-2 text-left text-sm font-medium text-gray-600 dark:text-neutral-300">Producto</th>
                    <th className="py-2 text-right text-sm font-medium text-gray-600 dark:text-neutral-300">Ingresos</th>
                    <th className="py-2 text-right text-sm font-medium text-gray-600 dark:text-neutral-300">% del total</th>
                    <th className="py-2 text-right text-sm font-medium text-gray-600 dark:text-neutral-300">% acumulado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {bucket.items.map((p, index) => {
                    const inCore = index < bucket.products_for_50pct;
                    const in80 = !inCore && index < bucket.products_for_80pct;
                    return (
                      <tr key={p.product_name} className={inCore ? 'bg-amber-50 dark:bg-amber-950' : ''}>
                        <td className="py-2 text-sm text-gray-800 dark:text-neutral-100">
                          {p.product_name}
                          {inCore && (
                            <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-600 text-white align-middle">
                              🎯
                            </span>
                          )}
                          {in80 && (
                            <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-400 align-middle">
                              80%
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-sm text-right text-gray-800 dark:text-neutral-100">{formatCurrency(p.revenue)}</td>
                        <td className="py-2 text-sm text-right text-gray-500 dark:text-neutral-400">{p.pct_of_total}%</td>
                        <td className="py-2 text-sm text-right font-medium text-gray-700 dark:text-neutral-300">{p.cumulative_pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
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
  const gainers = products.filter((p) => p.status === 'up').sort((a, b) => (b.pct_change ?? 0) - (a.pct_change ?? 0)).slice(0, 5);
  const decliners = products.filter((p) => p.status === 'down').sort((a, b) => (a.pct_change ?? 0) - (b.pct_change ?? 0)).slice(0, 5);
  const allNewProducts = products.filter((p) => p.status === 'new');
  const allStoppedProducts = products.filter((p) => p.status === 'stopped');
  const newProducts = allNewProducts.slice(0, 6);
  const stoppedProducts = allStoppedProducts.slice(0, 6);
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
    <div className="space-y-3">
      {/* Selector de período */}
      <div className="flex gap-1 bg-gray-100 dark:bg-neutral-700 rounded-xl p-1 w-fit">
        <button
          onClick={() => onPeriodChange('week')}
          className={`px-4 py-1 rounded-lg text-xs font-medium transition-colors ${
            period === 'week' ? 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 shadow-sm' : 'text-gray-500 dark:text-neutral-400'
          }`}
        >
          Semana
        </button>
        <button
          onClick={() => onPeriodChange('month')}
          className={`px-4 py-1 rounded-lg text-xs font-medium transition-colors ${
            period === 'month' ? 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 shadow-sm' : 'text-gray-500 dark:text-neutral-400'
          }`}
        >
          Mes
        </button>
      </div>

      {/* Fila 1: total + los 2 gráficos, misma altura */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:h-36">
        <div className="h-full bg-white dark:bg-neutral-800 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm p-4 flex flex-col justify-between">
          <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-neutral-400">
            {periodLabel} vs. {previousLabel}
          </p>
          <div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-2xl font-bold text-gray-900 dark:text-neutral-100">{formatCurrency(overall.current)}</p>
              <TrendBadge trend={overall} size="lg" />
            </div>
            <p className="text-[10px] font-mono text-gray-500 dark:text-neutral-400 mt-1">
              Anterior: {formatCurrency(overall.previous)}
            </p>
          </div>
        </div>
        <RevenueBarChart title="Últimos 6 meses" bars={monthBars} compact />
        <RevenueBarChart title="Últimas 4 semanas" bars={weekBars} compact />
      </div>

      <p className="text-[10px] font-mono tracking-tight text-gray-400 dark:text-neutral-500">
        Por unidades vendidas, excluye combos, mínimo {report.min_units_threshold} unidades combinadas entre ambos períodos.
      </p>

      {/* Subiendo / bajando */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm p-3">
          <h3 className="text-xs font-bold text-gray-900 dark:text-neutral-100 mb-2">📈 Ganando terreno</h3>
          {gainers.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-neutral-400">Sin crecimiento notable en este período.</p>
          ) : (
            <div className="space-y-1">
              {gainers.map((p) => (
                <div key={p.product_name} className="flex items-center justify-between text-xs py-1 px-2 bg-green-50 dark:bg-green-950 rounded-lg">
                  <span className="text-gray-800 dark:text-neutral-100 truncate">
                    {p.product_name} <span className="text-gray-400 font-mono">({p.previous_units}→{p.current_units})</span>
                  </span>
                  <TrendBadge trend={p} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm p-3">
          <h3 className="text-xs font-bold text-gray-900 dark:text-neutral-100 mb-2">📉 Perdiendo terreno</h3>
          {decliners.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-neutral-400">Sin caída notable en este período.</p>
          ) : (
            <div className="space-y-1">
              {decliners.map((p) => (
                <div key={p.product_name} className="flex items-center justify-between text-xs py-1 px-2 bg-red-50 dark:bg-red-950 rounded-lg">
                  <span className="text-gray-800 dark:text-neutral-100 truncate">
                    {p.product_name} <span className="text-gray-400 font-mono">({p.previous_units}→{p.current_units})</span>
                  </span>
                  <TrendBadge trend={p} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {(newProducts.length > 0 || stoppedProducts.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {newProducts.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl p-2">
              <p className="text-[10px] font-bold text-blue-900 dark:text-blue-300 line-clamp-2">
                🆕 Nuevos: <span className="font-normal font-mono">{newProducts.map((p) => `${p.product_name} (${p.current_units})`).join(', ')}{allNewProducts.length > newProducts.length ? ` +${allNewProducts.length - newProducts.length} más` : ''}</span>
              </p>
            </div>
          )}
          {stoppedProducts.length > 0 && (
            <div className="bg-gray-100 dark:bg-neutral-700 border border-gray-100 dark:border-neutral-800 rounded-xl p-2">
              <p className="text-[10px] font-bold text-gray-700 dark:text-neutral-300 line-clamp-2">
                ⛔ Dejaron de venderse: <span className="font-normal font-mono">{stoppedProducts.map((p) => `${p.product_name} (vendía ${p.previous_units})`).join(', ')}{allStoppedProducts.length > stoppedProducts.length ? ` +${allStoppedProducts.length - stoppedProducts.length} más` : ''}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function DailyStatsTable({ stats }: { stats: DailyStats[] }) {
  if (stats.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-neutral-400">
        No hay datos disponibles
      </div>
    );
  }

  const thClass = 'sticky top-0 z-10 bg-gray-50 dark:bg-neutral-950 px-4 py-2.5 text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-neutral-400';

  return (
    <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th className={`${thClass} text-left`}>Fecha</th>
            <th className={`${thClass} text-right`}>Ventas</th>
            <th className={`${thClass} text-right`}>Efectivo</th>
            <th className={`${thClass} text-right`}>Transfer.</th>
            <th className={`${thClass} text-right`}>Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
          {stats.map((stat, index) => (
            <tr
              key={stat.date}
              className={index === 0 ? 'bg-amber-50 dark:bg-amber-950' : 'hover:bg-gray-50 dark:hover:bg-neutral-800/60 transition-colors'}
            >
              <td className="px-4 py-2.5 text-sm">
                {index === 0 ? (
                  <span className="font-semibold text-amber-700 dark:text-amber-400">Hoy</span>
                ) : (
                  <span className="text-gray-700 dark:text-neutral-300">{formatDate(stat.date)}</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-sm text-right font-mono text-gray-700 dark:text-neutral-300">{stat.total_sales}</td>
              <td className="px-4 py-2.5 text-sm text-right font-mono text-gray-700 dark:text-neutral-300">{formatCurrency(stat.cash_revenue)}</td>
              <td className="px-4 py-2.5 text-sm text-right font-mono text-gray-700 dark:text-neutral-300">{formatCurrency(stat.transfer_revenue)}</td>
              <td className="px-4 py-2.5 text-sm text-right font-mono font-bold text-gray-900 dark:text-neutral-100">
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
      <div className="p-8 text-center text-gray-500 dark:text-neutral-400">
        No hay datos disponibles
      </div>
    );
  }

  const thClass = 'sticky top-0 z-10 bg-gray-50 dark:bg-neutral-950 px-4 py-2.5 text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-neutral-400';

  return (
    <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th className={`${thClass} text-left`}>Semana</th>
            <th className={`${thClass} text-right`}>Días</th>
            <th className={`${thClass} text-right`}>Ventas</th>
            <th className={`${thClass} text-right`}>Efectivo</th>
            <th className={`${thClass} text-right`}>Transfer.</th>
            <th className={`${thClass} text-right`}>Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-neutral-800">
          {stats.map((stat, index) => (
            <tr
              key={stat.week_start}
              className={index === 0 ? 'bg-amber-50 dark:bg-amber-950' : 'hover:bg-gray-50 dark:hover:bg-neutral-800/60 transition-colors'}
            >
              <td className="px-4 py-2.5 text-sm">
                {index === 0 ? (
                  <span className="font-semibold text-amber-700 dark:text-amber-400">Esta semana</span>
                ) : (
                  <span className="text-gray-700 dark:text-neutral-300">{`${formatDate(stat.week_start)} - ${formatDate(stat.week_end)}`}</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-sm text-right font-mono text-gray-700 dark:text-neutral-300">{stat.days_worked}</td>
              <td className="px-4 py-2.5 text-sm text-right font-mono text-gray-700 dark:text-neutral-300">{stat.total_sales}</td>
              <td className="px-4 py-2.5 text-sm text-right font-mono text-gray-700 dark:text-neutral-300">{formatCurrency(stat.cash_revenue)}</td>
              <td className="px-4 py-2.5 text-sm text-right font-mono text-gray-700 dark:text-neutral-300">{formatCurrency(stat.transfer_revenue)}</td>
              <td className="px-4 py-2.5 text-sm text-right font-mono font-bold text-gray-900 dark:text-neutral-100">
                {formatCurrency(stat.total_revenue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
