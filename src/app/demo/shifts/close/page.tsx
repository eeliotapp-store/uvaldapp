'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDemoStore } from '@/stores/demo-store';
import { formatCurrency, getShiftTypeLabel, formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function DemoCloseShiftPage() {
  const router = useRouter();
  const { shift, closedSales, tabs, closeShift } = useDemoStore();
  const [cashEnd, setCashEnd] = useState('');

  if (!shift) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-neutral-400 mb-4">No hay turno de práctica activo</p>
        <Button onClick={() => router.push('/demo/shifts/start')} className="bg-amber-500 hover:bg-amber-600">
          Iniciar Turno
        </Button>
      </div>
    );
  }

  const cashSales = closedSales.reduce((sum, s) => sum + s.cashAmount, 0);
  const transferSales = closedSales.reduce((sum, s) => sum + s.transferAmount, 0);
  const totalSales = closedSales.reduce((sum, s) => sum + s.total, 0);
  const expectedCash = shift.cashStart + cashSales;
  const cashEndValue = parseFloat(cashEnd) || 0;
  const difference = cashEndValue - expectedCash;

  const handleClose = () => {
    closeShift();
    router.push('/demo/shifts/start');
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mb-6">Cierre de Turno — Práctica</h1>

      {tabs.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400 rounded-lg text-sm">
          Tienes {tabs.length} mesa(s) abierta(s) sin cobrar. Ciérralas primero en Punto de Venta si quieres practicar el flujo completo.
        </div>
      )}

      <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700 mb-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1 mt-1">
            <span>{shift.type === 'day' ? '☀️' : '🌙'}</span>
            <span className="text-sm text-gray-500 dark:text-neutral-400">
              Turno {getShiftTypeLabel(shift.type)}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
            Inicio: {formatDateTime(shift.startedAt)}
          </p>
        </div>

        <div className="space-y-3 border-t border-gray-100 dark:border-neutral-700 pt-4">
          <p className="text-sm font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Efectivo</p>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-neutral-300">Caja inicial</span>
            <span className="font-medium">{formatCurrency(shift.cashStart)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-neutral-300">Ventas en efectivo</span>
            <span className="font-medium text-green-600 dark:text-green-400">+{formatCurrency(cashSales)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 dark:border-neutral-700 pt-3">
            <span className="font-bold">Efectivo esperado</span>
            <span className="font-bold text-lg">{formatCurrency(expectedCash)}</span>
          </div>
        </div>

        <div className="space-y-3 border-t border-gray-100 dark:border-neutral-700 pt-4 mt-4">
          <p className="text-sm font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Resumen</p>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-neutral-300">Transferencias</span>
            <span className="font-medium">{formatCurrency(transferSales)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-neutral-300">Mesas cerradas</span>
            <span className="font-medium">{closedSales.length}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 dark:border-neutral-700 pt-3">
            <span className="font-bold">Total ventas del turno</span>
            <span className="font-bold text-xl text-green-600 dark:text-green-400">{formatCurrency(totalSales)}</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700 mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
          Dinero en caja (contado)
        </label>
        <input
          type="number"
          value={cashEnd}
          onChange={(e) => setCashEnd(e.target.value)}
          placeholder="0"
          className="w-full px-4 py-3 text-2xl font-bold text-center border-2 border-gray-200 dark:border-neutral-700 rounded-xl focus:border-amber-500 focus:ring-0"
        />

        {cashEnd && (
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600 dark:text-neutral-300">Diferencia</p>
            <p
              className={`text-2xl font-bold ${
                difference === 0 ? 'text-green-600 dark:text-green-400' : difference > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {difference >= 0 ? '+' : ''}
              {formatCurrency(difference)}
            </p>
          </div>
        )}
      </div>

      <Button
        onClick={handleClose}
        disabled={!cashEnd}
        size="lg"
        className="w-full bg-amber-500 hover:bg-amber-600 focus:ring-amber-500"
      >
        Cerrar Turno de Práctica
      </Button>
    </div>
  );
}
