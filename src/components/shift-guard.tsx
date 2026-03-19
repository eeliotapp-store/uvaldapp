'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useShiftStore } from '@/stores/shift-store';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

interface ShiftGuardProps {
  children: React.ReactNode;
}

export function ShiftGuard({ children }: ShiftGuardProps) {
  const router = useRouter();
  const employee = useAuthStore((state) => state.employee);
  const { currentShift, setShift } = useShiftStore();
  const [isChecking, setIsChecking] = useState(true);
  const [hasShift, setHasShift] = useState(false);

  useEffect(() => {
    const checkShift = async () => {
      if (!employee) {
        router.push('/login');
        return;
      }

      // Si ya tenemos el turno en el store, verificar que sigue activo
      if (currentShift) {
        const { data: shift } = await supabase
          .from('shifts')
          .select('*')
          .eq('id', currentShift.id)
          .eq('is_active', true)
          .single();

        if (shift) {
          setHasShift(true);
          setIsChecking(false);
          return;
        } else {
          // El turno ya no está activo, limpiarlo
          setShift(null);
        }
      }

      // Buscar turno activo del empleado
      const { data: activeShift } = await supabase
        .from('shifts')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('is_active', true)
        .single();

      if (activeShift) {
        setShift(activeShift);
        setHasShift(true);
      } else {
        setHasShift(false);
      }

      setIsChecking(false);
    };

    checkShift();
  }, [employee, currentShift, router, setShift]);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasShift) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md text-center shadow-sm">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Turno no iniciado
          </h2>
          <p className="text-gray-600 mb-6">
            Debes iniciar un turno antes de poder realizar esta acción.
          </p>
          <Link
            href="/shifts/start"
            className="inline-flex items-center justify-center px-6 py-3 bg-amber-500 text-white font-medium rounded-xl hover:bg-amber-600 transition-colors"
          >
            Iniciar Turno
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
