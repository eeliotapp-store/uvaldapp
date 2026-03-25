'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';

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
}

interface Summary {
  total_pending: number;
  total_paid: number;
  count_pending: number;
  count_paid: number;
}

type StatusFilter = 'pending' | 'paid' | 'all';

export default function FiadosPage() {
  const employee = useAuthStore((state) => state.employee);
  const [fiados, setFiados] = useState<Fiado[]>([]);
  const [summary, setSummary] = useState<Summary>({ total_pending: 0, total_paid: 0, count_pending: 0, count_paid: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

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

  const handleMarkPaid = async (fiado: Fiado) => {
    setMarkingId(fiado.id);
    setErrorMessage('');
    try {
      const res = await fetch(`/api/sales/${fiado.id}/fiado-paid`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Error al registrar pago');
        return;
      }
      setSuccessMessage(`✓ Fiado de ${fiado.fiado_customer_name} marcado como pagado`);
      setTimeout(() => setSuccessMessage(''), 3000);
      loadFiados();
    } catch {
      setErrorMessage('Error al registrar pago');
    } finally {
      setMarkingId(null);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomerSearch(searchInput);
  };

  const clearSearch = () => {
    setSearchInput('');
    setCustomerSearch('');
  };

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
          <p className="text-2xl font-bold text-orange-700 mt-1">
            {formatCurrency(summary.total_pending)}
          </p>
          <p className="text-xs text-orange-500 mt-1">{summary.count_pending} fiado{summary.count_pending !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <p className="text-xs text-green-600 font-medium">Ya cobrado</p>
          <p className="text-2xl font-bold text-green-700 mt-1">
            {formatCurrency(summary.total_paid)}
          </p>
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
        {/* Tabs de estado */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['pending', 'paid', 'all'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                statusFilter === s
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s === 'pending' ? 'Pendientes' : s === 'paid' ? 'Pagados' : 'Todos'}
            </button>
          ))}
        </div>

        {/* Búsqueda por nombre */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nombre..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
          >
            Buscar
          </button>
          {customerSearch && (
            <button
              type="button"
              onClick={clearSearch}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
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
          {fiados.map((fiado) => (
            <div
              key={fiado.id}
              className={`bg-white rounded-xl border p-4 shadow-sm ${
                fiado.fiado_paid ? 'border-green-100' : 'border-orange-100'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Nombre cliente + badge de estado */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 truncate">
                      {fiado.fiado_customer_name || 'Sin nombre'}
                    </p>
                    {fiado.fiado_paid ? (
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                        Pagado
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">
                        Pendiente
                      </span>
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
                        <span className="text-xs text-gray-500">Abono</span>
                        <p className="text-sm font-medium text-green-600">{formatCurrency(fiado.fiado_abono || 0)}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-gray-500">Debe</span>
                      <p className={`text-sm font-bold ${fiado.fiado_paid ? 'text-green-600' : 'text-orange-600'}`}>
                        {formatCurrency(fiado.fiado_amount || 0)}
                      </p>
                    </div>
                  </div>

                  {/* Meta info */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-400">
                    <span>{formatDate(fiado.created_at)} {formatTime(fiado.created_at)}</span>
                    {fiado.employees?.name && <span>· {fiado.employees.name}</span>}
                    {fiado.table_number && <span>· Mesa {fiado.table_number}</span>}
                  </div>

                  {/* Pagado info */}
                  {fiado.fiado_paid && fiado.fiado_paid_at && (
                    <p className="text-xs text-green-600 mt-2 font-medium">
                      ✓ Cobrado el {formatDate(fiado.fiado_paid_at)} a las {formatTime(fiado.fiado_paid_at)}
                    </p>
                  )}
                </div>

                {/* Botón marcar como cobrado */}
                {!fiado.fiado_paid && (
                  <button
                    onClick={() => handleMarkPaid(fiado)}
                    disabled={markingId === fiado.id}
                    className="shrink-0 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {markingId === fiado.id ? '...' : 'Marcar cobrado'}
                  </button>
                )}

                {fiado.fiado_paid && (
                  <span className="shrink-0 px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                    ✓ Cobrado
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
