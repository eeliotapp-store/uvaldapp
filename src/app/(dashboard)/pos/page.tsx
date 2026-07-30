'use client';

import { useEffect, useState } from 'react';
import { ProductGrid } from '@/components/pos/product-grid';
import { ComboGrid } from '@/components/pos/combo-grid';
import { Cart } from '@/components/pos/cart';
import { PaymentModal } from '@/components/pos/payment-modal';
import { OpenCashRegisterModal } from '@/components/pos/open-cash-register-modal';
import { CashRegisterStatus } from '@/components/pos/cash-register-status';
import { ShiftGuard } from '@/components/shift-guard';
import { useCartStore, MICHELADA_EXTRA } from '@/stores/cart-store';
import { useShiftStore } from '@/stores/shift-store';
import { useAuthStore } from '@/stores/auth-store';
import { useCombosStore } from '@/stores/combos-store';
import { formatCurrency } from '@/lib/utils';
import type { Product, PaymentMethod, ComboWithItems } from '@/types/database';

type TabType = 'products' | 'combos';

export default function POSPage() {
  return (
    <ShiftGuard>
      <POSContent />
    </ShiftGuard>
  );
}

function POSContent() {
  const [activeTab, setActiveTab] = useState<TabType>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [combos, setCombos] = useState<ComboWithItems[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [showOpenCash, setShowOpenCash] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { items, combos: cartCombos, total, clear, addItem } = useCartStore();

  // Estado del modal de cigarrillos → mostrador
  const [showCigModal, setShowCigModal] = useState(false);
  const [cigCounts, setCigCounts] = useState<Record<string, number>>({});
  const [isAddingCig, setIsAddingCig] = useState(false);
  const { currentShift, cashRegister, addCashSale, addTransferSale, addMixedSale } = useShiftStore();
  const employee = useAuthStore((state) => state.employee);
  const combosStore = useCombosStore();

  useEffect(() => {
    loadData();
  }, []);

  // Recargar combos si el store fue invalidado (ej: alguien editó un combo en admin)
  useEffect(() => {
    if (activeTab === 'combos' && combosStore.isStale()) {
      loadData();
    }
  }, [activeTab]);

  // Mostrar mensaje de éxito temporalmente
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const loadData = async () => {
    try {
      // Combos: usar caché si tiene menos de 5 minutos
      const combosStale = combosStore.isStale();
      const combosPromise = combosStale
        ? fetch('/api/combos').then(res => res.json()).catch(() => ({ combos: [] }))
        : Promise.resolve({ combos: combosStore.combos });

      const [productsResult, combosResult] = await Promise.all([
        fetch('/api/products').then(r => r.json()),
        combosPromise,
      ]);

      const allProducts = productsResult.products || [];
      setProducts(allProducts.filter((p: Product) => p.active));
      const fetchedCombos = combosResult.combos || [];
      if (combosStale) combosStore.setCombos(fetchedCombos);
      setCombos(fetchedCombos);

      const stockMapData: Record<string, number> = {};
      allProducts.forEach((item: Product & { current_stock: number }) => {
        stockMapData[item.id] = item.current_stock || 0;
      });
      setStockMap(stockMapData);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Error al cargar datos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToMostrador = async () => {
    if (!employee || !currentShift) return;
    const cigProducts = products.filter(p => p.category === 'cigarros');
    const toAdd = cigProducts.filter(p => (cigCounts[p.id] || 0) > 0);
    if (toAdd.length === 0) return;
    setIsAddingCig(true);
    setError(null);
    try {
      // Enviar cada producto secuencialmente para evitar crear dos tabs en paralelo
      for (const p of toAdd) {
        const res = await fetch('/api/sales/mostrador', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_id: employee.id,
            shift_id: currentShift.id,
            product_id: p.id,
            quantity: cigCounts[p.id],
            unit_price: p.sale_price,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al agregar');
      }
      const resumen = toAdd.map(p => `${cigCounts[p.id]}x ${p.name}`).join(', ');
      setShowCigModal(false);
      setCigCounts({});
      setSuccessMessage(`${resumen} → Mostrador ✓`);
      // Refrescar stock
      const stockRes = await fetch('/api/products');
      const stockData = await stockRes.json();
      const newMap: Record<string, number> = {};
      (stockData.products || []).forEach((p: Product & { current_stock: number }) => {
        newMap[p.id] = p.current_stock || 0;
      });
      setStockMap(newMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al agregar al mostrador');
    } finally {
      setIsAddingCig(false);
    }
  };

  const handleCheckout = async (result: {
    paymentMethod: PaymentMethod;
    cashReceived: number;
    cashChange: number;
    transferAmount: number;
    cashAmount: number;
    notes?: string;
    closeNotes?: string;
  }) => {
    if (!employee || !currentShift) {
      setError('Debes iniciar un turno antes de vender');
      setShowPayment(false);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Preparar items individuales (incluyendo michelada/bomba extra)
      const saleItems = items.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.sale_price + (item.isMichelada ? MICHELADA_EXTRA : 0) + (item.isBomba ? (item.product.bomba_extra || 0) : 0),
        is_michelada: item.isMichelada || false,
        is_bomba: item.isBomba || false,
      }));

      // Preparar combos
      const saleCombos = cartCombos.map((cartCombo) => ({
        combo_id: cartCombo.combo.id,
        final_price: cartCombo.finalPrice,
        items: cartCombo.items.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          is_michelada: item.isMichelada || false,
        })),
      }));

      const response = await fetch('/api/sales/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employee.id,
          shift_id: currentShift.id,
          items: saleItems,
          combos: saleCombos,
          payment_method: result.paymentMethod,
          cash_received: result.cashReceived,
          cash_change: result.cashChange,
          transfer_amount: result.transferAmount,
          cash_amount: result.cashAmount,
          notes: result.notes,
          close_notes: result.closeNotes,
          close: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar la venta');
      }

      // Actualizar caja según método de pago
      if (result.paymentMethod === 'cash') {
        addCashSale(result.cashReceived, result.cashChange);
      } else if (result.paymentMethod === 'transfer') {
        addTransferSale(result.transferAmount);
      } else if (result.paymentMethod === 'mixed') {
        addMixedSale(result.cashReceived, result.transferAmount, result.cashChange);
      }

      // Limpiar carrito y recargar stock
      clear();
      setShowPayment(false);
      await loadData();

      // Mostrar mensaje de éxito
      setSuccessMessage(`Venta completada: ${formatCurrency(total)}`);
    } catch (err) {
      console.error('Error creating sale:', err);
      setError(err instanceof Error ? err.message : 'Error al procesar la venta');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenCashRegister = () => {
    setShowOpenCash(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Si no hay caja abierta, mostrar botón para abrirla
  const needsOpenCash = cashRegister.initialCash === 0 && !showOpenCash;

  return (
    <div className="h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)]">
      <div className="flex flex-col lg:flex-row gap-4 h-full">
        {/* Products/Combos Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900">Punto de Venta</h1>
            <div className="flex items-center gap-2">
              {!currentShift && (
                <span className="text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                  Sin turno activo
                </span>
              )}
              {needsOpenCash && currentShift && (
                <button
                  onClick={() => setShowOpenCash(true)}
                  className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full hover:bg-blue-100"
                >
                  Abrir Caja
                </button>
              )}
            </div>
          </div>

          {/* Estado de la caja */}
          {cashRegister.initialCash > 0 && <CashRegisterStatus />}

          {/* Mensaje de éxito */}
          {successMessage && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {successMessage}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'products'
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Productos
            </button>
            <button
              onClick={() => setActiveTab('combos')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'combos'
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Combos {combos.length > 0 && `(${combos.length})`}
            </button>
          </div>

          {/* Content based on active tab */}
          {activeTab === 'products' ? (
            <>
              {/* Botón de acceso al mostrador de cigarrillos */}
              {products.some(p => p.category === 'cigarros') && (
                <div className="mb-4">
                  <button
                    onClick={() => { setCigCounts({}); setShowCigModal(true); }}
                    className="flex items-center gap-2 px-5 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium active:scale-95 transition-transform"
                  >
                    🚬 Cigarrillos — Mostrador
                  </button>
                </div>
              )}
              <ProductGrid products={products.filter(p => p.category !== 'cigarros')} stockMap={stockMap} />
            </>
          ) : (
            <ComboGrid combos={combos} products={products} />
          )}
        </div>

        {/* Cart */}
        <div className="lg:w-96 bg-gray-100 rounded-xl p-4">
          <h2 className="font-bold text-gray-900 mb-4">Carrito</h2>
          <Cart onCheckout={() => setShowPayment(true)} />
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <PaymentModal
          total={total}
          items={items}
          combos={cartCombos}
          onConfirm={handleCheckout}
          onCancel={() => setShowPayment(false)}
          isLoading={isProcessing}
        />
      )}

      {/* Open Cash Register Modal */}
      {showOpenCash && (
        <OpenCashRegisterModal
          onConfirm={handleOpenCashRegister}
          onCancel={() => setShowOpenCash(false)}
        />
      )}

      {/* Modal Cigarrillos → Mostrador */}
      {showCigModal && (() => {
        const cigProds = products.filter(p => p.category === 'cigarros');
        const totalCig = cigProds.reduce((sum, p) => sum + (cigCounts[p.id] || 0) * p.sale_price, 0);
        const hasAny = cigProds.some(p => (cigCounts[p.id] || 0) > 0);
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">🚬 Mostrador</h2>
                <button onClick={() => setShowCigModal(false)} className="text-gray-500 hover:text-gray-600 text-2xl leading-none">×</button>
              </div>

              {/* Un botón grande por producto — cada toque suma 1 */}
              <div className="flex gap-3 mb-6">
                {cigProds.map(p => {
                  const count = cigCounts[p.id] || 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setCigCounts(prev => ({ ...prev, [p.id]: (prev[p.id] || 0) + 1 }))}
                      className="flex-1 flex flex-col items-center justify-center gap-1 py-6 rounded-2xl bg-gray-900 hover:bg-gray-700 active:scale-95 transition-transform text-white select-none"
                    >
                      <span className="text-4xl font-black">{count > 0 ? count : '+'}</span>
                      <span className="text-base font-semibold">{p.name}</span>
                      <span className="text-gray-500 text-sm">{formatCurrency(p.sale_price)}</span>
                    </button>
                  );
                })}
              </div>

              {/* Reset individual con toque largo — botón de quitar */}
              {hasAny && (
                <div className="flex gap-2 mb-4">
                  {cigProds.filter(p => (cigCounts[p.id] || 0) > 0).map(p => (
                    <button
                      key={p.id}
                      onClick={() => setCigCounts(prev => ({ ...prev, [p.id]: Math.max(0, (prev[p.id] || 0) - 1) }))}
                      className="flex-1 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium"
                    >
                      − {p.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Total */}
              {hasAny && (
                <div className="flex justify-between items-center bg-gray-50 rounded-xl px-4 py-3 mb-4">
                  <span className="text-gray-500 text-sm">Total</span>
                  <span className="font-bold text-gray-900 text-xl">{formatCurrency(totalCig)}</span>
                </div>
              )}

              <button
                onClick={handleAddToMostrador}
                disabled={isAddingCig || !hasAny}
                className="w-full py-4 rounded-xl bg-gray-900 text-white font-bold text-base hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isAddingCig ? 'Guardando...' : 'Confirmar → Mostrador'}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
