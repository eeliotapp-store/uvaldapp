'use client';

import { useState } from 'react';
import { useAuthStore, isOwner } from '@/stores/auth-store';

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

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function TagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}

function TruckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

type ClearType = 'inventory' | 'sales' | 'shifts' | 'products' | 'suppliers' | 'all';

interface ClearOption {
  type: ClearType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  endpoint: string;
  confirm: string;
  danger?: boolean;
}

const clearOptions: ClearOption[] = [
  {
    type: 'inventory',
    label: 'Vaciar Inventario',
    description: 'Pone la cantidad de todos los productos en cero sin eliminarlos',
    icon: DatabaseIcon,
    endpoint: '/api/admin/clear-inventory',
    confirm: 'VACIAR_INVENTARIO',
  },
  {
    type: 'sales',
    label: 'Vaciar Ventas',
    description: 'Elimina todas las ventas y sus items',
    icon: ShoppingCartIcon,
    endpoint: '/api/admin/clear-sales',
    confirm: 'VACIAR_VENTAS',
  },
  {
    type: 'shifts',
    label: 'Vaciar Turnos',
    description: 'Elimina todos los turnos registrados',
    icon: ClockIcon,
    endpoint: '/api/admin/clear-shifts',
    confirm: 'VACIAR_TURNOS',
  },
  {
    type: 'products',
    label: 'Vaciar Productos',
    description: 'Elimina todos los productos (y sus ventas/inventario)',
    icon: TagIcon,
    endpoint: '/api/admin/clear-products',
    confirm: 'VACIAR_PRODUCTOS',
  },
  {
    type: 'suppliers',
    label: 'Vaciar Proveedores',
    description: 'Elimina todos los proveedores',
    icon: TruckIcon,
    endpoint: '/api/admin/clear-suppliers',
    confirm: 'VACIAR_PROVEEDORES',
  },
  {
    type: 'all',
    label: 'Reiniciar Sistema Completo',
    description: 'Elimina TODOS los datos: ventas, inventario, turnos, productos y proveedores',
    icon: RefreshIcon,
    endpoint: '/api/admin/clear-all',
    confirm: 'VACIAR_TODO_EL_SISTEMA',
    danger: true,
  },
];

export default function AdminPage() {
  const { employee } = useAuthStore();
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ClearOption | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const canExecute = isOwner(employee?.role);

  const handleClear = async (option: ClearOption) => {
    setLoading(option.type);
    setResult(null);
    try {
      const res = await fetch(option.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: option.confirm }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: data.message || `${option.label} completado` });
      } else {
        setResult({ success: false, message: data.error || `Error en ${option.label}` });
      }
    } catch {
      setResult({ success: false, message: 'Error de conexión' });
    } finally {
      setLoading(null);
      setConfirmDialog(null);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Panel de Administración</h1>
      <p className="text-gray-600 mb-6">Herramientas para gestionar y reiniciar el sistema</p>

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

      {!canExecute && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
          Solo owner o superadmin pueden ejecutar estas acciones. Tu rol actual: <strong>{employee?.role}</strong>
        </div>
      )}

      {/* Opciones individuales */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Vaciar por sección</h2>
        <div className="space-y-3">
          {clearOptions.filter(o => !o.danger).map((option) => {
            const Icon = option.icon;
            return (
              <div key={option.type} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">{option.label}</p>
                    <p className="text-sm text-gray-500">{option.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => setConfirmDialog(option)}
                  disabled={loading !== null || !canExecute}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                >
                  <TrashIcon className="w-4 h-4" />
                  Vaciar
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Opción nuclear */}
      <div className="bg-red-50 rounded-xl shadow-sm border-2 border-red-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangleIcon className="w-8 h-8 text-red-600" />
          <div>
            <h2 className="text-lg font-semibold text-red-900">Zona de Peligro Extremo</h2>
            <p className="text-sm text-red-700">Esta acción eliminará TODOS los datos del sistema</p>
          </div>
        </div>

        {clearOptions.filter(o => o.danger).map((option) => {
          const Icon = option.icon;
          return (
            <div key={option.type} className="flex items-center justify-between p-4 bg-white rounded-lg border border-red-200">
              <div className="flex items-center gap-3">
                <Icon className="w-6 h-6 text-red-600" />
                <div>
                  <p className="font-semibold text-red-900">{option.label}</p>
                  <p className="text-sm text-red-700">{option.description}</p>
                </div>
              </div>
              <button
                onClick={() => setConfirmDialog(option)}
                disabled={loading !== null || !canExecute}
                className="px-6 py-3 bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
              >
                <RefreshIcon className="w-5 h-5" />
                Reiniciar Todo
              </button>
            </div>
          );
        })}
      </div>

      {/* Modal de confirmación */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-full ${confirmDialog.danger ? 'bg-red-100' : 'bg-orange-100'}`}>
                <AlertTriangleIcon className={`w-6 h-6 ${confirmDialog.danger ? 'text-red-600' : 'text-orange-600'}`} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Confirmar: {confirmDialog.label}</h3>
            </div>
            <p className="text-gray-600 mb-2">
              {confirmDialog.danger
                ? '¿Estás ABSOLUTAMENTE seguro? Esta acción eliminará TODOS los datos del sistema:'
                : '¿Estás seguro de que quieres continuar?'}
            </p>
            {confirmDialog.danger && (
              <ul className="text-sm text-gray-500 mb-4 list-disc list-inside">
                <li>Todas las ventas y sus items</li>
                <li>Todo el inventario</li>
                <li>Todos los turnos</li>
                <li>Todos los productos</li>
                <li>Todos los proveedores</li>
              </ul>
            )}
            <p className="text-red-600 font-medium mb-6">Esta acción NO se puede deshacer.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDialog(null)}
                disabled={loading !== null}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleClear(confirmDialog)}
                disabled={loading !== null}
                className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 flex items-center gap-2 ${
                  confirmDialog.danger ? 'bg-red-700 hover:bg-red-800' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <TrashIcon className="w-4 h-4" />
                    Sí, {confirmDialog.danger ? 'reiniciar todo' : 'vaciar'}
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
