'use client';

import { useState } from 'react';
import { useAuthStore, isSuperAdmin } from '@/stores/auth-store';
import { useRouter } from 'next/navigation';
import { Trash2, AlertTriangle, Database, ShoppingCart } from 'lucide-react';

export default function AdminPage() {
  const { employee } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'inventory' | 'sales' | null;
    open: boolean;
  }>({ type: null, open: false });
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Verificar que sea superadmin
  if (!isSuperAdmin(employee?.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h1>
        <p className="text-gray-600 mb-4">Solo el superadmin puede acceder a esta página.</p>
        <button
          onClick={() => router.push('/pos')}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
        >
          Volver al POS
        </button>
      </div>
    );
  }

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
          <AlertTriangle className="w-6 h-6 text-red-500" />
          <h2 className="text-lg font-semibold text-gray-900">Zona de Peligro</h2>
        </div>
        <p className="text-gray-600 mb-6">
          Estas acciones son irreversibles. Usa con precaución.
        </p>

        <div className="space-y-4">
          {/* Vaciar Inventario */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-gray-600" />
              <div>
                <p className="font-medium text-gray-900">Vaciar Inventario</p>
                <p className="text-sm text-gray-500">Elimina todos los registros de inventario</p>
              </div>
            </div>
            <button
              onClick={() => setConfirmDialog({ type: 'inventory', open: true })}
              disabled={loading !== null}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Vaciar
            </button>
          </div>

          {/* Vaciar Ventas */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-5 h-5 text-gray-600" />
              <div>
                <p className="font-medium text-gray-900">Vaciar Ventas</p>
                <p className="text-sm text-gray-500">Elimina todas las ventas y sus items</p>
              </div>
            </div>
            <button
              onClick={() => setConfirmDialog({ type: 'sales', open: true })}
              disabled={loading !== null}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
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
                <AlertTriangle className="w-6 h-6 text-red-600" />
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
                    <Trash2 className="w-4 h-4" />
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
