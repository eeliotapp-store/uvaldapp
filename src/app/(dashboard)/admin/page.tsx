'use client';

import { useState } from 'react';
import { useAuthStore, isSuperAdmin } from '@/stores/auth-store';

// SVG Icons
function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function DatabaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  );
}

function ShoppingCartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

export default function AdminPage() {
  const { employee } = useAuthStore();
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'inventory' | 'sales' | null;
    open: boolean;
  }>({ type: null, open: false });
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const canExecute = isSuperAdmin(employee?.role);

  const handleClearInventory = async () => {
    setLoading('inventory');
    setResult(null);
    try {
      const res = await fetch('/api/admin/clear-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'VACIAR_INVENTARIO' }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: 'Inventario vaciado correctamente' });
      } else {
        setResult({ success: false, message: data.error || 'Error al vaciar inventario' });
      }
    } catch {
      setResult({ success: false, message: 'Error de conexión' });
    } finally {
      setLoading(null);
      setConfirmDialog({ type: null, open: false });
    }
  };

  const handleClearSales = async () => {
    setLoading('sales');
    setResult(null);
    try {
      const res = await fetch('/api/admin/clear-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'VACIAR_VENTAS' }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: 'Ventas vaciadas correctamente' });
      } else {
        setResult({ success: false, message: data.error || 'Error al vaciar ventas' });
      }
    } catch {
      setResult({ success: false, message: 'Error de conexión' });
    } finally {
      setLoading(null);
      setConfirmDialog({ type: null, open: false });
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Panel de Administración</h1>

      {/* Resultado de la acción */}
      {result && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {result.message}
        </div>
      )}

      {/* Sección de datos de prueba */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangleIcon className="w-6 h-6 text-red-500" />
          <h2 className="text-lg font-semibold text-gray-900">Zona de Peligro</h2>
        </div>
        <p className="text-gray-600 mb-6">
          Estas acciones son irreversibles. Usa con precaución.
        </p>

        {!canExecute && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
            Solo el superadmin puede ejecutar estas acciones. Tu rol actual: {employee?.role}
          </div>
        )}

        <div className="space-y-4">
          {/* Vaciar Inventario */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <DatabaseIcon className="w-5 h-5 text-gray-600" />
              <div>
                <p className="font-medium text-gray-900">Vaciar Inventario</p>
                <p className="text-sm text-gray-500">Elimina todos los registros de inventario</p>
              </div>
            </div>
            <button
              onClick={() => setConfirmDialog({ type: 'inventory', open: true })}
              disabled={loading !== null || !canExecute}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <TrashIcon className="w-4 h-4" />
              Vaciar
            </button>
          </div>

          {/* Vaciar Ventas */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <ShoppingCartIcon className="w-5 h-5 text-gray-600" />
              <div>
                <p className="font-medium text-gray-900">Vaciar Ventas</p>
                <p className="text-sm text-gray-500">Elimina todas las ventas y sus items</p>
              </div>
            </div>
            <button
              onClick={() => setConfirmDialog({ type: 'sales', open: true })}
              disabled={loading !== null || !canExecute}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <TrashIcon className="w-4 h-4" />
              Vaciar
            </button>
          </div>
        </div>
      </div>

      {/* Modal de confirmación */}
      {confirmDialog.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangleIcon className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Confirmar acción</h3>
            </div>
            <p className="text-gray-600 mb-6">
              {confirmDialog.type === 'inventory'
                ? '¿Estás seguro de que quieres vaciar TODO el inventario? Esta acción no se puede deshacer.'
                : '¿Estás seguro de que quieres vaciar TODAS las ventas? Esta acción no se puede deshacer.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDialog({ type: null, open: false })}
                disabled={loading !== null}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDialog.type === 'inventory' ? handleClearInventory : handleClearSales}
                disabled={loading !== null}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <TrashIcon className="w-4 h-4" />
                    Sí, vaciar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
