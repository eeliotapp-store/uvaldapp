'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useShiftStore } from '@/stores/shift-store';
import { supabase } from '@/lib/supabase/client';
import { detectShiftType, getShiftTypeLabel, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ShiftType } from '@/types/database';

export default function StartShiftPage() {
  const router = useRouter();
  const employee = useAuthStore((state) => state.employee);
  const { setShift, openCashRegister } = useShiftStore();

  const [shiftType, setShiftType] = useState<ShiftType>(detectShiftType());
  const [cashStart, setCashStart] = useState('');
  const [transferStart, setTransferStart] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [checkingShift, setCheckingShift] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Actualizar hora cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Verificar si ya tiene turno activo
  useEffect(() => {
    const checkActiveShift = async () => {
      if (!employee) {
        router.push('/login');
        return;
      }

      const { data: activeShift } = await supabase
        .from('shifts')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('is_active', true)
        .single();

      if (activeShift) {
        setShift(activeShift);
        router.push('/sales');
      } else {
        setCheckingShift(false);
      }
    };

    checkActiveShift();
  }, [employee, router, setShift]);

  const handleStartShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/shifts/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employee.id,
          shift_type: shiftType,
          cash_start: parseFloat(cashStart) || 0,
          transfer_start: parseFloat(transferStart) || 0,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setShift(data.shift);
        openCashRegister(parseFloat(cashStart) || 0);
        router.push('/sales');
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Error starting shift:', error);
      alert('Error al iniciar turno');
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingShift) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hour = currentTime.getHours();
  const minutes = currentTime.getMinutes();
  const timeString = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
        {/* Header con hora y tipo de turno */}
        <div className="text-center mb-8">
          <p className="text-4xl font-bold text-gray-900 mb-2">{timeString}</p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-full">
            <span className="text-2xl">{shiftType === 'day' ? '☀️' : '🌙'}</span>
            <span className="font-medium text-amber-800">
              Turno de {getShiftTypeLabel(shiftType)}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Detectado automáticamente
          </p>
        </div>

        {/* Saludo al empleado */}
        <div className="text-center mb-6 pb-6 border-b border-gray-100">
          <p className="text-gray-600">Bienvenido/a</p>
          <p className="text-xl font-bold text-gray-900">{employee?.name}</p>
        </div>

        <form onSubmit={handleStartShift} className="space-y-6">
          {/* Selector de tipo de turno (por si necesita cambiarlo) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Tipo de turno
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShiftType('day')}
                className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                  shiftType === 'day'
                    ? 'border-amber-500 bg-amber-50 text-amber-800'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
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
                    ? 'border-amber-500 bg-amber-50 text-amber-800'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <span>🌙</span>
                <span className="font-medium">Noche</span>
              </button>
            </div>
          </div>

          {/* Efectivo inicial */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Efectivo inicial en caja
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                $
              </span>
              <input
                type="number"
                value={cashStart}
                onChange={(e) => setCashStart(e.target.value)}
                placeholder="0"
                className="w-full pl-8 pr-4 py-3 text-xl font-bold text-center border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-0"
              />
            </div>
            {cashStart && (
              <p className="text-sm text-gray-500 text-center mt-1">
                {formatCurrency(parseFloat(cashStart) || 0)}
              </p>
            )}
          </div>

          {/* Transferencias pendientes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transferencias pendientes (opcional)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                $
              </span>
              <input
                type="number"
                value={transferStart}
                onChange={(e) => setTransferStart(e.target.value)}
                placeholder="0"
                className="w-full pl-8 pr-4 py-3 text-lg text-center border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-0"
              />
            </div>
            <p className="text-xs text-gray-400 text-center mt-1">
              Si hay transferencias del turno anterior
            </p>
          </div>

          {/* Resumen */}
          {(cashStart || transferStart) && (
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Resumen inicial:</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Efectivo:</span>
                  <span className="font-medium">{formatCurrency(parseFloat(cashStart) || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Transferencias:</span>
                  <span className="font-medium">{formatCurrency(parseFloat(transferStart) || 0)}</span>
                </div>
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            size="lg"
            className="w-full"
          >
            {isLoading ? 'Iniciando...' : 'Iniciar Turno'}
          </Button>
        </form>
      </div>
    </div>
  );
}
