'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';

interface FiadoPayment {
  id: string;
  amount: number;
  payment_method: string;
  cash_amount: number;
  transfer_amount: number;
  created_at: string;
}

interface Fiado {
  id: string;
  fiado_customer_name: string | null;
  fiado_amount: number | null;
  fiado_abono: number | null;
  fiado_paid: boolean;
  fiado_paid_at: string | null;
  total: number;
  created_at: string;
  table_number: string | null;
  employees: { id: string; name: string } | null;
  fiado_payments: FiadoPayment[];
}

interface Summary {
  total_pending: number;
  total_paid: number;
  count_pending: number;
  count_paid: number;
}

type StatusFilter = 'pending' | 'paid' | 'all';
type PayMethod = 'cash' | 'transfer' | 'mixed';

interface PaymentModal {
  fiado: Fiado;
  remaining: number;
}

const METHOD_LABEL: Record<PayMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  mixed: 'Mixto',
};

export default function FiadosPage() {
  const employee = useAuthStore((state) => state.employee);
  const [fiados, setFiados] = useState<Fiado[]>([]);
  const [summary, setSummary] = useState<Summary>({ total_pending: 0, total_paid: 0, count_pending: 0, count_paid: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Modal de pago
  const [paymentModal, setPaymentModal] = useState<PaymentModal | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PayMethod>('cash');
  const [payCash, setPayCash] = useState('');
  const [payTransfer, setPayTransfer] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [modalError, setModalError] = useState('');

  const loadFiados = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter });
      if (customerSearch) params.set('customer_name', customerSearch);
      const res = await fetch(`/api/fiados?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || `Error ${res.status} al cargar los fiados`);
        return;
      }
      setFiados(data.fiados || []);
      setSummary(data.summary || { total_pending: 0, total_paid: 0, count_pending: 0, count_paid: 0 });
    } catch {
      setErrorMessage('Error de conexión al cargar los fiados');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, customerSearch]);

  useEffect(() => {
    loadFiados();
  }, [loadFiados]);

  // Calcular monto ya pagado via fiado_payments
  const getPaidFromPayments = (fiado: Fiado) =>
    (fiado.fiado_payments || []).reduce((sum, p) => sum + p.amount, 0);

  const getRemaining = (fiado: Fiado) =>
    Math.max(0, (fiado.fiado_amount || 0) - getPaidFromPayments(fiado));

  const openPaymentModal = (fiado: Fiado) => {
    const remaining = getRemaining(fiado);
    setPaymentModal({ fiado, remaining });
    setPayAmount(remaining.toString());
    setPayMethod('cash');
    setPayCash(remaining.toString());
    setPayTransfer('');
    setModalError('');
  };

  const closePaymentModal = () => {
    setPaymentModal(null);
    setPayAmount('');
    setPayCash('');
    setPayTransfer('');
    setModalError('');
  };

  const handleRegisterPayment = async () => {
    if (!paymentModal || !employee) return;
    const amount = parseFloat(payAmount) || 0;
    if (amount <= 0) { setModalError('Ingresa un monto válido'); return; }
    if (payMethod === 'mixed') {
      const total = (parseFloat(payCash) || 0) + (parseFloat(payTransfer) || 0);
      if (Math.abs(total - amount) > 1) { setModalError('La suma de efectivo + transferencia debe ser igual al monto'); return; }
    }

    setIsProcessing(true);
    setModalError('');
    try {
      const res = await fetch(`/api/sales/${paymentModal.fiado.id}/fiado-payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          payment_method: payMethod,
          cash_amount: payMethod === 'cash' ? amount : payMethod === 'mixed' ? parseFloat(payCash) || 0 : 0,
          transfer_amount: payMethod === 'transfer' ? amount : payMethod === 'mixed' ? parseFloat(payTransfer) || 0 : 0,
          employee_id: employee.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setModalError(data.error || 'Error al registrar'); return; }

      const nombre = paymentModal.fiado.fiado_customer_name || 'cliente';
      setSuccessMessage(
        data.is_fully_paid
          ? `✓ Fiado de ${nombre} pagado completamente`
          : `✓ Abono de ${formatCurrency(amount)} registrado para ${nombre}`
      );
      setTimeout(() => setSuccessMessage(''), 4000);
      closePaymentModal();
      loadFiados();
    } catch {
      setModalError('Error de conexión');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setCustomerSearch(searchInput); };
  const clearSearch = () => { setSearchInput(''); setCustomerSearch(''); };

  if (!employee) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fiados</h1>
        <p className="text-sm text-gray-500 mt-1">Registro de ventas a crédito</p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
          <p className="text-xs text-orange-600 font-medium">Pendiente de cobrar</p>
          <p className="text-2xl font-bold text-orange-700 mt-1">{formatCurrency(summary.total_pending)}</p>
          <p className="text-xs text-orange-500 mt-1">{summary.count_pending} fiado{summary.count_pending !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <p className="text-xs text-green-600 font-medium">Ya cobrado</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(summary.total_paid)}</p>
          <p className="text-xs text-green-500 mt-1">{summary.count_paid} fiado{summary.count_paid !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Mensajes */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm">
          {errorMessage}
        </div>
      )}

      {/* Filtros */}
      <div className="space-y-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['pending', 'paid', 'all'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                statusFilter === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s === 'pending' ? 'Pendientes' : s === 'paid' ? 'Pagados' : 'Todos'}
            </button>
          ))}
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nombre..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button type="submit" className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors">
            Buscar
          </button>
          {customerSearch && (
            <button type="button" onClick={clearSearch} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              ✕
            </button>
          )}
        </form>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : fiados.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {statusFilter === 'pending' ? 'No hay fiados pendientes' : 'No hay fiados en esta categoría'}
        </div>
      ) : (
        <div className="space-y-3">
          {fiados.map((fiado) => {
            const paid = getPaidFromPayments(fiado);
            const remaining = getRemaining(fiado);
            const payments = fiado.fiado_payments || [];

            return (
              <div
                key={fiado.id}
                className={`bg-white rounded-xl border p-4 shadow-sm ${fiado.fiado_paid ? 'border-green-100' : 'border-orange-100'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Nombre + badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 truncate">
                        {fiado.fiado_customer_name || 'Sin nombre'}
                      </p>
                      {fiado.fiado_paid ? (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Pagado</span>
                      ) : paid > 0 ? (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">Parcial</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">Pendiente</span>
                      )}
                    </div>

                    {/* Montos */}
                    <div className="flex flex-wrap gap-3 mt-2">
                      <div>
                        <span className="text-xs text-gray-500">Total venta</span>
                        <p className="text-sm font-medium text-gray-700">{formatCurrency(fiado.total)}</p>
                      </div>
                      {(fiado.fiado_abono || 0) > 0 && (
                        <div>
                          <span className="text-xs text-gray-500">Abono inicial</span>
                          <p className="text-sm font-medium text-green-600">{formatCurrency(fiado.fiado_abono || 0)}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-xs text-gray-500">Deuda original</span>
                        <p className="text-sm font-bold text-gray-700">{formatCurrency(fiado.fiado_amount || 0)}</p>
                      </div>
                      {paid > 0 && (
                        <div>
                          <span className="text-xs text-gray-500">Abonado</span>
                          <p className="text-sm font-bold text-green-600">{formatCurrency(paid)}</p>
                        </div>
                      )}
                      {!fiado.fiado_paid && (
                        <div>
                          <span className="text-xs text-gray-500">Falta pagar</span>
                          <p className="text-sm font-bold text-orange-600">{formatCurrency(remaining)}</p>
                        </div>
                      )}
                    </div>

                    {/* Meta info */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-400">
                      <span>{formatDate(fiado.created_at)} {formatTime(fiado.created_at)}</span>
                      {fiado.employees?.name && <span>· {fiado.employees.name}</span>}
                      {fiado.table_number && <span>· Mesa {fiado.table_number}</span>}
                    </div>

                    {/* Historial de pagos */}
                    {payments.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-xs font-medium text-gray-500">Pagos registrados:</p>
                        {payments.map((p) => (
                          <div key={p.id} className="flex justify-between text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
                            <span>
                              {formatDate(p.created_at)} · {METHOD_LABEL[p.payment_method as PayMethod] || p.payment_method}
                            </span>
                            <span className="font-medium text-green-700">{formatCurrency(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {fiado.fiado_paid && fiado.fiado_paid_at && (
                      <p className="text-xs text-green-600 mt-2 font-medium">
                        ✓ Completado el {formatDate(fiado.fiado_paid_at)}
                      </p>
                    )}
                  </div>

                  {/* Botón registrar pago */}
                  {!fiado.fiado_paid ? (
                    <button
                      onClick={() => openPaymentModal(fiado)}
                      className="shrink-0 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                    >
                      Registrar pago
                    </button>
                  ) : (
                    <span className="shrink-0 px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                      ✓ Cobrado
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de pago */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">
              Registrar pago — {paymentModal.fiado.fiado_customer_name}
            </h2>
            <p className="text-sm text-gray-500">
              Deuda original: {formatCurrency(paymentModal.fiado.fiado_amount || 0)} ·
              Falta: <span className="font-medium text-orange-600">{formatCurrency(paymentModal.remaining)}</span>
            </p>

            {/* Monto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto a pagar</label>
              <input
                type="number"
                value={payAmount}
                onChange={(e) => {
                  setPayAmount(e.target.value);
                  if (payMethod === 'cash') setPayCash(e.target.value);
                }}
                className="w-full px-4 py-3 text-xl font-bold text-center border-2 border-gray-200 rounded-xl focus:border-green-500 outline-none"
                placeholder="0"
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => { setPayAmount(paymentModal.remaining.toString()); if (payMethod === 'cash') setPayCash(paymentModal.remaining.toString()); }}
                  className="flex-1 text-xs py-1.5 border border-green-300 text-green-700 rounded-lg hover:bg-green-50"
                >
                  Pagar todo ({formatCurrency(paymentModal.remaining)})
                </button>
              </div>
            </div>

            {/* Método de pago */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Método de pago</label>
              <div className="grid grid-cols-3 gap-2">
                {(['cash', 'transfer', 'mixed'] as PayMethod[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setPayMethod(m);
                      if (m === 'cash') setPayCash(payAmount);
                      if (m === 'transfer') setPayTransfer(payAmount);
                    }}
                    className={`py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      payMethod === m ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {m === 'cash' ? '💵 Efectivo' : m === 'transfer' ? '📱 Transfer.' : '💳 Mixto'}
                  </button>
                ))}
              </div>
            </div>

            {/* Campos mixto */}
            {payMethod === 'mixed' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Efectivo</label>
                  <input
                    type="number"
                    value={payCash}
                    onChange={(e) => setPayCash(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Transferencia</label>
                  <input
                    type="number"
                    value={payTransfer}
                    onChange={(e) => setPayTransfer(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center"
                    placeholder="0"
                  />
                </div>
              </div>
            )}

            {modalError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{modalError}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={closePaymentModal}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleRegisterPayment}
                disabled={isProcessing || !payAmount || parseFloat(payAmount) <= 0}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {isProcessing ? 'Guardando...' : 'Confirmar pago'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
