'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useShiftStore } from '@/stores/shift-store';
import { useAuthStore } from '@/stores/auth-store';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ShiftSummary } from '@/types/database';

export default function CloseShiftPage() {
  const router = useRouter();
  const { currentShift, clearShift, setShift } = useShiftStore();
  const employee = useAuthStore((state) => state.employee);

  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [cashEnd, setCashEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);

  useEffect(() => {
    loadShiftData();
  }, [currentShift]);

  const loadShiftData = async () => {
    if (!employee) return;

    // Buscar turno activo
    const { data: activeShift } = await supabase
      .from('shifts')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('is_active', true)
      .single();

    if (activeShift) {
      setShift(activeShift);

      // Cargar resumen
      const { data: summaryData } = await supabase
        .from('v_shift_summary')
        .select('*')
        .eq('shift_id', activeShift.id)
        .single();

      setSummary(summaryData as ShiftSummary);
    } else {
      setShowStartModal(true);
    }

    setIsLoading(false);
  };

  const handleStartShift = async (shiftType: 'day' | 'night', cashStart: number) => {
    if (!employee) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/shifts/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employee.id,
          shift_type: shiftType,
          cash_start: cashStart,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setShift(data.shift);
        setShowStartModal(false);
        loadShiftData();
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Error starting shift:', error);
      alert('Error al iniciar turno');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseShift = async () => {
    if (!currentShift) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shift_id: currentShift.id,
          cash_end: parseFloat(cashEnd) || 0,
          notes,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        clearShift();
        alert(
          `Turno cerrado!\n\nVentas: ${formatCurrency(data.summary.total_sales)}\nDiferencia en caja: ${formatCurrency(data.summary.difference)}`
        );
        router.push('/login');
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error('Error closing shift:', error);
      alert('Error al cerrar turno');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Modal para iniciar turno
  if (showStartModal) {
    return <StartShiftModal onStart={handleStartShift} isLoading={isSubmitting} />;
  }

  if (!currentShift || !summary) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No hay turno activo</p>
        <Button onClick={() => setShowStartModal(true)} className="mt-4">
          Iniciar Turno
        </Button>
      </div>
    );
  }

  const expectedCash = summary.cash_start + summary.cash_sales;
  const cashEndValue = parseFloat(cashEnd) || 0;
  const difference = cashEndValue - expectedCash;

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Cierre de Turno</h1>

      <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
        <div className="text-center mb-6">
          <p className="text-sm text-gray-600">Empleado</p>
          <p className="text-lg font-bold">{summary.employee_name}</p>
          <p className="text-sm text-gray-500 capitalize">
            Turno {summary.type === 'day' ? 'Día' : 'Noche'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Inicio: {formatDateTime(summary.start_time)}
          </p>
        </div>

        <div className="space-y-3 border-t border-gray-100 pt-4">
          <div className="flex justify-between">
            <span className="text-gray-600">Caja inicial</span>
            <span className="font-medium">{formatCurrency(summary.cash_start)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Ventas efectivo</span>
            <span className="font-medium text-green-600">
              +{formatCurrency(summary.cash_sales)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Ventas tarjeta</span>
            <span className="font-medium">{formatCurrency(summary.card_sales)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Transacciones</span>
            <span className="font-medium">{summary.transactions_count}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-3">
            <span className="font-bold">Efectivo esperado</span>
            <span className="font-bold text-lg">{formatCurrency(expectedCash)}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Dinero en caja (contado)
        </label>
        <input
          type="number"
          value={cashEnd}
          onChange={(e) => setCashEnd(e.target.value)}
          placeholder="0"
          className="w-full px-4 py-3 text-2xl font-bold text-center border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-0"
        />

        {cashEnd && (
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">Diferencia</p>
            <p
              className={`text-2xl font-bold ${
                difference === 0
                  ? 'text-green-600'
                  : difference > 0
                  ? 'text-blue-600'
                  : 'text-red-600'
              }`}
            >
              {difference >= 0 ? '+' : ''}
              {formatCurrency(difference)}
            </p>
            {difference < 0 && (
              <p className="text-red-500 text-sm mt-1">Faltante en caja</p>
            )}
            {difference > 0 && (
              <p className="text-blue-500 text-sm mt-1">Sobrante en caja</p>
            )}
          </div>
        )}

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notas (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
            placeholder="Observaciones del turno..."
          />
        </div>
      </div>

      <Button
        onClick={handleCloseShift}
        disabled={!cashEnd || isSubmitting}
        size="lg"
        className="w-full"
      >
        {isSubmitting ? 'Cerrando...' : 'Cerrar Turno'}
      </Button>
    </div>
  );
}

function StartShiftModal({
  onStart,
  isLoading,
}: {
  onStart: (type: 'day' | 'night', cash: number) => void;
  isLoading: boolean;
}) {
  const [shiftType, setShiftType] = useState<'day' | 'night'>('day');
  const [cashStart, setCashStart] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart(shiftType, parseFloat(cashStart) || 0);
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-xl font-bold text-center mb-6">Iniciar Turno</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Tipo de Turno
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setShiftType('day')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  shiftType === 'day'
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="text-2xl mb-1">🌅</div>
                <p className="font-medium">Día</p>
              </button>
              <button
                type="button"
                onClick={() => setShiftType('night')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  shiftType === 'night'
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="text-2xl mb-1">🌙</div>
                <p className="font-medium">Noche</p>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Efectivo inicial en caja
            </label>
            <input
              type="number"
              value={cashStart}
              onChange={(e) => setCashStart(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-3 text-xl font-bold text-center border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-0"
            />
          </div>

          <Button type="submit" disabled={isLoading} size="lg" className="w-full">
            {isLoading ? 'Iniciando...' : 'Iniciar Turno'}
          </Button>
        </form>
      </div>
    </div>
  );
}
