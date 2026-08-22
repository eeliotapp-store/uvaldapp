'use client';

import { useState } from 'react';
import { useDemoStore } from '@/stores/demo-store';
import { formatDate, formatTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function DemoObservationsPage() {
  const { shift, observations, addObservation, deleteObservation } = useDemoStore();
  const [newObservation, setNewObservation] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newObservation.trim()) return;
    addObservation(newObservation);
    setNewObservation('');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Observaciones — Práctica</h1>
        <p className="text-gray-500 dark:text-neutral-400 text-sm">Registra notas durante tu turno</p>
      </div>

      {shift ? (
        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-neutral-100">Nueva Observación</h2>
          <form onSubmit={handleSubmit}>
            <textarea
              value={newObservation}
              onChange={(e) => setNewObservation(e.target.value)}
              placeholder="Escribe tu observación aquí... (ej: Se rompió una cerveza Corona, Se compró hielo por $10,000)"
              className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm resize-none focus:border-amber-500 focus:ring-0"
              rows={3}
            />
            <div className="mt-3 flex justify-end">
              <Button type="submit" disabled={!newObservation.trim()} className="bg-amber-500 hover:bg-amber-600 focus:ring-amber-500">
                Guardar Observación
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
          <p className="text-amber-800 dark:text-amber-400">
            <strong>Sin turno activo.</strong> Debes iniciar un turno para poder agregar observaciones.
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-neutral-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-neutral-100">Historial de Observaciones</h2>
        </div>

        {observations.length === 0 ? (
          <div className="p-8 text-center">
            <NoteIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-neutral-400">No hay observaciones todavía</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-neutral-700">
            {observations.map((obs) => (
              <div key={obs.id} className="p-4 hover:bg-gray-50 dark:hover:bg-neutral-950">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-gray-700 dark:text-neutral-300 whitespace-pre-wrap">{obs.content}</p>
                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-2">
                      {formatDate(obs.createdAt)} a las {formatTime(obs.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteObservation(obs.id)}
                    className="text-gray-500 dark:text-neutral-400 hover:text-red-500 p-1"
                    title="Eliminar"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
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
