'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { DailyStats, WeeklyStats } from '@/types/database';

export default function StatsPage() {
  const employee = useAuthStore((state) => state.employee);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats[]>([]);
  const [view, setView] = useState<'daily' | 'weekly'>('daily');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      // Cargar estadísticas diarias (últimos 30 días)
      const { data: daily } = await supabase
        .from('v_daily_stats')
        .select('*')
        .limit(30);

      // Cargar estadísticas semanales (últimas 8 semanas)
      const { data: weekly } = await supabase
        .from('v_weekly_stats')
        .select('*')
        .limit(8);

      setDailyStats((daily as DailyStats[]) || []);
      setWeeklyStats((weekly as WeeklyStats[]) || []);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Solo dueños pueden ver estadísticas completas
  if (employee?.role !== 'owner') {
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
      </div>

      {/* Tabla de estadísticas */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {view === 'daily' ? (
          <DailyStatsTable stats={dailyStats} />
        ) : (
          <WeeklyStatsTable stats={weeklyStats} />
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
