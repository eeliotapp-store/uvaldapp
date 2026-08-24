'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useDemoStore } from '@/stores/demo-store';

// Igual que ShiftGuard en producción: sin turno activo, no se puede vender —
// y en turno de día, hay que registrar el conteo de inventario inicial antes
// de poder hacerlo. De noche no se exige.
export function DemoShiftGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const shift = useDemoStore((s) => s.shift);

  useEffect(() => {
    if (!shift) router.replace('/demo/shifts/start');
  }, [shift, router]);

  if (!shift) return null;

  const needsInventoryCount = shift.type === 'day' && !shift.inventoryCounted;
  if (needsInventoryCount && pathname !== '/demo/inventory/count') {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-gray-200 dark:border-neutral-700 p-8 max-w-md text-center shadow-sm">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-neutral-100 mb-2">
            Conteo de Inventario Requerido
          </h2>
          <p className="text-gray-600 dark:text-neutral-300 mb-6">
            Antes de iniciar el turno de día, debes registrar el conteo de inventario inicial.
          </p>
          <Link
            href="/demo/inventory/count"
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
