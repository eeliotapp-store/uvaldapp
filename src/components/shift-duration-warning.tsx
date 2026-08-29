'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useShiftStore } from '@/stores/shift-store';

/**
 * Aviso de "turno abierto hace mucho".
 *
 * Muchas jornadas quedaban abiertas por días/semanas porque nadie cerraba el turno,
 * lo que inflaba la duración y mezclaba varios días de ventas en un mismo turno.
 * Este banner le recuerda a la empleada/dueña cerrar el turno cuando ya lleva
 * demasiadas horas abierto. No bloquea nada: solo recuerda.
 *
 * Los umbrales salen del histórico real (percentil 95 de la duración activa —de inicio
 * hasta la última venta— + un pequeño margen), así solo avisa cuando el turno ya se salió
 * de lo normal, sin molestar en jornadas largas legítimas:
 *   - Día:   activo ~9-13h (p95 14.9h), inicia ~9am → avisar a las 15h (~medianoche).
 *   - Noche: activo ~6-9h  (p95 8.6h),  inicia ~7pm → avisar a las 11h (~6am).
 * Si hace falta afinar, cambiar WARN_AFTER_HOURS.
 */
const WARN_AFTER_HOURS: Record<'day' | 'night', number> = {
  day: 15,
  night: 11,
};

export function ShiftDurationWarning() {
  const currentShift = useShiftStore((s) => s.currentShift);
  const [hoursOpen, setHoursOpen] = useState<number | null>(null);

  useEffect(() => {
    if (!currentShift?.start_time) {
      setHoursOpen(null);
      return;
    }

    const compute = () => {
      const start = new Date(currentShift.start_time).getTime();
      setHoursOpen((Date.now() - start) / 3_600_000);
    };

    compute();
    // Recalcular cada minuto para que el aviso aparezca solo, sin recargar la página.
    const id = setInterval(compute, 60_000);
    return () => clearInterval(id);
  }, [currentShift?.id, currentShift?.start_time]);

  const threshold = currentShift ? WARN_AFTER_HOURS[currentShift.type] : Infinity;
  if (hoursOpen === null || hoursOpen < threshold) return null;

  const rounded = Math.floor(hoursOpen);

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 sm:flex-row sm:items-center dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-200">
      <svg
        className="h-6 w-6 shrink-0 text-amber-500 dark:text-amber-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v3.75m0 3.75h.008M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.29 2.25h17.78a1.5 1.5 0 0 0 1.29-2.25L13.71 3.86a1.5 1.5 0 0 0-2.58 0Z"
        />
      </svg>

      <div className="flex-1 text-sm">
        <p className="font-semibold">Tu turno lleva {rounded} h abierto</p>
        <p className="opacity-80">
          Recuerda cerrarlo al terminar la jornada para que los reportes queden correctos.
        </p>
      </div>

      <Link
        href="/shifts/close"
        className="inline-flex shrink-0 items-center justify-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
      >
        Cerrar turno
      </Link>
    </div>
  );
}
