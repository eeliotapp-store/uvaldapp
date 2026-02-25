'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore, isOwner } from '@/stores/auth-store';
import { formatCurrency } from '@/lib/utils';
import type { DailySale, CurrentStock } from '@/types/database';

interface DashboardStats {
  todaySales: number;
  todayTransactions: number;
  lowStockCount: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const employee = useAuthStore((state) => state.employee);
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayTransactions: 0,
    lowStockCount: 0,
  });
  const [recentSales, setRecentSales] = useState<DailySale[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<CurrentStock[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Redirigir empleados al POS
    if (employee && !isOwner(employee.role)) {
      router.push('/pos');
      return;
    }

    loadDashboardData();
  }, [employee, router]);

  const loadDashboardData = async () => {
    try {
      // Ventas del día
      const { data: salesData } = await supabase
        .from('v_daily_sales')
        .select('*')
        .eq('voided', false)
        .order('created_at', { ascending: false });

      const todaySales = salesData?.reduce((sum, sale) => sum + sale.total, 0) || 0;

      // Stock bajo
      const { data: stockData } = await supabase
        .from('v_current_stock')
        .select('*')
        .eq('is_low_stock', true);

      setStats({
        todaySales,
        todayTransactions: salesData?.length || 0,
        lowStockCount: stockData?.length || 0,
      });

      setRecentSales((salesData as DailySale[])?.slice(0, 5) || []);
      setLowStockProducts((stockData as CurrentStock[]) || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Ventas Hoy</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(stats.todaySales)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Transacciones</p>
          <p className="text-2xl font-bold text-gray-900">
            {stats.todayTransactions}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Stock Bajo</p>
          <p className={`text-2xl font-bold ${stats.lowStockCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {stats.lowStockCount} productos
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="font-bold text-gray-900 mb-4">Últimas Ventas</h2>
          {recentSales.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay ventas hoy</p>
          ) : (
            <div className="space-y-3">
              {recentSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {formatCurrency(sale.total)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {sale.employee_name} • {sale.payment_method === 'cash' ? 'Efectivo' : 'Tarjeta'}
                    </p>
                  </div>
                  <span className="text-sm text-gray-400">
                    {new Date(sale.created_at).toLocaleTimeString('es-CO', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alert */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="font-bold text-gray-900 mb-4">Alertas de Stock</h2>
          {lowStockProducts.length === 0 ? (
            <p className="text-green-600 text-sm">Todo el stock está bien</p>
          ) : (
            <div className="space-y-3">
              {lowStockProducts.map((product) => (
                <div
                  key={product.product_id}
                  className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
                >
                  <p className="font-medium text-gray-900">{product.product_name}</p>
                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                    {product.current_stock} / {product.min_stock}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
