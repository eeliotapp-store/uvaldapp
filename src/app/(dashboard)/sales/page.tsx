'use client';

import { useEffect, useState } from 'react';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore, isOwner } from '@/stores/auth-store';
import { useShiftStore } from '@/stores/shift-store';
import { supabase } from '@/lib/supabase/client';
import type { PaymentMethod, Product, CurrentStock, OpenTab, Shift } from '@/types/database';

interface SaleWithDetails {
  id: string;
  employee_id: string;
  total: number;
  status: 'open' | 'closed' | 'voided';
  table_number: string | null;
  payment_method: PaymentMethod | null;
  cash_received: number | null;
  cash_change: number | null;
  voided: boolean;
  voided_reason: string | null;
  created_at: string;
  employees: { id: string; name: string };
  shifts: { id: string; type: string };
  sale_items: {
    id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    products: { id: string; name: string };
  }[];
}

interface SalesTotals {
  total_sales: number;
  cash_sales: number;
  transfer_sales: number;
  transactions: number;
  voided_count: number;
}

interface CartItem {
  product: Product;
  quantity: number;
  stock: number;
}

export default function SalesPage() {
  const employee = useAuthStore((state) => state.employee);
  const { currentShift, setShift, openCashRegister, addCashSale, addTransferSale, addMixedSale } = useShiftStore();
  const [sales, setSales] = useState<SaleWithDetails[]>([]);
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [totals, setTotals] = useState<SalesTotals | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<SaleWithDetails | null>(null);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showNewSaleModal, setShowNewSaleModal] = useState(false);
  const [editingTab, setEditingTab] = useState<OpenTab | null>(null);

  const [filters, setFilters] = useState({
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    payment_method: '',
  });

  useEffect(() => {
    loadSales();
    loadOpenTabs();
  }, [filters]);

  const loadSales = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.payment_method) params.append('payment_method', filters.payment_method);

      const response = await fetch(`/api/sales?${params}`);
      const data = await response.json();
      setSales(data.sales || []);
      setTotals(data.totals || null);
    } catch (error) {
      console.error('Error loading sales:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadOpenTabs = async () => {
    try {
      const response = await fetch('/api/sales/open-tabs');
      const data = await response.json();
      setOpenTabs(data.tabs || []);
    } catch (error) {
      console.error('Error loading open tabs:', error);
    }
  };

  const handleVoidSale = async (reason: string) => {
    if (!selectedSale) return;

    try {
      const response = await fetch(`/api/sales/${selectedSale.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (response.ok) {
        setShowVoidModal(false);
        setSelectedSale(null);
        loadSales();
        loadOpenTabs();
      } else {
        const data = await response.json();
        alert(data.error || 'Error al anular venta');
      }
    } catch (error) {
      console.error('Error voiding sale:', error);
      alert('Error de conexión');
    }
  };

  const handleSaleSuccess = () => {
    setShowNewSaleModal(false);
    setEditingTab(null);
    loadSales();
    loadOpenTabs();
  };

  const handleOpenTab = (tab: OpenTab) => {
    setEditingTab(tab);
    setShowNewSaleModal(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ventas</h1>
        <Button onClick={() => setShowNewSaleModal(true)}>
          + Nueva Venta
        </Button>
      </div>

      {/* Cuentas Abiertas */}
      {openTabs.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-3 h-3 bg-amber-500 rounded-full animate-pulse"></span>
            Cuentas Abiertas ({openTabs.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {openTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleOpenTab(tab)}
                className={`border-2 rounded-xl p-4 text-left hover:shadow-md transition-all ${
                  tab.employee_id === employee?.id
                    ? 'bg-amber-50 border-amber-200 hover:border-amber-400'
                    : 'bg-blue-50 border-blue-200 hover:border-blue-400'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className={`font-bold text-lg ${
                      tab.employee_id === employee?.id ? 'text-amber-800' : 'text-blue-800'
                    }`}>
                      {tab.table_number ? `Mesa ${tab.table_number}` : 'Sin mesa'}
                    </span>
                    <p className="text-sm text-gray-500">{formatTime(tab.created_at)}</p>
                    {tab.employee_id !== employee?.id && (
                      <p className="text-xs text-blue-600 font-medium mt-1">
                        De: {tab.employee_name}
                        {tab.taken_over_by_name && ` (tomado de ${tab.opened_by_name})`}
                      </p>
                    )}
                  </div>
                  <span className="text-xl font-bold text-gray-900">
                    {formatCurrency(tab.total)}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  {tab.items?.slice(0, 3).map((item, idx) => (
                    <span key={idx}>
                      {item.quantity}x {item.product_name}
                      {idx < Math.min(tab.items.length - 1, 2) ? ', ' : ''}
                    </span>
                  ))}
                  {tab.items?.length > 3 && (
                    <span className="text-gray-400"> +{tab.items.length - 3} más</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Totales */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <p className="text-sm text-gray-600">Total Ventas</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totals.total_sales)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <p className="text-sm text-gray-600">Efectivo</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(totals.cash_sales)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <p className="text-sm text-gray-600">Transferencias</p>
            <p className="text-xl font-bold text-blue-600">{formatCurrency(totals.transfer_sales)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <p className="text-sm text-gray-600">Transacciones</p>
            <p className="text-xl font-bold text-gray-900">
              {totals.transactions}
              {totals.voided_count > 0 && (
                <span className="text-sm text-red-500 ml-2">({totals.voided_count} anuladas)</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-200">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Desde</label>
          <input
            type="date"
            value={filters.start_date}
            onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Hasta</label>
          <input
            type="date"
            value={filters.end_date}
            onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Método de Pago</label>
          <select
            value={filters.payment_method}
            onChange={(e) => setFilters({ ...filters, payment_method: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">Todos</option>
            <option value="cash">Efectivo</option>
            <option value="transfer">Transferencia</option>
            <option value="mixed">Mixto</option>
          </select>
        </div>
      </div>

      {/* Lista de ventas cerradas */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Fecha/Hora</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Mesa</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Empleado</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Productos</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Pago</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Total</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map((sale) => (
                  <tr key={sale.id} className={`hover:bg-gray-50 ${sale.voided ? 'bg-red-50 opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <p className="font-medium text-gray-900">{formatDate(sale.created_at)}</p>
                        <p className="text-gray-500">{formatTime(sale.created_at)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">
                        {sale.table_number || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-900">{sale.employees?.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-600">
                        {sale.sale_items?.slice(0, 2).map((item) => (
                          <p key={item.id}>
                            {item.quantity}x {item.products?.name}
                          </p>
                        ))}
                        {sale.sale_items?.length > 2 && (
                          <p className="text-gray-400">+{sale.sale_items.length - 2} más</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        sale.payment_method === 'cash'
                          ? 'bg-green-100 text-green-700'
                          : sale.payment_method === 'transfer'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {sale.payment_method === 'cash' ? 'Efectivo' : sale.payment_method === 'transfer' ? 'Transferencia' : 'Mixto'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold ${sale.voided ? 'line-through text-red-500' : 'text-gray-900'}`}>
                        {formatCurrency(sale.total)}
                      </span>
                      {sale.voided && (
                        <p className="text-xs text-red-500">Anulada</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedSale(sale)}
                        className="text-amber-600 hover:text-amber-800 text-sm font-medium mr-2"
                      >
                        Ver
                      </button>
                      {!sale.voided && isOwner(employee?.role) && (
                        <button
                          onClick={() => {
                            setSelectedSale(sale);
                            setShowVoidModal(true);
                          }}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Anular
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sales.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No hay ventas cerradas en este periodo
            </div>
          )}
        </div>
      )}

      {/* Modal Nueva Venta / Editar Tab */}
      {showNewSaleModal && (
        <SaleModal
          employee={employee}
          currentShift={currentShift}
          existingTab={editingTab}
          onSuccess={handleSaleSuccess}
          onClose={() => {
            setShowNewSaleModal(false);
            setEditingTab(null);
          }}
          setShift={setShift}
          openCashRegister={openCashRegister}
          addCashSale={addCashSale}
          addTransferSale={addTransferSale}
          addMixedSale={addMixedSale}
        />
      )}

      {/* Modal detalle de venta */}
      {selectedSale && !showVoidModal && (
        <SaleDetailModal sale={selectedSale} onClose={() => setSelectedSale(null)} />
      )}

      {/* Modal anular venta */}
      {showVoidModal && selectedSale && (
        <VoidSaleModal
          sale={selectedSale}
          onConfirm={handleVoidSale}
          onClose={() => {
            setShowVoidModal(false);
            setSelectedSale(null);
          }}
        />
      )}
    </div>
  );
}

// Modal unificado para crear/editar ventas
function SaleModal({
  employee,
  currentShift: initialShift,
  existingTab,
  onSuccess,
  onClose,
  setShift,
  openCashRegister,
  addCashSale,
  addTransferSale,
  addMixedSale,
}: {
  employee: { id: string; name: string; role: string } | null;
  currentShift: Shift | null;
  existingTab: OpenTab | null;
  onSuccess: () => void;
  onClose: () => void;
  setShift: (shift: Shift | null) => void;
  openCashRegister: (initialCash: number) => void;
  addCashSale: (amount: number, change: number) => void;
  addTransferSale: (amount: number) => void;
  addMixedSale: (cash: number, transfer: number, change: number) => void;
}) {
  // Determinar paso inicial según si hay turno activo
  const [currentShift, setCurrentShift] = useState(initialShift);
  // Si el tab pertenece a otro empleado, mostrar opción de tomar relevo
  const tabBelongsToOther = existingTab && employee && existingTab.employee_id !== employee.id;
  const [step, setStep] = useState<'shift' | 'takeover' | 'products' | 'payment'>(
    !initialShift ? 'shift' : tabBelongsToOther ? 'takeover' : 'products'
  );
  const [hasTakenOver, setHasTakenOver] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [tableNumber, setTableNumber] = useState(existingTab?.table_number || '');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  // Estado para turno
  const [shiftType, setShiftType] = useState<'day' | 'night'>('day');
  const [cashStart, setCashStart] = useState('0');

  // Estado para pago
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cashReceived, setCashReceived] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [cashAmountMixed, setCashAmountMixed] = useState('');

  // Si es un tab existente, calcular el total previo
  const existingTotal = existingTab?.total || 0;
  const existingItems = existingTab?.items || [];

  useEffect(() => {
    loadProducts();
  }, []);

  // Tomar relevo de una cuenta de otro empleado
  const handleTakeover = async () => {
    if (!employee || !currentShift || !existingTab) {
      setError('Faltan datos para tomar el relevo');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const response = await fetch(`/api/sales/${existingTab.id}/takeover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_employee_id: employee.id,
          new_shift_id: currentShift.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al tomar el relevo');
      }

      setHasTakenOver(true);
      setStep('products');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al tomar el relevo');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartShift = async () => {
    if (!employee) {
      setError('No hay empleado seleccionado');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const response = await fetch('/api/shifts/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employee.id,
          shift_type: shiftType,
          cash_start: parseFloat(cashStart) || 0,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al iniciar turno');
      }

      // Actualizar el store y estado local
      setShift(data.shift);
      setCurrentShift(data.shift);
      openCashRegister(parseFloat(cashStart) || 0);

      // Si hay un tab de otro empleado, mostrar paso de takeover
      if (existingTab && existingTab.employee_id !== employee?.id) {
        setStep('takeover');
      } else {
        setStep('products');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar turno');
    } finally {
      setIsProcessing(false);
    }
  };

  const loadProducts = async () => {
    try {
      const [productsRes, stockRes] = await Promise.all([
        supabase.from('products').select('*').eq('active', true).order('name'),
        supabase.from('v_current_stock').select('*'),
      ]);

      setProducts(productsRes.data || []);

      const stockData: Record<string, number> = {};
      (stockRes.data as CurrentStock[])?.forEach((item) => {
        stockData[item.product_id] = item.current_stock;
      });
      setStockMap(stockData);
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const newItemsTotal = cart.reduce((sum, item) => sum + item.product.sale_price * item.quantity, 0);
  const total = existingTotal + newItemsTotal;

  const handleAddToCart = () => {
    if (!selectedProduct) return;

    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    const qty = parseInt(quantity) || 1;
    const stock = stockMap[product.id] || 0;

    const existingItem = cart.find(item => item.product.id === product.id);
    const currentQtyInCart = existingItem?.quantity || 0;

    if (currentQtyInCart + qty > stock) {
      setError(`Solo hay ${stock} unidades disponibles de ${product.name}`);
      return;
    }

    setError('');

    if (existingItem) {
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + qty }
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: qty, stock }]);
    }

    setSelectedProduct('');
    setQuantity('1');
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const handleUpdateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveFromCart(productId);
      return;
    }

    const item = cart.find(i => i.product.id === productId);
    if (item && newQty > item.stock) {
      setError(`Solo hay ${item.stock} unidades disponibles`);
      return;
    }

    setCart(cart.map(item =>
      item.product.id === productId
        ? { ...item, quantity: newQty }
        : item
    ));
  };

  const getChange = () => {
    if (paymentMethod === 'cash') {
      return Math.max(0, (parseFloat(cashReceived) || 0) - total);
    }
    if (paymentMethod === 'mixed') {
      const totalPaid = (parseFloat(transferAmount) || 0) + (parseFloat(cashAmountMixed) || 0);
      return Math.max(0, totalPaid - total);
    }
    return 0;
  };

  const canConfirmPayment = () => {
    if (paymentMethod === 'transfer') return true;
    if (paymentMethod === 'cash') return (parseFloat(cashReceived) || 0) >= total;
    if (paymentMethod === 'mixed') {
      const totalPaid = (parseFloat(transferAmount) || 0) + (parseFloat(cashAmountMixed) || 0);
      return totalPaid >= total;
    }
    return false;
  };

  // Guardar como cuenta abierta (sin cobrar)
  const handleSaveAsOpen = async () => {
    if (!employee || !currentShift) {
      setError('Debes iniciar un turno antes de vender');
      return;
    }

    if (cart.length === 0 && !existingTab) {
      setError('Agrega al menos un producto');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      if (existingTab) {
        // Agregar items a tab existente
        if (cart.length > 0) {
          const response = await fetch(`/api/sales/${existingTab.id}/add-items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: cart.map(item => ({
                product_id: item.product.id,
                quantity: item.quantity,
                unit_price: item.product.sale_price,
              })),
            }),
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || 'Error al agregar productos');
          }
        }
      } else {
        // Crear nueva cuenta abierta
        const response = await fetch('/api/sales/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_id: employee.id,
            shift_id: currentShift.id,
            table_number: tableNumber || null,
            items: cart.map(item => ({
              product_id: item.product.id,
              quantity: item.quantity,
              unit_price: item.product.sale_price,
            })),
            close: false,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Error al crear la cuenta');
        }
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setIsProcessing(false);
    }
  };

  // Cerrar cuenta y cobrar
  const handleCloseAndPay = async () => {
    if (!employee || !currentShift) {
      setError('Debes iniciar un turno antes de vender');
      return;
    }

    if (!paymentMethod) return;

    setIsProcessing(true);
    setError('');

    const change = getChange();
    const cashReceivedNum = parseFloat(cashReceived) || 0;
    const transferAmountNum = parseFloat(transferAmount) || 0;
    const cashMixedNum = parseFloat(cashAmountMixed) || 0;

    try {
      if (existingTab) {
        // Primero agregar items nuevos si hay
        if (cart.length > 0) {
          const addResponse = await fetch(`/api/sales/${existingTab.id}/add-items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: cart.map(item => ({
                product_id: item.product.id,
                quantity: item.quantity,
                unit_price: item.product.sale_price,
              })),
            }),
          });

          if (!addResponse.ok) {
            const data = await addResponse.json();
            throw new Error(data.error || 'Error al agregar productos');
          }
        }

        // Luego cerrar la cuenta
        const closeResponse = await fetch(`/api/sales/${existingTab.id}/close`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_id: employee.id,
            payment_method: paymentMethod,
            cash_received: paymentMethod === 'cash' ? cashReceivedNum : paymentMethod === 'mixed' ? cashMixedNum : 0,
            cash_change: change,
            transfer_amount: paymentMethod === 'transfer' ? total : paymentMethod === 'mixed' ? transferAmountNum : 0,
            cash_amount: paymentMethod === 'cash' ? total : paymentMethod === 'mixed' ? (cashMixedNum - change) : 0,
          }),
        });

        const data = await closeResponse.json();
        if (!closeResponse.ok) {
          throw new Error(data.error || 'Error al cerrar la cuenta');
        }
      } else {
        // Crear venta cerrada directamente
        const response = await fetch('/api/sales/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_id: employee.id,
            shift_id: currentShift.id,
            table_number: tableNumber || null,
            items: cart.map(item => ({
              product_id: item.product.id,
              quantity: item.quantity,
              unit_price: item.product.sale_price,
            })),
            close: true,
            payment_method: paymentMethod,
            cash_received: paymentMethod === 'cash' ? cashReceivedNum : paymentMethod === 'mixed' ? cashMixedNum : 0,
            cash_change: change,
            transfer_amount: paymentMethod === 'transfer' ? total : paymentMethod === 'mixed' ? transferAmountNum : 0,
            cash_amount: paymentMethod === 'cash' ? total : paymentMethod === 'mixed' ? (cashMixedNum - change) : 0,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Error al procesar la venta');
        }
      }

      // Actualizar caja
      if (paymentMethod === 'cash') {
        addCashSale(cashReceivedNum, change);
      } else if (paymentMethod === 'transfer') {
        addTransferSale(total);
      } else if (paymentMethod === 'mixed') {
        addMixedSale(cashMixedNum, transferAmountNum, change);
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar la venta');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">
                {step === 'shift'
                  ? 'Iniciar Turno'
                  : step === 'takeover'
                    ? 'Tomar Relevo'
                    : existingTab
                      ? `Mesa ${existingTab.table_number || 'Sin número'}`
                      : step === 'products' ? 'Nueva Venta' : 'Método de Pago'
                }
              </h2>
              {existingTab && step !== 'shift' && (
                <p className="text-sm text-gray-500">
                  Total actual: {formatCurrency(existingTotal)}
                </p>
              )}
              {step !== 'shift' && currentShift && (
                <p className="text-xs text-gray-400">
                  Turno: {employee?.name} - {currentShift.type === 'day' ? 'Día' : 'Noche'}
                </p>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'takeover' ? (
            /* Paso de tomar relevo */
            <div className="space-y-6">
              <div className="bg-amber-50 rounded-xl p-6 text-center">
                <div className="text-4xl mb-3">🔄</div>
                <h3 className="font-bold text-amber-800 text-lg mb-2">Cuenta de otro empleado</h3>
                <p className="text-amber-700">
                  Esta cuenta fue abierta por <strong>{existingTab?.employee_name}</strong>
                </p>
                {existingTab?.opened_by_name && existingTab.opened_by_name !== existingTab.employee_name && (
                  <p className="text-sm text-amber-600 mt-1">
                    (Originalmente de {existingTab.opened_by_name})
                  </p>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-sm text-gray-600 mb-2">Resumen de la cuenta:</p>
                <div className="space-y-1">
                  {existingTab?.items?.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{item.quantity}x {item.product_name}</span>
                      <span>{formatCurrency(item.subtotal)}</span>
                    </div>
                  ))}
                  {existingTab && existingTab.items?.length > 5 && (
                    <p className="text-xs text-gray-400">+{existingTab.items.length - 5} productos más</p>
                  )}
                </div>
                <div className="border-t border-gray-200 mt-3 pt-3 flex justify-between font-bold">
                  <span>Total:</span>
                  <span>{formatCurrency(existingTab?.total || 0)}</span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-700 mb-2">
                  Al tomar el relevo, esta cuenta pasará a tu turno actual:
                </p>
                <p className="font-medium text-gray-900">
                  {employee?.name} - Turno {currentShift?.type === 'day' ? 'Día' : 'Noche'}
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Cancelar
                </Button>
                <Button
                  onClick={handleTakeover}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? 'Procesando...' : 'Tomar Relevo'}
                </Button>
              </div>
            </div>
          ) : step === 'shift' ? (
            /* Paso de inicio de turno */
            <div className="space-y-6">
              <div className="bg-amber-50 rounded-xl p-4 text-center">
                <p className="text-amber-800 font-medium">No hay turno activo</p>
                <p className="text-sm text-amber-600">Inicia un turno para poder registrar ventas</p>
              </div>

              {/* Empleado */}
              <div className="bg-gray-50 rounded-xl p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Empleado</label>
                <div className="text-lg font-bold text-gray-900">{employee?.name || 'No identificado'}</div>
              </div>

              {/* Tipo de turno */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Turno</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShiftType('day')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      shiftType === 'day'
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">☀️</div>
                    <p className="font-medium">Día</p>
                  </button>
                  <button
                    onClick={() => setShiftType('night')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      shiftType === 'night'
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">🌙</div>
                    <p className="font-medium">Noche</p>
                  </button>
                </div>
              </div>

              {/* Efectivo inicial */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Efectivo inicial en caja
                </label>
                <input
                  type="number"
                  value={cashStart}
                  onChange={(e) => setCashStart(e.target.value)}
                  className="w-full px-4 py-3 text-xl font-bold text-center border-2 border-gray-200 rounded-xl focus:border-amber-500"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1 text-center">
                  Cuenta el dinero en la caja antes de empezar
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <Button
                onClick={handleStartShift}
                disabled={isProcessing || !employee}
                className="w-full"
                size="lg"
              >
                {isProcessing ? 'Iniciando...' : 'Iniciar Turno y Continuar'}
              </Button>
            </div>
          ) : step === 'products' ? (
            <>
              {/* Número de mesa (solo para nuevas ventas) */}
              {!existingTab && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de Mesa (opcional)
                  </label>
                  <input
                    type="text"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder="Ej: 5, Barra, Terraza..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              )}

              {/* Items existentes del tab */}
              {existingItems.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                  <h3 className="font-medium text-gray-700 mb-2">Productos ya agregados</h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    {existingItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{item.quantity}x {item.product_name}</span>
                        <span>{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Agregar producto */}
              <div className="bg-amber-50 rounded-xl p-4 mb-6">
                <h3 className="font-medium text-amber-800 mb-3">Agregar Producto</h3>
                <div className="flex gap-3">
                  <select
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                  >
                    <option value="">Seleccionar producto...</option>
                    {products.map(product => {
                      const stock = stockMap[product.id] || 0;
                      return (
                        <option key={product.id} value={product.id} disabled={stock === 0}>
                          {product.name} - {formatCurrency(product.sale_price)} ({stock} disp.)
                        </option>
                      );
                    })}
                  </select>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="1"
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center"
                  />
                  <Button onClick={handleAddToCart} disabled={!selectedProduct}>
                    Agregar
                  </Button>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Lista de nuevos productos */}
              <div className="space-y-3">
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p>No hay productos nuevos</p>
                    <p className="text-sm">Selecciona un producto y haz clic en Agregar</p>
                  </div>
                ) : (
                  <>
                    <h3 className="font-medium text-gray-700">Nuevos productos</h3>
                    {cart.map(item => (
                      <div key={item.product.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{item.product.name}</p>
                          <p className="text-sm text-gray-500">{formatCurrency(item.product.sale_price)} c/u</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleUpdateQuantity(item.product.id, item.quantity - 1)}
                              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-medium">{item.quantity}</span>
                            <button
                              onClick={() => handleUpdateQuantity(item.product.id, item.quantity + 1)}
                              className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 hover:bg-amber-200"
                            >
                              +
                            </button>
                          </div>
                          <span className="w-24 text-right font-bold">
                            {formatCurrency(item.product.sale_price * item.quantity)}
                          </span>
                          <button
                            onClick={() => handleRemoveFromCart(item.product.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </>
          ) : (
            /* Paso de pago */
            <div className="space-y-6">
              {/* Resumen */}
              <div className="bg-amber-50 rounded-xl p-4 text-center">
                <p className="text-gray-600 text-sm">Total a cobrar</p>
                <p className="text-3xl font-bold text-amber-700">{formatCurrency(total)}</p>
                {existingTab && newItemsTotal > 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    (Anterior: {formatCurrency(existingTotal)} + Nuevo: {formatCurrency(newItemsTotal)})
                  </p>
                )}
              </div>

              {/* Métodos de pago */}
              <div className="grid grid-cols-3 gap-3">
                {(['cash', 'transfer', 'mixed'] as PaymentMethod[]).map(method => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      paymentMethod === method
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">
                      {method === 'cash' ? '💵' : method === 'transfer' ? '📱' : '💳'}
                    </div>
                    <p className="font-medium text-sm">
                      {method === 'cash' ? 'Efectivo' : method === 'transfer' ? 'Transferencia' : 'Mixto'}
                    </p>
                  </button>
                ))}
              </div>

              {/* Campos según método */}
              {paymentMethod === 'cash' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Efectivo recibido
                  </label>
                  <input
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className="w-full px-4 py-3 text-xl font-bold text-center border-2 border-gray-200 rounded-xl focus:border-amber-500"
                    placeholder="0"
                    autoFocus
                  />
                  {parseFloat(cashReceived) > 0 && (
                    <div className="mt-3 text-center">
                      <p className="text-gray-600 text-sm">Cambio a devolver</p>
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(getChange())}</p>
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === 'transfer' && (
                <div className="bg-blue-50 rounded-xl p-6 text-center">
                  <p className="text-gray-700 mb-2">Solicita la transferencia por:</p>
                  <p className="text-3xl font-bold text-blue-700 mb-2">{formatCurrency(total)}</p>
                  <p className="text-sm text-gray-500">Verifica el comprobante antes de confirmar</p>
                </div>
              )}

              {paymentMethod === 'mixed' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Monto en Transferencia
                    </label>
                    <input
                      type="number"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      className="w-full px-4 py-3 text-lg font-bold text-center border-2 border-gray-200 rounded-xl focus:border-blue-500"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Efectivo recibido
                    </label>
                    <input
                      type="number"
                      value={cashAmountMixed}
                      onChange={(e) => setCashAmountMixed(e.target.value)}
                      className="w-full px-4 py-3 text-lg font-bold text-center border-2 border-gray-200 rounded-xl focus:border-green-500"
                      placeholder="0"
                    />
                  </div>
                  {(parseFloat(transferAmount) > 0 || parseFloat(cashAmountMixed) > 0) && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Transferencia:</span>
                        <span className="text-blue-600 font-medium">{formatCurrency(parseFloat(transferAmount) || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Efectivo:</span>
                        <span className="text-green-600 font-medium">{formatCurrency(parseFloat(cashAmountMixed) || 0)}</span>
                      </div>
                      {getChange() > 0 && (
                        <div className="flex justify-between text-sm pt-2 border-t border-gray-200 mt-2">
                          <span>Cambio:</span>
                          <span className="text-amber-600 font-bold">{formatCurrency(getChange())}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          {step === 'products' ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(total)}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Cancelar
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleSaveAsOpen}
                  disabled={cart.length === 0 && !existingTab || isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? 'Guardando...' : 'Guardar (Cuenta Abierta)'}
                </Button>
                <Button
                  onClick={() => setStep('payment')}
                  disabled={(cart.length === 0 && !existingTab) || total === 0}
                  className="flex-1"
                >
                  Dar la Cuenta
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('products')} className="flex-1">
                Volver
              </Button>
              <Button
                onClick={handleCloseAndPay}
                disabled={!canConfirmPayment() || isProcessing}
                className="flex-1"
              >
                {isProcessing ? 'Procesando...' : 'Confirmar Pago'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SaleDetailModal({ sale, onClose }: { sale: SaleWithDetails; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4">Detalle de Venta</h2>

        <div className="space-y-3 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Fecha:</span>
            <span>{formatDate(sale.created_at)} {formatTime(sale.created_at)}</span>
          </div>
          {sale.table_number && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Mesa:</span>
              <span>{sale.table_number}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Empleado:</span>
            <span>{sale.employees?.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Método de pago:</span>
            <span>{sale.payment_method === 'cash' ? 'Efectivo' : sale.payment_method === 'transfer' ? 'Transferencia' : 'Mixto'}</span>
          </div>
          {(sale.payment_method === 'cash' || sale.payment_method === 'mixed') && sale.cash_received && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Efectivo recibido:</span>
                <span>{formatCurrency(sale.cash_received)}</span>
              </div>
              {sale.cash_change && sale.cash_change > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Cambio:</span>
                  <span>{formatCurrency(sale.cash_change)}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t border-gray-200 pt-4 mb-4">
          <h3 className="font-medium mb-2">Productos</h3>
          <div className="space-y-2">
            {sale.sale_items?.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>
                  {item.quantity}x {item.products?.name}
                </span>
                <span className="font-medium">{formatCurrency(item.subtotal)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-200 pt-4 mb-4">
          <div className="flex justify-between text-lg font-bold">
            <span>Total:</span>
            <span className={sale.voided ? 'line-through text-red-500' : ''}>
              {formatCurrency(sale.total)}
            </span>
          </div>
          {sale.voided && (
            <p className="text-red-500 text-sm mt-2">
              Anulada: {sale.voided_reason}
            </p>
          )}
        </div>

        <Button variant="outline" onClick={onClose} className="w-full">
          Cerrar
        </Button>
      </div>
    </div>
  );
}

function VoidSaleModal({
  sale,
  onConfirm,
  onClose,
}: {
  sale: SaleWithDetails;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-red-600 mb-4">Anular Venta</h2>

        <p className="text-gray-600 mb-4">
          Esta acción devolverá los productos al inventario y marcará la venta como anulada.
        </p>

        <div className="bg-gray-50 p-3 rounded-lg mb-4">
          <p className="font-medium">Venta: {formatCurrency(sale.total)}</p>
          <p className="text-sm text-gray-500">
            {formatDate(sale.created_at)} - {sale.employees?.name}
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Razón de anulación *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Ej: Error en el cobro, producto devuelto..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
          />
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={() => reason && onConfirm(reason)}
            disabled={!reason.trim()}
            className="flex-1"
          >
            Anular Venta
          </Button>
        </div>
      </div>
    </div>
  );
}
