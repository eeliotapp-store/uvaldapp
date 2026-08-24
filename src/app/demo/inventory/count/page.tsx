'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useDemoStore } from '@/stores/demo-store';

export default function DemoInventoryCountPage() {
  const router = useRouter();
  const { shift, products, confirmInventoryCount } = useDemoStore();
  const [realStock, setRealStock] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!shift) router.replace('/demo/shifts/start');
  }, [shift, router]);

  useEffect(() => {
    // Precargar con el stock del sistema, igual que producción
    const initial: Record<string, string> = {};
    products.forEach((p) => { initial[p.id] = p.stock.toString(); });
    setRealStock(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!shift) return null;

  const updateRealStock = (productId: string, value: string) => {
    setRealStock((prev) => ({ ...prev, [productId]: value }));
  };

  const totalDifference = products.reduce((sum, p) => {
    const real = parseInt(realStock[p.id] ?? p.stock.toString()) || 0;
    return sum + (real - p.stock);
  }, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    confirmInventoryCount();
    router.push('/demo/pos');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 shadow-sm">
        <div className="p-6 border-b border-gray-200 dark:border-neutral-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-neutral-100">Conteo de Inventario Inicial — Práctica</h1>
              <p className="text-sm text-gray-500 dark:text-neutral-400">
                Registra el stock real de cada producto para iniciar el turno
              </p>
            </div>
          </div>

          <div className="mt-4 flex gap-4">
            <div className="bg-gray-50 dark:bg-neutral-950 rounded-lg px-4 py-2">
              <p className="text-xs text-gray-500 dark:text-neutral-400">Productos</p>
              <p className="text-lg font-bold text-gray-900 dark:text-neutral-100">{products.length}</p>
            </div>
            <div className={`rounded-lg px-4 py-2 ${
              totalDifference > 0 ? 'bg-green-50 dark:bg-green-950' : totalDifference < 0 ? 'bg-red-50 dark:bg-red-950' : 'bg-gray-50 dark:bg-neutral-950'
            }`}>
              <p className="text-xs text-gray-500 dark:text-neutral-400">Diferencia Total</p>
              <p className={`text-lg font-bold ${
                totalDifference > 0 ? 'text-green-600 dark:text-green-400' : totalDifference < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-neutral-100'
              }`}>
                {totalDifference > 0 ? '+' : ''}{totalDifference}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-neutral-950 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-neutral-300">Producto</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 dark:text-neutral-300 w-28">Sistema</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 dark:text-neutral-300 w-32">Stock Real</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 dark:text-neutral-300 w-24">Dif.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-700">
                {products.map((product) => {
                  const real = parseInt(realStock[product.id] ?? product.stock.toString()) || 0;
                  const difference = real - product.stock;

                  return (
                    <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-neutral-950">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-neutral-100">{product.name}</p>
                        <p className="text-xs text-gray-500 dark:text-neutral-400 capitalize">{product.category.replace('_', ' ')}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-medium text-gray-600 dark:text-neutral-300">{product.stock}</span>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={realStock[product.id] ?? product.stock.toString()}
                          onChange={(e) => updateRealStock(product.id, e.target.value)}
                          min="0"
                          required
                          className="w-full px-3 py-2 text-center font-bold border-2 border-gray-200 dark:border-neutral-700 rounded-lg focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold ${difference > 0 ? 'text-green-600 dark:text-green-400' : difference < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-neutral-400'}`}>
                          {difference !== 0 && (difference > 0 ? '+' : '')}{difference !== 0 ? difference : '-'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-6 border-t border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-950">
            <Button type="submit" disabled={isSubmitting} className="w-full bg-amber-500 hover:bg-amber-600 focus:ring-amber-500">
              {isSubmitting ? 'Guardando...' : 'Confirmar Conteo'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
