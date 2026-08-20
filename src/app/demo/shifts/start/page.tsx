'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDemoStore } from '@/stores/demo-store';
import { detectShiftType, getShiftTypeLabel, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ShiftType } from '@/types/database';

export default function DemoStartShiftPage() {
  const router = useRouter();
  const startShift = useDemoStore((s) => s.startShift);
  const shift = useDemoStore((s) => s.shift);

  const [shiftType, setShiftType] = useState<ShiftType>(detectShiftType());
  const [cashStart, setCashStart] = useState('');

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    startShift(shiftType, parseFloat(cashStart) || 0);
    router.push('/demo/pos');
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-xl font-bold text-gray-900 dark:text-neutral-100 mb-4">
        Iniciar Turno — Práctica
      </h1>

      {shift && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400 rounded-lg text-sm">
          Ya tienes un turno de práctica activo. Iniciar uno nuevo lo reemplaza.
        </div>
      )}

      <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-gray-200 dark:border-neutral-700 shadow-sm">
        <form onSubmit={handleStart} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-3">
              Tipo de turno
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShiftType('day')}
                className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                  shiftType === 'day'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-400'
                    : 'border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-300'
                }`}
              >
                <span>☀️</span>
                <span className="font-medium">Día</span>
              </button>
              <button
                type="button"
                onClick={() => setShiftType('night')}
                className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                  shiftType === 'night'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-400'
                    : 'border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-300'
                }`}
              >
                <span>🌙</span>
                <span className="font-medium">Noche</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-2 text-center">
              Detectado automáticamente: {getShiftTypeLabel(detectShiftType())}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
              Efectivo inicial en caja
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-neutral-400 font-medium">
                $
              </span>
              <input
                type="number"
                value={cashStart}
                onChange={(e) => setCashStart(e.target.value)}
                placeholder="0"
                className="w-full pl-8 pr-4 py-3 text-xl font-bold text-center border-2 border-gray-200 dark:border-neutral-700 rounded-xl focus:border-amber-500 focus:ring-0"
              />
            </div>
            {cashStart && (
              <p className="text-sm text-gray-500 dark:text-neutral-400 text-center mt-1">
                {formatCurrency(parseFloat(cashStart) || 0)}
              </p>
            )}
          </div>

          <Button type="submit" size="lg" className="w-full bg-amber-500 hover:bg-amber-600 focus:ring-amber-500">
            Iniciar Turno de Práctica
          </Button>
        </form>
      </div>
    </div>
  );
}
