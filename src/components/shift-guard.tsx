'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore, isOwner } from '@/stores/auth-store';
import { useShiftStore } from '@/stores/shift-store';
import Link from 'next/link';

interface ShiftGuardProps {
  children: React.ReactNode;
  requireInventoryCount?: boolean; // Si requiere conteo de inventario (para turno día)
}

export function ShiftGuard({ children, requireInventoryCount = true }: ShiftGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const employee = useAuthStore((state) => state.employee);
  const { currentShift, setShift } = useShiftStore();
  const [isChecking, setIsChecking] = useState(true);
  const [hasShift, setHasShift] = useState(false);
  const [hasInventoryCount, setHasInventoryCount] = useState(false);
  const [needsInventoryCount, setNeedsInventoryCount] = useState(false);

  useEffect(() => {
    const checkShift = async () => {
      if (!employee) {
        router.push('/login');
        return;
      }

      let activeShift = currentShift;

      try {
        // Usar API server-side para evitar problemas de RLS con el cliente anónimo
        const params = new URLSearchParams({ employee_id: employee.id });
        if (currentShift) params.set('shift_id', currentShift.id);

        const res = await fetch(`/api/shifts/active?${params}`);
        const data = await res.json();
        const shift = data.shift;

        if (shift) {
          setShift(shift);
          activeShift = shift;
          setHasShift(true);
        } else {
          setShift(null);
          activeShift = null;
          setHasShift(false);
          setIsChecking(false);
          return;
        }
      } catch {
        // En caso de error de red, confiar en el store si hay un turno guardado
        if (currentShift) {
          activeShift = currentShift;
          setHasShift(true);
        } else {
          setHasShift(false);
          setIsChecking(false);
          return;
        }
      }

      // Si es turno de día y requireInventoryCount está activo, verificar conteo
      if (activeShift && activeShift.type === 'day' && requireInventoryCount) {
        // Buscar si ya hizo el conteo de inventario para este turno
        const countRes = await fetch(
          `/api/inventory/counts/check?shift_id=${activeShift.id}&employee_id=${employee.id}`
        );
        const countData = countRes.ok ? await countRes.json() : { has_count: false };

        if (countData.has_count) {
          setHasInventoryCount(true);
          setNeedsInventoryCount(false);
        } else {
          setHasInventoryCount(false);
          setNeedsInventoryCount(true);
        }
      } else {
        // Turno de noche o no requiere conteo
        setHasInventoryCount(true);
        setNeedsInventoryCount(false);
      }

      setIsChecking(false);
    };

    checkShift();
  }, [employee, currentShift, router, setShift, requireInventoryCount]);

  // Owners y superadmins pueden acceder sin turno activo
  if (isOwner(employee?.role)) {
    return <>{children}</>;
  }

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

  // Si necesita conteo de inventario y no está en la página de conteo
  if (needsInventoryCount && !hasInventoryCount && pathname !== '/inventory/count') {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md text-center shadow-sm">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Conteo de Inventario Requerido
          </h2>
          <p className="text-gray-600 mb-6">
            Antes de iniciar el turno de día, debes registrar el conteo de inventario inicial.
          </p>
          <Link
            href="/inventory/count"
            className="inline-flex items-center justify-center px-6 py-3 bg-blue-500 text-white font-medium rounded-xl hover:bg-blue-600 transition-colors"
          >
            Registrar Conteo
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
