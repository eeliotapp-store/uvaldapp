'use client';

import { useDemoStore } from '@/stores/demo-store';
import { formatCurrency } from '@/lib/utils';

export default function DemoInventoryPage() {
  const { products, adjustStock } = useDemoStore();

  const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);
  const totalValue = products.reduce((sum, p) => sum + p.stock * p.sale_price, 0);
  const lowStockCount = products.filter((p) => p.stock <= 5).length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mb-6">
        Inventario — Práctica
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
          <p className="text-sm text-gray-500 dark:text-neutral-400">Productos</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-neutral-100">{products.length}</p>
        </div>
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
          <p className="text-sm text-gray-500 dark:text-neutral-400">Unidades Total</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-neutral-100">{totalUnits}</p>
        </div>
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
          <p className="text-sm text-gray-500 dark:text-neutral-400">Valor Inventario</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(totalValue)}</p>
        </div>
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
          <p className="text-sm text-gray-500 dark:text-neutral-400">Stock Bajo</p>
          <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            {lowStockCount}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-neutral-950 border-b border-gray-200 dark:border-neutral-700">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-neutral-300">Producto</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 dark:text-neutral-300">Stock</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-neutral-300">Precio</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 dark:text-neutral-300">Estado</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 dark:text-neutral-300">Ajustar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-700">
              {products.map((p) => {
                const lowStock = p.stock <= 5;
                return (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-neutral-950">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900 dark:text-neutral-100">{p.name}</span>
                      <p className="text-xs text-gray-500 dark:text-neutral-400 capitalize">
                        {p.category.replace('_', ' ')}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-lg font-bold ${lowStock ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-neutral-100'}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-neutral-300">
                      {formatCurrency(p.sale_price)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {lowStock ? (
                        <span className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-400 rounded-full text-xs font-medium">
                          Bajo
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
                          OK
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => adjustStock(p.id, -1)}
                          className="w-7 h-7 rounded-full bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-neutral-200 font-bold"
                        >
                          −
                        </button>
                        <button
                          onClick={() => adjustStock(p.id, 1)}
                          className="w-7 h-7 rounded-full bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-neutral-200 font-bold"
                        >
                          +
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
