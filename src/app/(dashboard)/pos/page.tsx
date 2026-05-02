'use client';

import { useEffect, useState } from 'react';
import { ProductGrid } from '@/components/pos/product-grid';
import { ComboGrid } from '@/components/pos/combo-grid';
import { Cart } from '@/components/pos/cart';
import { PaymentModal } from '@/components/pos/payment-modal';
import { OpenCashRegisterModal } from '@/components/pos/open-cash-register-modal';
import { CashRegisterStatus } from '@/components/pos/cash-register-status';
import { ShiftGuard } from '@/components/shift-guard';
import { supabase } from '@/lib/supabase/client';
import { useCartStore, MICHELADA_EXTRA } from '@/stores/cart-store';
import { useShiftStore } from '@/stores/shift-store';
import { useAuthStore } from '@/stores/auth-store';
import { useCombosStore } from '@/stores/combos-store';
import { formatCurrency } from '@/lib/utils';
import type { Product, CurrentStock, PaymentMethod, ComboWithItems } from '@/types/database';

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

  const { items, combos: cartCombos, total, clear } = useCartStore();
  const { currentShift, cashRegister, addCashSale, addTransferSale, addMixedSale } = useShiftStore();
  const employee = useAuthStore((state) => state.employee);
  const combosStore = useCombosStore();

  useEffect(() => {
    loadData();
  }, []);

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

      const [productsResult, stockResult, combosResult] = await Promise.all([
        supabase
          .from('products')
          .select('*')
          .eq('active', true)
          .order('name'),
        supabase
          .from('v_current_stock')
          .select('*'),
        combosPromise,
      ]);

      if (productsResult.error) throw productsResult.error;
      if (stockResult.error) throw stockResult.error;

      setProducts(productsResult.data || []);
      const fetchedCombos = combosResult.combos || [];
      if (combosStale) combosStore.setCombos(fetchedCombos);
      setCombos(fetchedCombos);

      const stockMapData: Record<string, number> = {};
      (stockResult.data as CurrentStock[])?.forEach((item) => {
        stockMapData[item.product_id] = item.current_stock;
      });
      setStockMap(stockMapData);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Error al cargar datos');
    } finally {
      setIsLoading(false);
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
            <ProductGrid products={products} stockMap={stockMap} />
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
    </div>
  );
}
