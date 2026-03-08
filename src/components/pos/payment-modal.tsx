'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { MICHELADA_EXTRA } from '@/stores/cart-store';
import type { PaymentMethod } from '@/types/database';
import type { CartItem, CartCombo } from '@/types/database';

type PaymentStep = 'bill' | 'method' | 'payment' | 'complete';

interface PaymentResult {
  paymentMethod: PaymentMethod;
  cashReceived: number;
  cashChange: number;
  transferAmount: number;
  cashAmount: number;
  notes?: string;
  closeNotes?: string;
}

interface PaymentModalProps {
  total: number;
  items: CartItem[];
  combos?: CartCombo[];
  onConfirm: (result: PaymentResult) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function PaymentModal({
  total,
  items,
  combos = [],
  onConfirm,
  onCancel,
  isLoading,
}: PaymentModalProps) {
  const [step, setStep] = useState<PaymentStep>('bill');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [notes, setNotes] = useState<string>('');

  // Para pago en efectivo
  const [cashReceived, setCashReceived] = useState<string>('');

  // Para pago mixto
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [cashAmountMixed, setCashAmountMixed] = useState<string>('');

  const cashReceivedNum = parseFloat(cashReceived) || 0;
  const transferAmountNum = parseFloat(transferAmount) || 0;
  const cashAmountMixedNum = parseFloat(cashAmountMixed) || 0;

  // Calcular cambio
  const getChange = () => {
    if (paymentMethod === 'cash') {
      return Math.max(0, cashReceivedNum - total);
    }
    if (paymentMethod === 'mixed') {
      const totalPaid = transferAmountNum + cashAmountMixedNum;
      return Math.max(0, totalPaid - total);
    }
    return 0;
  };

  const change = getChange();

  // Validar si puede confirmar
  const canConfirmPayment = () => {
    if (paymentMethod === 'transfer') {
      return true; // Solo confirmar que el cliente mostró comprobante
    }
    if (paymentMethod === 'cash') {
      return cashReceivedNum >= total;
    }
    if (paymentMethod === 'mixed') {
      return (transferAmountNum + cashAmountMixedNum) >= total;
    }
    return false;
  };

  const handleConfirm = () => {
    if (!paymentMethod) return;

    let result: PaymentResult;

    if (paymentMethod === 'cash') {
      result = {
        paymentMethod: 'cash',
        cashReceived: cashReceivedNum,
        cashChange: change,
        transferAmount: 0,
        cashAmount: total,
        notes: notes || undefined,
        closeNotes: notes || undefined,
      };
    } else if (paymentMethod === 'transfer') {
      result = {
        paymentMethod: 'transfer',
        cashReceived: 0,
        cashChange: 0,
        transferAmount: total,
        cashAmount: 0,
        notes: notes || undefined,
        closeNotes: notes || undefined,
      };
    } else {
      // mixed
      result = {
        paymentMethod: 'mixed',
        cashReceived: cashAmountMixedNum,
        cashChange: change,
        transferAmount: transferAmountNum,
        cashAmount: cashAmountMixedNum - change,
        notes: notes || undefined,
        closeNotes: notes || undefined,
      };
    }

    onConfirm(result);
  };

  // Renderizar según el paso actual
  const renderStep = () => {
    switch (step) {
      case 'bill':
        return renderBillStep();
      case 'method':
        return renderMethodStep();
      case 'payment':
        return renderPaymentStep();
      default:
        return null;
    }
  };

  // PASO 1: Mostrar la cuenta
  const renderBillStep = () => (
    <>
      <h2 className="text-xl font-bold text-center mb-4">La Cuenta</h2>

      {/* Lista de productos */}
      <div className="bg-gray-50 rounded-xl p-4 mb-4 max-h-60 overflow-y-auto">
        {/* Items individuales */}
        {items.map((item, index) => {
          const unitPrice = item.product.sale_price + (item.isMichelada ? MICHELADA_EXTRA : 0);
          const itemTotal = unitPrice * item.quantity;
          const itemKey = `${item.product.id}-${item.isMichelada ? 'mich' : 'normal'}-${index}`;

          return (
            <div key={itemKey} className="flex justify-between py-2 border-b border-gray-200 last:border-0">
              <div>
                <span className="font-medium">{item.quantity}x</span>{' '}
                <span>{item.product.name}</span>
                {item.isMichelada && (
                  <span className="text-xs text-amber-600 ml-1">🌶️</span>
                )}
              </div>
              <span className="font-medium">
                {formatCurrency(itemTotal)}
              </span>
            </div>
          );
        })}

        {/* Combos */}
        {combos.map((cartCombo, index) => (
          <div key={`combo-${index}`} className="py-2 border-b border-gray-200 last:border-0">
            <div className="flex justify-between">
              <div>
                <span className="font-medium">🎁 {cartCombo.combo.name}</span>
              </div>
              <span className="font-medium text-amber-600">
                {formatCurrency(cartCombo.finalPrice)}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {cartCombo.items.map(item =>
                `${item.quantity}x ${item.product.name.substring(0, 15)}${item.isMichelada ? ' 🌶️' : ''}`
              ).join(', ')}
            </div>
          </div>
        ))}
      </div>

      {/* Campo de observaciones */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Observaciones (opcional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ej: Se rompió una cerveza, compra de hielo, etc."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:border-amber-500 focus:ring-0"
          rows={2}
        />
      </div>

      {/* Total grande */}
      <div className="text-center py-6 bg-amber-50 rounded-xl mb-6">
        <p className="text-gray-600 text-sm mb-1">Total a pagar</p>
        <p className="text-4xl font-bold text-amber-700">
          {formatCurrency(total)}
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Volver
        </Button>
        <Button onClick={() => setStep('method')} className="flex-1">
          Solicitar Pago
        </Button>
      </div>
    </>
  );

  // PASO 2: Seleccionar método de pago
  const renderMethodStep = () => (
    <>
      <h2 className="text-xl font-bold text-center mb-2">Metodo de Pago</h2>
      <p className="text-center text-gray-500 mb-6">
        Total: <span className="font-bold text-gray-900">{formatCurrency(total)}</span>
      </p>

      <div className="space-y-3 mb-6">
        <button
          onClick={() => {
            setPaymentMethod('cash');
            setStep('payment');
          }}
          className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-amber-500 hover:bg-amber-50 transition-all flex items-center gap-4"
        >
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-2xl">
            💵
          </div>
          <div className="text-left">
            <p className="font-bold text-gray-900">Efectivo</p>
            <p className="text-sm text-gray-500">Pago en billetes o monedas</p>
          </div>
        </button>

        <button
          onClick={() => {
            setPaymentMethod('transfer');
            setStep('payment');
          }}
          className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-amber-500 hover:bg-amber-50 transition-all flex items-center gap-4"
        >
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-2xl">
            📱
          </div>
          <div className="text-left">
            <p className="font-bold text-gray-900">Transferencia</p>
            <p className="text-sm text-gray-500">Nequi, Daviplata, bancaria</p>
          </div>
        </button>

        <button
          onClick={() => {
            setPaymentMethod('mixed');
            setStep('payment');
          }}
          className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-amber-500 hover:bg-amber-50 transition-all flex items-center gap-4"
        >
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-2xl">
            💳
          </div>
          <div className="text-left">
            <p className="font-bold text-gray-900">Mixto</p>
            <p className="text-sm text-gray-500">Parte efectivo, parte transferencia</p>
          </div>
        </button>
      </div>

      <Button variant="outline" onClick={() => setStep('bill')} className="w-full">
        Volver a la cuenta
      </Button>
    </>
  );

  // PASO 3: Ingresar montos
  const renderPaymentStep = () => {
    if (paymentMethod === 'cash') {
      return renderCashPayment();
    }
    if (paymentMethod === 'transfer') {
      return renderTransferPayment();
    }
    if (paymentMethod === 'mixed') {
      return renderMixedPayment();
    }
    return null;
  };

  const renderCashPayment = () => (
    <>
      <h2 className="text-xl font-bold text-center mb-2">Pago en Efectivo</h2>
      <p className="text-center text-gray-500 mb-6">
        Total: <span className="font-bold text-gray-900">{formatCurrency(total)}</span>
      </p>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Efectivo recibido
        </label>
        <input
          type="number"
          value={cashReceived}
          onChange={(e) => setCashReceived(e.target.value)}
          placeholder="0"
          className="w-full px-4 py-4 text-2xl font-bold text-center border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-0"
          autoFocus
        />
      </div>

      {cashReceivedNum > 0 && (
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-gray-600">Recibido:</span>
            <span className="font-bold">{formatCurrency(cashReceivedNum)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Devolver:</span>
            <span className={`text-2xl font-bold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(change)}
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep('method')} className="flex-1">
          Cambiar metodo
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!canConfirmPayment() || isLoading}
          className="flex-1"
        >
          {isLoading ? 'Procesando...' : 'Finalizar Venta'}
        </Button>
      </div>
    </>
  );

  const renderTransferPayment = () => (
    <>
      <h2 className="text-xl font-bold text-center mb-2">Pago por Transferencia</h2>
      <p className="text-center text-gray-500 mb-6">
        Total: <span className="font-bold text-gray-900">{formatCurrency(total)}</span>
      </p>

      <div className="bg-blue-50 rounded-xl p-6 mb-6 text-center">
        <div className="text-4xl mb-3">📱</div>
        <p className="text-gray-700 mb-2">
          Solicita al cliente que realice la transferencia por:
        </p>
        <p className="text-3xl font-bold text-blue-700 mb-4">
          {formatCurrency(total)}
        </p>
        <p className="text-sm text-gray-500">
          Verifica el comprobante antes de confirmar
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setStep('method')} className="flex-1">
          Cambiar metodo
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isLoading}
          className="flex-1"
        >
          {isLoading ? 'Procesando...' : 'Confirmar Pago'}
        </Button>
      </div>
    </>
  );

  const renderMixedPayment = () => {
    const remaining = total - transferAmountNum;
    const totalPaid = transferAmountNum + cashAmountMixedNum;

    return (
      <>
        <h2 className="text-xl font-bold text-center mb-2">Pago Mixto</h2>
        <p className="text-center text-gray-500 mb-6">
          Total: <span className="font-bold text-gray-900">{formatCurrency(total)}</span>
        </p>

        <div className="space-y-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📱 Monto en Transferencia
            </label>
            <input
              type="number"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-3 text-xl font-bold text-center border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              💵 Efectivo recibido
              {transferAmountNum > 0 && (
                <span className="text-amber-600 ml-2">
                  (Faltan {formatCurrency(Math.max(0, remaining))})
                </span>
              )}
            </label>
            <input
              type="number"
              value={cashAmountMixed}
              onChange={(e) => setCashAmountMixed(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-3 text-xl font-bold text-center border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-0"
            />
          </div>
        </div>

        {(transferAmountNum > 0 || cashAmountMixedNum > 0) && (
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">Transferencia:</span>
              <span className="font-medium text-blue-600">{formatCurrency(transferAmountNum)}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">Efectivo:</span>
              <span className="font-medium text-green-600">{formatCurrency(cashAmountMixedNum)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
              <span className="text-gray-600">Total pagado:</span>
              <span className={`font-bold ${totalPaid >= total ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totalPaid)}
              </span>
            </div>
            {change > 0 && (
              <div className="flex justify-between mt-2">
                <span className="text-gray-600">Devolver:</span>
                <span className="text-xl font-bold text-amber-600">{formatCurrency(change)}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep('method')} className="flex-1">
            Cambiar metodo
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirmPayment() || isLoading}
            className="flex-1"
          >
            {isLoading ? 'Procesando...' : 'Finalizar Venta'}
          </Button>
        </div>
      </>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        {renderStep()}
      </div>
    </div>
  );
}
