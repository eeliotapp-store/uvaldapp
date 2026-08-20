'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDemoStore, type DemoProduct } from '@/stores/demo-store';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function DemoPosPage() {
  const router = useRouter();
  const { shift, products, tabs, openTab, addItemToTab, decrementItemInTab, closeTab } = useDemoStore();

  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);

  useEffect(() => {
    if (!shift) router.replace('/demo/shifts/start');
  }, [shift, router]);

  if (!shift) return null;

  // Si la mesa seleccionada ya no existe (se cerró), caer a la primera disponible
  const selectedTab = tabs.find((t) => t.id === selectedTabId) || tabs[0] || null;
  const tabTotal = selectedTab
    ? selectedTab.items.reduce((sum, i) => sum + i.product.sale_price * i.quantity, 0)
    : 0;

  const handleNewTab = () => {
    const id = openTab();
    setSelectedTabId(id);
  };

  const handleConfirmPayment = (method: 'cash' | 'transfer') => {
    if (!selectedTab) return;
    closeTab(selectedTab.id, method);
    setShowPayment(false);
  };

  return (
    <div className="h-[calc(100vh-10rem)] lg:h-[calc(100vh-6rem)]">
      <div className="flex flex-col lg:flex-row gap-4 h-full">
        {/* Mesas + productos */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-neutral-100">
              Punto de Venta — Práctica
            </h1>
            <Button onClick={handleNewTab} className="bg-amber-500 hover:bg-amber-600 focus:ring-amber-500">
              + Nueva Mesa
            </Button>
          </div>

          {/* Tabs de mesas */}
          {tabs.length > 0 && (
            <div className="flex gap-2 mb-4 flex-wrap">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTabId(tab.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedTab?.id === tab.id
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-neutral-300'
                  }`}
                >
                  {tab.tableNumber} ({tab.items.reduce((s, i) => s + i.quantity, 0)})
                </button>
              ))}
            </div>
          )}

          {tabs.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-neutral-400 bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 mb-4">
              No hay mesas abiertas. Crea una para empezar a vender.
            </div>
          )}

          {/* Grid de productos */}
          {selectedTab && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={() => addItemToTab(selectedTab.id, product)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Carrito de la mesa seleccionada */}
        <div className="lg:w-96 bg-gray-100 dark:bg-neutral-700 rounded-xl p-4 flex flex-col">
          <h2 className="font-bold text-gray-900 dark:text-neutral-100 mb-4">
            {selectedTab ? selectedTab.tableNumber : 'Carrito'}
          </h2>

          {!selectedTab && (
            <p className="text-sm text-gray-500 dark:text-neutral-400">
              Selecciona o crea una mesa para agregar productos.
            </p>
          )}

          {selectedTab && (
            <>
              <div className="flex-1 overflow-y-auto space-y-2">
                {selectedTab.items.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-neutral-400">Mesa vacía. Toca un producto para agregarlo.</p>
                )}
                {selectedTab.items.map((item) => (
                  <div
                    key={item.product.id}
                    className="bg-white dark:bg-neutral-800 rounded-lg p-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-neutral-100 text-sm">{item.product.name}</p>
                      <p className="text-xs text-gray-500 dark:text-neutral-400">
                        {formatCurrency(item.product.sale_price)} x {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => decrementItemInTab(selectedTab.id, item.product.id)}
                        className="w-7 h-7 rounded-full bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-neutral-200 font-bold"
                      >
                        −
                      </button>
                      <span className="w-5 text-center font-medium">{item.quantity}</span>
                      <button
                        onClick={() => addItemToTab(selectedTab.id, item.product)}
                        className="w-7 h-7 rounded-full bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-neutral-200 font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 dark:border-neutral-600 mt-4 pt-4">
                <div className="flex justify-between mb-3">
                  <span className="font-bold text-gray-900 dark:text-neutral-100">Total</span>
                  <span className="font-bold text-lg text-gray-900 dark:text-neutral-100">
                    {formatCurrency(tabTotal)}
                  </span>
                </div>
                <Button
                  onClick={() => setShowPayment(true)}
                  disabled={selectedTab.items.length === 0}
                  className="w-full bg-amber-500 hover:bg-amber-600 focus:ring-amber-500"
                >
                  Cobrar Mesa
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {showPayment && selectedTab && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-neutral-100 mb-2">Cobrar {selectedTab.tableNumber}</h2>
            <p className="text-3xl font-bold text-center my-6 text-gray-900 dark:text-neutral-100">
              {formatCurrency(tabTotal)}
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => handleConfirmPayment('cash')}
                className="py-4 rounded-xl bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 font-bold"
              >
                💵 Efectivo
              </button>
              <button
                onClick={() => handleConfirmPayment('transfer')}
                className="py-4 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 font-bold"
              >
                🏦 Transferencia
              </button>
            </div>
            <button
              onClick={() => setShowPayment(false)}
              className="w-full py-2 text-gray-500 dark:text-neutral-400 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, onAdd }: { product: DemoProduct; onAdd: () => void }) {
  const outOfStock = product.stock <= 0;
  return (
    <button
      onClick={onAdd}
      disabled={outOfStock}
      className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-3 text-left hover:border-amber-400 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <p className="font-medium text-gray-900 dark:text-neutral-100 text-sm truncate">{product.name}</p>
      <p className="text-amber-600 dark:text-amber-400 font-bold">{formatCurrency(product.sale_price)}</p>
      <p className={`text-xs mt-1 ${outOfStock ? 'text-red-500' : 'text-gray-500 dark:text-neutral-400'}`}>
        {outOfStock ? 'Sin stock' : `Stock: ${product.stock}`}
      </p>
    </button>
  );
}
