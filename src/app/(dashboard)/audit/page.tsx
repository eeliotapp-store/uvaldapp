'use client';

import { useEffect, useState } from 'react';
import { formatDate, formatTime } from '@/lib/utils';
import { useAuthStore, isOwner } from '@/stores/auth-store';
import type { AuditAction, AuditEntity } from '@/types/database';

interface AuditLog {
  id: string;
  action: AuditAction;
  entity_type: AuditEntity;
  entity_id: string;
  employee_id: string;
  employee_name: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  description: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<AuditAction, { label: string; color: string; icon: string }> = {
  CREATE: { label: 'Creado', color: 'bg-green-100 text-green-700', icon: '➕' },
  UPDATE: { label: 'Editado', color: 'bg-blue-100 text-blue-700', icon: '✏️' },
  DELETE: { label: 'Eliminado', color: 'bg-red-100 text-red-700', icon: '🗑️' },
  VOID: { label: 'Anulado', color: 'bg-red-100 text-red-700', icon: '❌' },
  CLOSE: { label: 'Cerrado', color: 'bg-purple-100 text-purple-700', icon: '✅' },
  TAKEOVER: { label: 'Relevo', color: 'bg-amber-100 text-amber-700', icon: '🔄' },
  ADD_ITEMS: { label: 'Items agregados', color: 'bg-green-100 text-green-700', icon: '📦' },
  PRICE_CHANGE: { label: 'Precio cambiado', color: 'bg-orange-100 text-orange-700', icon: '💰' },
};

const ENTITY_LABELS: Record<AuditEntity, string> = {
  SALE: 'Venta',
  SALE_ITEM: 'Item de venta',
  INVENTORY: 'Inventario',
  PRODUCT: 'Producto',
  COMBO: 'Combo',
};

export default function AuditPage() {
  const employee = useAuthStore((state) => state.employee);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Filtros
  const [filters, setFilters] = useState({
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    entity_type: '',
    action: '',
    employee_id: '',
  });

  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [filters]);

  const loadEmployees = async () => {
    try {
      const response = await fetch('/api/employees');
      const data = await response.json();
      setEmployees(data.employees || []);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.entity_type) params.append('entity_type', filters.entity_type);
      if (filters.action) params.append('action', filters.action);
      if (filters.employee_id) params.append('employee_id', filters.employee_id);
      params.append('limit', '200');

      const response = await fetch(`/api/audit?${params}`);
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Error loading audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Solo owners pueden ver esta página
  if (!isOwner(employee?.role)) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <p className="text-gray-600">No tienes permisos para ver esta página</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historial de Actividad</h1>
          <p className="text-sm text-gray-500">Registro de todas las acciones del sistema</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tipo</label>
            <select
              value={filters.entity_type}
              onChange={(e) => setFilters({ ...filters, entity_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Todos</option>
              <option value="SALE">Ventas</option>
              <option value="SALE_ITEM">Items de venta</option>
              <option value="INVENTORY">Inventario</option>
              <option value="PRODUCT">Productos</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Acción</label>
            <select
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Todas</option>
              <option value="CREATE">Creación</option>
              <option value="UPDATE">Edición</option>
              <option value="DELETE">Eliminación</option>
              <option value="VOID">Anulación</option>
              <option value="CLOSE">Cierre</option>
              <option value="ADD_ITEMS">Agregar items</option>
              <option value="PRICE_CHANGE">Cambio precio</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Empleado</label>
            <select
              value={filters.employee_id}
              onChange={(e) => setFilters({ ...filters, employee_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Todos</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista de logs */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-4">📋</div>
          <p className="text-gray-500">No hay registros en este periodo</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-700', icon: '📝' };
            const entityLabel = ENTITY_LABELS[log.entity_type] || log.entity_type;

            return (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{actionInfo.icon}</div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${actionInfo.color}`}>
                          {actionInfo.label}
                        </span>
                        <span className="text-xs text-gray-400">{entityLabel}</span>
                      </div>
                      <p className="text-sm text-gray-900 font-medium">
                        {log.description || `${actionInfo.label} - ${entityLabel}`}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Por <span className="font-medium">{log.employee_name}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-400">
                    <p>{formatDate(log.created_at)}</p>
                    <p>{formatTime(log.created_at)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de detalle */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Detalle de Actividad</h2>
                  <p className="text-sm text-gray-500">
                    {formatDate(selectedLog.created_at)} {formatTime(selectedLog.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                {/* Info básica */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">Acción</label>
                    <p className="font-medium">
                      {ACTION_LABELS[selectedLog.action]?.icon} {ACTION_LABELS[selectedLog.action]?.label}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Tipo</label>
                    <p className="font-medium">{ENTITY_LABELS[selectedLog.entity_type]}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Empleado</label>
                    <p className="font-medium">{selectedLog.employee_name}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">ID Entidad</label>
                    <p className="font-mono text-xs">{selectedLog.entity_id.slice(0, 8)}...</p>
                  </div>
                </div>

                {/* Descripción */}
                {selectedLog.description && (
                  <div>
                    <label className="text-xs text-gray-500">Descripción</label>
                    <p className="text-sm bg-gray-50 p-3 rounded-lg mt-1">{selectedLog.description}</p>
                  </div>
                )}

                {/* Valores anteriores */}
                {selectedLog.old_values && Object.keys(selectedLog.old_values).length > 0 && (
                  <div>
                    <label className="text-xs text-gray-500">Valores Anteriores</label>
                    <div className="bg-red-50 p-3 rounded-lg mt-1">
                      <pre className="text-xs text-red-700 whitespace-pre-wrap">
                        {JSON.stringify(selectedLog.old_values, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Valores nuevos */}
                {selectedLog.new_values && Object.keys(selectedLog.new_values).length > 0 && (
                  <div>
                    <label className="text-xs text-gray-500">Valores Nuevos</label>
                    <div className="bg-green-50 p-3 rounded-lg mt-1">
                      <pre className="text-xs text-green-700 whitespace-pre-wrap">
                        {JSON.stringify(selectedLog.new_values, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Metadata */}
                {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                  <div>
                    <label className="text-xs text-gray-500">Información Adicional</label>
                    <div className="bg-gray-50 p-3 rounded-lg mt-1">
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                        {JSON.stringify(selectedLog.metadata, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setSelectedLog(null)}
                className="w-full py-2 text-gray-600 hover:text-gray-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
