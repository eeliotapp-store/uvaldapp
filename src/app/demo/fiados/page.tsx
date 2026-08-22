'use client';

import { useState } from 'react';
import { useDemoStore, fiadoPaid, type DemoFiado, type PayMethod } from '@/stores/demo-store';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';

type StatusFilter = 'pending' | 'paid' | 'all';

const METHOD_LABEL: Record<PayMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  mixed: 'Mixto',
};

export default function DemoFiadosPage() {
  const { fiados, addFiadoPayment } = useDemoStore();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');

  const [paymentModal, setPaymentModal] = useState<DemoFiado | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PayMethod>('cash');
  const [payCash, setPayCash] = useState('');
  const [payTransfer, setPayTransfer] = useState('');

  const filtered = fiados.filter((f) => {
    if (statusFilter === 'pending') return !f.paid;
    if (statusFilter === 'paid') return f.paid;
    return true;
  });

  const summary = {
    total_pending: fiados.filter((f) => !f.paid).reduce((sum, f) => sum + Math.max(0, f.fiadoAmount - fiadoPaid(f)), 0),
    total_paid: fiados.filter((f) => f.paid).reduce((sum, f) => sum + f.fiadoAmount, 0),
    count_pending: fiados.filter((f) => !f.paid).length,
    count_paid: fiados.filter((f) => f.paid).length,
  };

  const openPaymentModal = (fiado: DemoFiado) => {
    const remaining = Math.max(0, fiado.fiadoAmount - fiadoPaid(fiado));
    setPaymentModal(fiado);
    setPayAmount(remaining.toString());
    setPayMethod('cash');
    setPayCash(remaining.toString());
    setPayTransfer('');
  };

  const closePaymentModal = () => {
    setPaymentModal(null);
    setPayAmount('');
    setPayCash('');
    setPayTransfer('');
  };

  const handleRegisterPayment = () => {
    if (!paymentModal) return;
    const amount = parseFloat(payAmount) || 0;
    if (amount <= 0) return;

    if (payMethod === 'cash') {
      addFiadoPayment(paymentModal.id, amount, 'cash', amount, 0);
    } else if (payMethod === 'transfer') {
      addFiadoPayment(paymentModal.id, amount, 'transfer', 0, amount);
    } else {
      addFiadoPayment(paymentModal.id, amount, 'mixed', parseFloat(payCash) || 0, parseFloat(payTransfer) || 0);
    }
    closePaymentModal();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Fiados — Práctica</h1>
        <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">Registro de ventas a crédito</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-800 rounded-xl p-4">
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Pendiente de cobrar</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">{formatCurrency(summary.total_pending)}</p>
          <p className="text-xs text-amber-500 mt-1">{summary.count_pending} fiado{summary.count_pending !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-950 border border-green-100 dark:border-green-800 rounded-xl p-4">
          <p className="text-xs text-green-600 dark:text-green-400 font-medium">Ya cobrado</p>
          <p className="text-2xl font-bold text-green-700 dark:text-green-400 mt-1">{formatCurrency(summary.total_paid)}</p>
          <p className="text-xs text-green-500 mt-1">{summary.count_paid} fiado{summary.count_paid !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-neutral-700 p-1 rounded-lg">
        {(['pending', 'paid', 'all'] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              statusFilter === s ? 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-neutral-100 shadow-sm' : 'text-gray-500 dark:text-neutral-400'
            }`}
          >
            {s === 'pending' ? 'Pendientes' : s === 'paid' ? 'Pagados' : 'Todos'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-neutral-400">
          {statusFilter === 'pending' ? 'No hay fiados pendientes' : 'No hay fiados en esta categoría'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((fiado) => {
            const paid = fiadoPaid(fiado);
            const remaining = Math.max(0, fiado.fiadoAmount - paid);

            return (
              <div
                key={fiado.id}
                className={`bg-white dark:bg-neutral-800 rounded-xl border p-4 shadow-sm ${fiado.paid ? 'border-green-100 dark:border-green-800' : 'border-amber-100 dark:border-amber-800'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 dark:text-neutral-100 truncate">{fiado.customerName}</p>
                      {fiado.paid ? (
                        <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400 rounded-full font-medium">Pagado</span>
                      ) : paid > 0 ? (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-400 rounded-full font-medium">Parcial</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-400 rounded-full font-medium">Pendiente</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3 mt-2">
                      <div>
                        <span className="text-xs text-gray-500 dark:text-neutral-400">Total venta</span>
                        <p className="text-sm font-medium text-gray-700 dark:text-neutral-300">{formatCurrency(fiado.total)}</p>
                      </div>
                      {fiado.abono > 0 && (
                        <div>
                          <span className="text-xs text-gray-500 dark:text-neutral-400">Abono inicial</span>
                          <p className="text-sm font-medium text-green-600 dark:text-green-400">{formatCurrency(fiado.abono)}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-xs text-gray-500 dark:text-neutral-400">Deuda original</span>
                        <p className="text-sm font-bold text-gray-700 dark:text-neutral-300">{formatCurrency(fiado.fiadoAmount)}</p>
                      </div>
                      {paid > 0 && (
                        <div>
                          <span className="text-xs text-gray-500 dark:text-neutral-400">Abonado</span>
                          <p className="text-sm font-bold text-green-600 dark:text-green-400">{formatCurrency(paid)}</p>
                        </div>
                      )}
                      {!fiado.paid && (
                        <div>
                          <span className="text-xs text-gray-500 dark:text-neutral-400">Falta pagar</span>
                          <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{formatCurrency(remaining)}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-500 dark:text-neutral-400">
                      <span>{formatDate(fiado.createdAt)} {formatTime(fiado.createdAt)}</span>
                      {fiado.tableNumber && <span>· Mesa {fiado.tableNumber}</span>}
                    </div>

                    {fiado.payments.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-xs font-medium text-gray-500 dark:text-neutral-400">Pagos registrados:</p>
                        {fiado.payments.map((p) => (
                          <div key={p.id} className="flex justify-between text-xs text-gray-600 dark:text-neutral-300 bg-gray-50 dark:bg-neutral-950 rounded px-2 py-1">
                            <span>{formatDate(p.createdAt)} · {METHOD_LABEL[p.method]}</span>
                            <span className="font-medium text-green-700 dark:text-green-400">{formatCurrency(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {fiado.paid && fiado.paidAt && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">✓ Completado el {formatDate(fiado.paidAt)}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    {!fiado.paid ? (
                      <button
                        onClick={() => openPaymentModal(fiado)}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                      >
                        Registrar pago
                      </button>
                    ) : (
                      <span className="px-3 py-2 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400 rounded-lg text-sm font-medium text-center">✓ Cobrado</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-neutral-100">Registrar pago — {paymentModal.customerName}</h2>
            <p className="text-sm text-gray-500 dark:text-neutral-400">
              Deuda original: {formatCurrency(paymentModal.fiadoAmount)} · Falta:{' '}
              <span className="font-medium text-amber-600 dark:text-amber-400">
                {formatCurrency(Math.max(0, paymentModal.fiadoAmount - fiadoPaid(paymentModal)))}
              </span>
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Monto a pagar</label>
              <input
                type="number"
                value={payAmount}
                onChange={(e) => {
                  setPayAmount(e.target.value);
                  if (payMethod === 'cash') setPayCash(e.target.value);
                }}
                className="w-full px-4 py-3 text-xl font-bold text-center border-2 border-gray-200 dark:border-neutral-700 rounded-xl focus:border-green-500 outline-none"
                placeholder="0"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Método de pago</label>
              <div className="grid grid-cols-3 gap-2">
                {(['cash', 'transfer', 'mixed'] as PayMethod[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setPayMethod(m);
                      if (m === 'cash') setPayCash(payAmount);
                    }}
                    className={`py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      payMethod === m ? 'border-green-500 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400' : 'border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-300'
                    }`}
                  >
                    {m === 'cash' ? '💵 Efectivo' : m === 'transfer' ? '📱 Transfer.' : '💳 Mixto'}
                  </button>
                ))}
              </div>
            </div>

            {payMethod === 'mixed' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-neutral-300 mb-1">Efectivo</label>
                  <input type="number" value={payCash} onChange={(e) => setPayCash(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-center" placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-neutral-300 mb-1">Transferencia</label>
                  <input type="number" value={payTransfer} onChange={(e) => setPayTransfer(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-center" placeholder="0" />
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={closePaymentModal} className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-600 rounded-xl text-sm font-medium text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-950">
                Cancelar
              </button>
              <button
                onClick={handleRegisterPayment}
                disabled={!payAmount || parseFloat(payAmount) <= 0}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                Confirmar pago
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
