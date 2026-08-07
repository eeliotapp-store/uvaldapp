'use client';

import { formatCurrency } from '@/lib/utils';
import { useShiftStore } from '@/stores/shift-store';

export function CashRegisterStatus() {
  const { cashRegister } = useShiftStore();

  const totalSales = (cashRegister.totalCash - cashRegister.initialCash + cashRegister.totalChange) + cashRegister.totalTransfer;

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-neutral-100">Estado de Caja</h3>
        <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 px-2 py-1 rounded-full">
          Abierta
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div className="bg-gray-50 dark:bg-neutral-950 rounded-lg p-3">
          <p className="text-gray-500 dark:text-neutral-400 text-xs mb-1">Base</p>
          <p className="font-bold text-gray-900 dark:text-neutral-100">{formatCurrency(cashRegister.initialCash)}</p>
        </div>

        <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3">
          <p className="text-green-600 dark:text-green-400 text-xs mb-1">Efectivo</p>
          <p className="font-bold text-green-700 dark:text-green-400">{formatCurrency(cashRegister.totalCash)}</p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3">
          <p className="text-blue-600 dark:text-blue-400 text-xs mb-1">Transferencias</p>
          <p className="font-bold text-blue-700 dark:text-blue-400">{formatCurrency(cashRegister.totalTransfer)}</p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-3">
          <p className="text-amber-600 dark:text-amber-400 text-xs mb-1">Ventas Hoy</p>
          <p className="font-bold text-amber-700 dark:text-amber-400">{formatCurrency(totalSales)}</p>
        </div>
      </div>

      {cashRegister.totalChange > 0 && (
        <div className="mt-3 text-xs text-gray-500 dark:text-neutral-400 text-center">
          Vueltos entregados: {formatCurrency(cashRegister.totalChange)}
        </div>
      )}
    </div>
  );
}
