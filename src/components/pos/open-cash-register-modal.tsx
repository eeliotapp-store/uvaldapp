'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { useShiftStore } from '@/stores/shift-store';

interface OpenCashRegisterModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function OpenCashRegisterModal({ onConfirm, onCancel }: OpenCashRegisterModalProps) {
  const [initialAmount, setInitialAmount] = useState<string>('');
  const openCashRegister = useShiftStore((state) => state.openCashRegister);

  const amount = parseFloat(initialAmount) || 0;

  const handleConfirm = () => {
    openCashRegister(amount);
    onConfirm();
  };

  // Botones rápidos de montos comunes
  const quickAmounts = [50000, 100000, 150000, 200000];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-center mb-2">Abrir Caja</h2>
        <p className="text-center text-gray-500 mb-6">
          Ingresa el dinero con el que inicias el turno
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Monto inicial en efectivo
          </label>
          <input
            type="number"
            value={initialAmount}
            onChange={(e) => setInitialAmount(e.target.value)}
            placeholder="0"
            className="w-full px-4 py-4 text-2xl font-bold text-center border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-0"
            autoFocus
          />
        </div>

        {/* Botones rápidos */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {quickAmounts.map((amt) => (
            <button
              key={amt}
              onClick={() => setInitialAmount(amt.toString())}
              className="py-2 px-1 text-sm bg-gray-100 hover:bg-amber-100 rounded-lg transition-colors"
            >
              {formatCurrency(amt)}
            </button>
          ))}
        </div>

        {amount > 0 && (
          <div className="bg-amber-50 rounded-xl p-4 mb-6 text-center">
            <p className="text-gray-600 text-sm">Iniciar caja con</p>
            <p className="text-2xl font-bold text-amber-700">{formatCurrency(amount)}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleConfirm} className="flex-1">
            Abrir Caja
          </Button>
        </div>
      </div>
    </div>
  );
}
