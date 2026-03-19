'use client';

import { useEffect, useState } from 'react';
import { formatDate, formatTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ShiftGuard } from '@/components/shift-guard';
import { useAuthStore, isOwner } from '@/stores/auth-store';
import { useShiftStore } from '@/stores/shift-store';

interface Observation {
  id: string;
  employee_id: string;
  shift_id: string;
  content: string;
  created_at: string;
  employees: { id: string; name: string };
  shifts: { id: string; type: string; start_time: string; end_time: string | null };
}

export default function ObservationsPage() {
  return (
    <ShiftGuard>
      <ObservationsContent />
    </ShiftGuard>
  );
}

function ObservationsContent() {
  const employee = useAuthStore((state) => state.employee);
  const { currentShift } = useShiftStore();
  const [observations, setObservations] = useState<Observation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newObservation, setNewObservation] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [filters, setFilters] = useState({
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadObservations();
  }, [filters]);

  const loadObservations = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);

      const response = await fetch(`/api/observations?${params}`);
      const data = await response.json();
      setObservations(data.observations || []);
    } catch (error) {
      console.error('Error loading observations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newObservation.trim()) return;
    if (!currentShift || !employee) {
      setError('Debes tener un turno activo para agregar observaciones');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employee.id,
          shift_id: currentShift.id,
          content: newObservation.trim(),
        }),
      });

      if (response.ok) {
        setNewObservation('');
        setSuccess('Observación registrada correctamente');
        loadObservations();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const data = await response.json();
        setError(data.error || 'Error al guardar observación');
      }
    } catch (error) {
      console.error('Error creating observation:', error);
      setError('Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta observación?')) return;

    try {
      const response = await fetch(`/api/observations/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadObservations();
      } else {
        alert('Error al eliminar observación');
      }
    } catch (error) {
      console.error('Error deleting observation:', error);
      alert('Error de conexión');
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Observaciones</h1>
          <p className="text-gray-500 text-sm">
            Registra notas y observaciones durante tu turno
          </p>
        </div>
      </div>

      {/* Formulario para agregar observación */}
      {currentShift ? (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Nueva Observación</h2>
          <form onSubmit={handleSubmit}>
            <textarea
              value={newObservation}
              onChange={(e) => setNewObservation(e.target.value)}
              placeholder="Escribe tu observación aquí... (ej: Se rompió una cerveza Corona, Se compró hielo por $10,000)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm resize-none focus:border-amber-500 focus:ring-0"
              rows={3}
            />
            {error && (
              <p className="text-red-500 text-sm mt-2">{error}</p>
            )}
            {success && (
              <p className="text-green-500 text-sm mt-2">{success}</p>
            )}
            <div className="mt-3 flex justify-end">
              <Button
                type="submit"
                disabled={isSubmitting || !newObservation.trim()}
              >
                {isSubmitting ? 'Guardando...' : 'Guardar Observación'}
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <p className="text-yellow-800">
            <strong>Sin turno activo.</strong> Debes iniciar un turno para poder agregar observaciones.
          </p>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Desde
            </label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hasta
            </label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      {/* Lista de observaciones */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Historial de Observaciones</h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto"></div>
            <p className="text-gray-500 mt-2">Cargando...</p>
          </div>
        ) : observations.length === 0 ? (
          <div className="p-8 text-center">
            <NoteIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay observaciones en este período</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {observations.map((obs) => (
              <div key={obs.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-gray-900">
                        {obs.employees?.name || 'Empleado'}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        Turno {obs.shifts?.type === 'day' ? 'Día' : 'Noche'}
                      </span>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{obs.content}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {formatDate(obs.created_at)} a las {formatTime(obs.created_at)}
                    </p>
                  </div>
                  {isOwner(employee?.role) && (
                    <button
                      onClick={() => handleDelete(obs.id)}
                      className="text-gray-400 hover:text-red-500 p-1"
                      title="Eliminar"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
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
