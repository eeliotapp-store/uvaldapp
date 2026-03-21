'use client';

import { useEffect, useState } from 'react';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ShiftGuard } from '@/components/shift-guard';
import { useAuthStore, isOwner } from '@/stores/auth-store';
import { useShiftStore } from '@/stores/shift-store';
import { supabase } from '@/lib/supabase/client';
import type { PaymentMethod, Product, CurrentStock, OpenTab, Shift, ComboWithItems, PartialPayment } from '@/types/database';
import { MICHELADA_EXTRA } from '@/stores/cart-store';

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
  // Fiado
  fiado_customer_name: string | null;
  fiado_amount: number | null;
  fiado_abono: number | null;
  fiado_paid: boolean;
  // Tracking de empleados
  opened_by_employee_id: string | null;
  closed_by_employee_id: string | null;
  taken_over_by_employee_id: string | null;
  employees: { id: string; name: string };
  opened_by?: { id: string; name: string } | null;
  closed_by?: { id: string; name: string } | null;
  taken_over_by?: { id: string; name: string } | null;
  shifts: { id: string; type: string };
  // Observaciones
  notes: string | null;
  close_notes: string | null;
  takeover_notes: string | null;
  sale_items: {
    id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    is_michelada?: boolean;
    combo_id?: string | null;
    added_by_employee_id?: string | null;
    products: { id: string; name: string };
    combos?: { id: string; name: string } | null;
    added_by?: { id: string; name: string } | null;
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
  isMichelada?: boolean;
}

interface CartComboItem {
  combo: ComboWithItems;
  items: { product: Product; quantity: number; isMichelada?: boolean }[];
  finalPrice: number;
}

export default function SalesPage() {
  return (
    <ShiftGuard>
      <SalesContent />
    </ShiftGuard>
  );
}

function SalesContent() {
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
                  <div className="text-right">
                    <span className="text-xl font-bold text-gray-900">
                      {formatCurrency(tab.total)}
                    </span>
                    {(tab.total_paid || 0) > 0 && (
                      <div className="text-xs mt-1">
                        <span className="text-green-600">Pagado: {formatCurrency(tab.total_paid)}</span>
                        <span className="text-amber-600 ml-2">Resta: {formatCurrency(tab.remaining)}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  {tab.items?.slice(0, 3).map((item, idx) => (
                    <span key={idx}>
                      {item.quantity}x {item.product_name}
                      {item.is_michelada && ' 🌶️'}
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
            <option value="fiado">Fiado</option>
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
                            {item.is_michelada && ' 🌶️'}
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
                          : sale.payment_method === 'fiado'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {sale.payment_method === 'cash' ? 'Efectivo' : sale.payment_method === 'transfer' ? 'Transferencia' : sale.payment_method === 'fiado' ? 'Fiado' : 'Mixto'}
                      </span>
                      {sale.payment_method === 'fiado' && sale.fiado_customer_name && (
                        <p className="text-xs text-orange-600 mt-1">{sale.fiado_customer_name}</p>
                      )}
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
  const [combos, setCombos] = useState<ComboWithItems[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartCombos, setCartCombos] = useState<CartComboItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedCombo, setSelectedCombo] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [tableNumber, setTableNumber] = useState(existingTab?.table_number || '');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [showComboModal, setShowComboModal] = useState<ComboWithItems | null>(null);
  const [showMicheladaModal, setShowMicheladaModal] = useState<{ product: Product; qty: number } | null>(null);

  // Estado para turno
  const [shiftType, setShiftType] = useState<'day' | 'night'>('day');
  const [cashStart, setCashStart] = useState('0');

  // Estado para pago
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cashReceived, setCashReceived] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [cashAmountMixed, setCashAmountMixed] = useState('');

  // Estado para fiado
  const [fiadoCustomerName, setFiadoCustomerName] = useState('');
  const [fiadoAbono, setFiadoAbono] = useState('');

  // Estado para edición de items existentes
  const [editingExistingItem, setEditingExistingItem] = useState<string | null>(null);
  const [editItemModal, setEditItemModal] = useState<{
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    is_michelada: boolean;
    original_price: number; // precio base sin michelada
  } | null>(null);

  // Estado para pagos parciales
  const [showPartialPaymentModal, setShowPartialPaymentModal] = useState(false);
  const [showPartialPaymentsHistory, setShowPartialPaymentsHistory] = useState(false);
  const [partialPayments, setPartialPayments] = useState<PartialPayment[]>([]);
  const [totalPaid, setTotalPaid] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [selectedItemsForPartial, setSelectedItemsForPartial] = useState<Record<string, { quantity: number; amount: number }>>({});
  const [partialPaymentMethod, setPartialPaymentMethod] = useState<'cash' | 'transfer' | 'mixed'>('cash');
  const [partialCashReceived, setPartialCashReceived] = useState('');
  const [partialTransferAmount, setPartialTransferAmount] = useState('');
  const [partialCashAmount, setPartialCashAmount] = useState('');
  const [showPartialConfirmation, setShowPartialConfirmation] = useState(false);

  // Si es un tab existente, calcular el total previo
  const existingTotal = existingTab?.total || 0;
  const existingItems = existingTab?.items || [];

  useEffect(() => {
    loadProducts();
  }, []);

  // Cargar pagos parciales cuando hay un tab existente
  useEffect(() => {
    if (existingTab) {
      loadPartialPayments();
    }
  }, [existingTab]);

  const loadPartialPayments = async () => {
    if (!existingTab) return;
    try {
      const response = await fetch(`/api/sales/${existingTab.id}/partial-payments`);
      const data = await response.json();
      if (response.ok) {
        setPartialPayments(data.payments || []);
        setTotalPaid(data.total_paid || 0);
        setRemaining(data.remaining || existingTab.total);
      }
    } catch (error) {
      console.error('Error loading partial payments:', error);
    }
  };

  // Calcular total seleccionado para pago parcial
  const partialPaymentTotal = Object.values(selectedItemsForPartial).reduce(
    (sum, item) => sum + item.amount,
    0
  );

  // Obtener cambio para pago parcial
  const getPartialChange = () => {
    if (partialPaymentMethod === 'cash') {
      return Math.max(0, (parseFloat(partialCashReceived) || 0) - partialPaymentTotal);
    }
    if (partialPaymentMethod === 'mixed') {
      const totalPaidPartial = (parseFloat(partialTransferAmount) || 0) + (parseFloat(partialCashAmount) || 0);
      return Math.max(0, totalPaidPartial - partialPaymentTotal);
    }
    return 0;
  };

  // Verificar si puede confirmar pago parcial
  const canConfirmPartialPayment = () => {
    if (partialPaymentTotal <= 0) return false;
    if (partialPaymentMethod === 'transfer') return true;
    if (partialPaymentMethod === 'cash') return (parseFloat(partialCashReceived) || 0) >= partialPaymentTotal;
    if (partialPaymentMethod === 'mixed') {
      const totalPaidPartial = (parseFloat(partialTransferAmount) || 0) + (parseFloat(partialCashAmount) || 0);
      return totalPaidPartial >= partialPaymentTotal;
    }
    return false;
  };

  // Registrar pago parcial
  const handleCreatePartialPayment = async () => {
    if (!existingTab || !employee) return;

    setIsProcessing(true);
    setError('');

    try {
      const items = Object.entries(selectedItemsForPartial).map(([saleItemId, data]) => ({
        sale_item_id: saleItemId,
        quantity: data.quantity,
        amount: data.amount,
      }));

      const cashAmountFinal = partialPaymentMethod === 'cash'
        ? partialPaymentTotal
        : partialPaymentMethod === 'mixed'
        ? parseFloat(partialCashAmount) || 0
        : 0;

      const transferAmountFinal = partialPaymentMethod === 'transfer'
        ? partialPaymentTotal
        : partialPaymentMethod === 'mixed'
        ? parseFloat(partialTransferAmount) || 0
        : 0;

      const response = await fetch(`/api/sales/${existingTab.id}/partial-payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employee.id,
          amount: partialPaymentTotal,
          payment_method: partialPaymentMethod,
          cash_amount: cashAmountFinal,
          transfer_amount: transferAmountFinal,
          items,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al registrar el pago parcial');
      }

      // Actualizar estado
      setTotalPaid(data.total_paid);
      setRemaining(data.remaining);
      loadPartialPayments();

      // Limpiar formulario
      setShowPartialConfirmation(false);
      setShowPartialPaymentModal(false);
      setSelectedItemsForPartial({});
      setPartialPaymentMethod('cash');
      setPartialCashReceived('');
      setPartialTransferAmount('');
      setPartialCashAmount('');

      // Refrescar la vista principal
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar pago parcial');
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle selección de item para pago parcial
  const toggleItemForPartialPayment = (item: typeof existingItems[0], selected: boolean) => {
    if (selected) {
      setSelectedItemsForPartial(prev => ({
        ...prev,
        [item.id]: { quantity: item.quantity, amount: item.subtotal }
      }));
    } else {
      setSelectedItemsForPartial(prev => {
        const newState = { ...prev };
        delete newState[item.id];
        return newState;
      });
    }
  };

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
      // Cargar productos, stock y combos
      const [productsRes, stockRes, combosRes] = await Promise.all([
        supabase.from('products').select('*').eq('active', true).order('name'),
        supabase.from('v_current_stock').select('*'),
        fetch('/api/combos').then(res => res.json()).catch(() => ({ combos: [] })),
      ]);

      setProducts(productsRes.data || []);
      setCombos(combosRes.combos || []);

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

  const newItemsTotal = cart.reduce((sum, item) => {
    const unitPrice = item.product.sale_price + (item.isMichelada ? MICHELADA_EXTRA : 0);
    return sum + unitPrice * item.quantity;
  }, 0);
  const combosTotal = cartCombos.reduce((sum, c) => sum + c.finalPrice, 0);
  const total = existingTotal + newItemsTotal + combosTotal;

  const handleAddToCart = () => {
    if (!selectedProduct) return;

    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    const qty = parseInt(quantity) || 1;
    const stock = stockMap[product.id] || 0;

    // Verificar stock total (considerando items normales y micheladas)
    const existingNormal = cart.find(item => item.product.id === product.id && !item.isMichelada);
    const existingMichelada = cart.find(item => item.product.id === product.id && item.isMichelada);
    const currentQtyInCart = (existingNormal?.quantity || 0) + (existingMichelada?.quantity || 0);

    if (currentQtyInCart + qty > stock) {
      setError(`Solo hay ${stock} unidades disponibles de ${product.name}`);
      return;
    }

    setError('');

    // Si es cerveza, mostrar modal de michelada
    const isBeer = product.category === 'beer_nacional' ||
                   product.category === 'beer_importada' ||
                   product.category === 'beer_artesanal' ||
                   product.category.includes('beer');

    if (isBeer) {
      setShowMicheladaModal({ product, qty });
      setSelectedProduct('');
      setQuantity('1');
      return;
    }

    // Si no es cerveza, agregar directamente
    addProductToCart(product, qty, false);
    setSelectedProduct('');
    setQuantity('1');
  };

  const addProductToCart = (product: Product, qty: number, isMichelada: boolean) => {
    const stock = stockMap[product.id] || 0;
    const existingItem = cart.find(item => item.product.id === product.id && item.isMichelada === isMichelada);

    if (existingItem) {
      setCart(cart.map(item =>
        item.product.id === product.id && item.isMichelada === isMichelada
          ? { ...item, quantity: item.quantity + qty }
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: qty, stock, isMichelada }]);
    }
  };

  const handleMicheladaChoice = (isMichelada: boolean) => {
    if (!showMicheladaModal) return;
    addProductToCart(showMicheladaModal.product, showMicheladaModal.qty, isMichelada);
    setShowMicheladaModal(null);
  };

  const handleRemoveFromCart = (productId: string, isMichelada?: boolean) => {
    setCart(cart.filter(item => !(item.product.id === productId && item.isMichelada === isMichelada)));
  };

  const handleUpdateQuantity = (productId: string, newQty: number, isMichelada?: boolean) => {
    if (newQty <= 0) {
      handleRemoveFromCart(productId, isMichelada);
      return;
    }

    const item = cart.find(i => i.product.id === productId && i.isMichelada === isMichelada);
    if (item && newQty > item.stock) {
      setError(`Solo hay ${item.stock} unidades disponibles`);
      return;
    }

    setCart(cart.map(item =>
      item.product.id === productId && item.isMichelada === isMichelada
        ? { ...item, quantity: newQty }
        : item
    ));
  };

  const handleComboSelect = (comboId: string) => {
    const combo = combos.find(c => c.id === comboId);
    if (!combo) return;

    // Si el combo es editable o tiene productos intercambiables, mostrar modal
    if (combo.is_price_editable || combo.combo_items?.some(i => i.is_swappable)) {
      setShowComboModal(combo);
    } else {
      // Agregar combo directamente
      const items = combo.combo_items?.map(item => ({
        product: item.products,
        quantity: item.quantity,
        isMichelada: item.is_michelada,
      })) || [];
      setCartCombos([...cartCombos, { combo, items, finalPrice: combo.base_price }]);
    }
    setSelectedCombo('');
  };

  const handleAddComboFromModal = (combo: ComboWithItems, items: { product: Product; quantity: number; isMichelada?: boolean }[], finalPrice: number) => {
    setCartCombos([...cartCombos, { combo, items, finalPrice }]);
    setShowComboModal(null);
  };

  const handleRemoveCombo = (index: number) => {
    setCartCombos(cartCombos.filter((_, i) => i !== index));
  };

  // Eliminar item existente de una cuenta abierta
  const handleDeleteExistingItem = async (itemId: string) => {
    if (!existingTab) return;

    setIsProcessing(true);
    setError('');

    try {
      const response = await fetch(`/api/sales/${existingTab.id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employee?.id,
          delete_items: [itemId],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al eliminar item');
      }

      // Recargar datos del tab
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar item');
    } finally {
      setIsProcessing(false);
    }
  };

  // Actualizar item existente de una cuenta abierta
  const handleUpdateExistingItem = async (
    itemId: string,
    newQuantity: number,
    newUnitPrice: number
  ) => {
    if (!existingTab) return;

    setIsProcessing(true);
    setError('');

    try {
      const response = await fetch(`/api/sales/${existingTab.id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employee?.id,
          update_items: [{
            id: itemId,
            quantity: newQuantity,
            unit_price: newUnitPrice,
          }],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al actualizar item');
      }

      setEditItemModal(null);
      // Recargar datos del tab
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar item');
    } finally {
      setIsProcessing(false);
    }
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
    if (paymentMethod === 'fiado') {
      // Fiado requiere nombre del cliente
      return fiadoCustomerName.trim().length > 0;
    }
    return false;
  };

  // Calcular monto fiado (total - abono)
  const getFiadoAmount = () => {
    const abono = parseFloat(fiadoAbono) || 0;
    return Math.max(0, total - abono);
  };

  // Guardar como cuenta abierta (sin cobrar)
  const handleSaveAsOpen = async () => {
    if (!employee || !currentShift) {
      setError('Debes iniciar un turno antes de vender');
      return;
    }

    if (cart.length === 0 && cartCombos.length === 0 && !existingTab) {
      setError('Agrega al menos un producto o combo');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      if (existingTab) {
        // Agregar items a tab existente
        if (cart.length > 0 || cartCombos.length > 0) {
          const response = await fetch(`/api/sales/${existingTab.id}/add-items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employee_id: employee.id,
              items: cart.map(item => ({
                product_id: item.product.id,
                quantity: item.quantity,
                unit_price: item.product.sale_price + (item.isMichelada ? MICHELADA_EXTRA : 0),
                is_michelada: item.isMichelada || false,
              })),
              combos: cartCombos.map(c => ({
                combo_id: c.combo.id,
                final_price: c.finalPrice,
                items: c.items.map(item => ({
                  product_id: item.product.id,
                  quantity: item.quantity,
                  is_michelada: item.isMichelada || false,
                })),
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
              unit_price: item.product.sale_price + (item.isMichelada ? MICHELADA_EXTRA : 0),
              is_michelada: item.isMichelada || false,
            })),
            combos: cartCombos.map(c => ({
              combo_id: c.combo.id,
              final_price: c.finalPrice,
              items: c.items.map(item => ({
                product_id: item.product.id,
                quantity: item.quantity,
                is_michelada: item.isMichelada || false,
              })),
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
    const fiadoAbonoNum = parseFloat(fiadoAbono) || 0;
    const fiadoAmountNum = getFiadoAmount();

    try {
      if (existingTab) {
        // Primero agregar items nuevos si hay
        if (cart.length > 0 || cartCombos.length > 0) {
          const addResponse = await fetch(`/api/sales/${existingTab.id}/add-items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employee_id: employee.id,
              items: cart.map(item => ({
                product_id: item.product.id,
                quantity: item.quantity,
                unit_price: item.product.sale_price + (item.isMichelada ? MICHELADA_EXTRA : 0),
                is_michelada: item.isMichelada || false,
              })),
              combos: cartCombos.map(c => ({
                combo_id: c.combo.id,
                final_price: c.finalPrice,
                items: c.items.map(item => ({
                  product_id: item.product.id,
                  quantity: item.quantity,
                  is_michelada: item.isMichelada || false,
                })),
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
            // Datos de fiado
            fiado_customer_name: paymentMethod === 'fiado' ? fiadoCustomerName : null,
            fiado_amount: paymentMethod === 'fiado' ? fiadoAmountNum : 0,
            fiado_abono: paymentMethod === 'fiado' ? fiadoAbonoNum : 0,
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
              unit_price: item.product.sale_price + (item.isMichelada ? MICHELADA_EXTRA : 0),
              is_michelada: item.isMichelada || false,
            })),
            combos: cartCombos.map(c => ({
              combo_id: c.combo.id,
              final_price: c.finalPrice,
              items: c.items.map(item => ({
                product_id: item.product.id,
                quantity: item.quantity,
                is_michelada: item.isMichelada || false,
              })),
            })),
            close: true,
            payment_method: paymentMethod,
            cash_received: paymentMethod === 'cash' ? cashReceivedNum : paymentMethod === 'mixed' ? cashMixedNum : 0,
            cash_change: change,
            transfer_amount: paymentMethod === 'transfer' ? total : paymentMethod === 'mixed' ? transferAmountNum : 0,
            cash_amount: paymentMethod === 'cash' ? total : paymentMethod === 'mixed' ? (cashMixedNum - change) : 0,
            // Datos de fiado
            fiado_customer_name: paymentMethod === 'fiado' ? fiadoCustomerName : null,
            fiado_amount: paymentMethod === 'fiado' ? fiadoAmountNum : 0,
            fiado_abono: paymentMethod === 'fiado' ? fiadoAbonoNum : 0,
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
      } else if (paymentMethod === 'fiado' && fiadoAbonoNum > 0) {
        // Solo registrar el abono en efectivo si hay
        addCashSale(fiadoAbonoNum, 0);
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
                      <span>
                        {item.quantity}x {item.product_name}
                        {item.is_michelada && <span className="text-amber-600"> Michelada</span>}
                        {item.combo_name && <span className="text-purple-600 text-xs"> (🎁 {item.combo_name})</span>}
                      </span>
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
              {existingItems.length > 0 && (() => {
                // Agrupar items por combo
                const comboGroups: Record<string, { name: string; items: typeof existingItems; total: number }> = {};
                const individualItems: typeof existingItems = [];

                existingItems.forEach((item) => {
                  if (item.combo_id && item.combo_name) {
                    if (!comboGroups[item.combo_id]) {
                      comboGroups[item.combo_id] = { name: item.combo_name, items: [], total: 0 };
                    }
                    comboGroups[item.combo_id].items.push(item);
                    comboGroups[item.combo_id].total += item.subtotal;
                  } else {
                    individualItems.push(item);
                  }
                });

                return (
                  <div className="bg-gray-50 rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-700">Productos ya agregados</h3>
                      <button
                        onClick={() => setEditingExistingItem(editingExistingItem ? null : 'all')}
                        className="text-xs text-amber-600 hover:text-amber-800"
                      >
                        {editingExistingItem ? 'Cancelar edición' : '✏️ Editar'}
                      </button>
                    </div>
                    <div className="space-y-2 text-sm">
                      {/* Combos agrupados */}
                      {Object.entries(comboGroups).map(([comboId, group]) => {
                        // Obtener el nombre del empleado que agregó el combo (del primer item)
                        const addedByName = group.items[0]?.added_by_name;

                        return (
                          <div key={comboId} className="bg-purple-50 rounded-lg p-2 border border-purple-200">
                            <div className="flex items-center justify-between mb-1">
                              <div>
                                <span className="font-medium text-purple-800">🎁 COMBO: {group.name}</span>
                                {addedByName && (
                                  <div className="text-xs text-purple-600">
                                    Agregado por: <span className="font-medium">{addedByName}</span>
                                  </div>
                                )}
                              </div>
                              {editingExistingItem ? (
                                <button
                                  onClick={() => {
                                    // Eliminar todos los items del combo
                                    group.items.forEach(item => handleDeleteExistingItem(item.id));
                                  }}
                                  className="text-red-500 hover:text-red-700 text-xs"
                                >
                                  🗑️ Quitar combo
                                </button>
                              ) : (
                                <span className="font-medium text-purple-700">{formatCurrency(group.total)}</span>
                              )}
                            </div>
                          <div className="text-xs text-gray-600 pl-4 space-y-1">
                            {group.items.map((item) => {
                              const basePrice = item.is_michelada
                                ? item.unit_price - MICHELADA_EXTRA
                                : item.unit_price;

                              return (
                                <div key={item.id} className="flex items-center justify-between">
                                  <span>
                                    {item.quantity}x {item.product_name}
                                    {item.is_michelada && <span className="text-amber-600"> Michelada</span>}
                                  </span>
                                  {editingExistingItem && (
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => setEditItemModal({
                                          id: item.id,
                                          product_name: item.product_name,
                                          quantity: item.quantity,
                                          unit_price: item.unit_price,
                                          is_michelada: item.is_michelada || false,
                                          original_price: basePrice,
                                        })}
                                        className="text-blue-500 hover:text-blue-700 text-xs"
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        onClick={() => handleDeleteExistingItem(item.id)}
                                        className="text-red-500 hover:text-red-700 text-xs"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        );
                      })}

                      {/* Items individuales */}
                      {individualItems.map((item) => {
                        // Calcular precio base (sin michelada)
                        const basePrice = item.is_michelada
                          ? item.unit_price - MICHELADA_EXTRA
                          : item.unit_price;

                        return (
                          <div key={item.id} className="flex items-center justify-between py-1">
                            <div className="flex-1">
                              <div className="text-gray-900">
                                {item.quantity}x {item.product_name}
                                {item.is_michelada && <span className="text-amber-600"> Michelada</span>}
                              </div>
                              {item.added_by_name && (
                                <div className="text-xs text-gray-500">
                                  Agregado por: <span className="font-medium">{item.added_by_name}</span>
                                </div>
                              )}
                            </div>
                            {editingExistingItem ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setEditItemModal({
                                    id: item.id,
                                    product_name: item.product_name,
                                    quantity: item.quantity,
                                    unit_price: item.unit_price,
                                    is_michelada: item.is_michelada || false,
                                    original_price: basePrice,
                                  })}
                                  className="text-blue-500 hover:text-blue-700 text-xs px-2"
                                >
                                  ✏️ Editar
                                </button>
                                <button
                                  onClick={() => handleDeleteExistingItem(item.id)}
                                  className="text-red-500 hover:text-red-700 text-xs px-2"
                                >
                                  🗑️ Quitar
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-600">{formatCurrency(item.subtotal)}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Agregar producto */}
              <div className="bg-amber-50 rounded-xl p-4 mb-4">
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

              {/* Agregar combo */}
              <div className="bg-purple-50 rounded-xl p-4 mb-6">
                <h3 className="font-medium text-purple-800 mb-3">🎁 Agregar Combo</h3>
                {combos.length > 0 ? (
                  <div className="flex gap-3">
                    <select
                      value={selectedCombo}
                      onChange={(e) => {
                        if (e.target.value) handleComboSelect(e.target.value);
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                    >
                      <option value="">Seleccionar combo...</option>
                      {combos.map(combo => (
                        <option key={combo.id} value={combo.id}>
                          {combo.name} - {formatCurrency(combo.base_price)}
                          {combo.is_price_editable ? ' (Editable)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-sm text-purple-600">
                    No hay combos creados. El administrador debe crear combos desde la página de Combos.
                  </p>
                )}
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Lista de nuevos productos y combos */}
              <div className="space-y-3">
                {cart.length === 0 && cartCombos.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p>No hay productos nuevos</p>
                    <p className="text-sm">Selecciona un producto o combo</p>
                  </div>
                ) : (
                  <>
                    {cart.length > 0 && (
                      <>
                        <h3 className="font-medium text-gray-700">Productos</h3>
                        {cart.map(item => {
                          const unitPrice = item.product.sale_price + (item.isMichelada ? MICHELADA_EXTRA : 0);
                          return (
                            <div key={`${item.product.id}-${item.isMichelada}`} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-4">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">
                                  {item.product.name}
                                  {item.isMichelada && <span className="text-amber-600 ml-1">🌶️</span>}
                                </p>
                                <p className="text-sm text-gray-500">{formatCurrency(unitPrice)} c/u</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleUpdateQuantity(item.product.id, item.quantity - 1, item.isMichelada)}
                                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
                                  >
                                    -
                                  </button>
                                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                                  <button
                                    onClick={() => handleUpdateQuantity(item.product.id, item.quantity + 1, item.isMichelada)}
                                    className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 hover:bg-amber-200"
                                  >
                                    +
                                  </button>
                                </div>
                                <span className="w-24 text-right font-bold">
                                  {formatCurrency(unitPrice * item.quantity)}
                                </span>
                                <button
                                  onClick={() => handleRemoveFromCart(item.product.id, item.isMichelada)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}

                    {cartCombos.length > 0 && (
                      <>
                        <h3 className="font-medium text-gray-700 mt-4">🎁 Combos</h3>
                        {cartCombos.map((cartCombo, index) => (
                          <div key={`combo-${index}`} className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-purple-900">{cartCombo.combo.name}</p>
                                <div className="text-xs text-gray-500 mt-1">
                                  {cartCombo.items.map((item, i) => (
                                    <span key={i}>
                                      {item.quantity}x {item.product.name}
                                      {item.isMichelada && ' 🌶️'}
                                      {i < cartCombo.items.length - 1 && ', '}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-purple-700">
                                  {formatCurrency(cartCombo.finalPrice)}
                                </span>
                                <button
                                  onClick={() => handleRemoveCombo(index)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
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
                {(existingTab || combosTotal > 0) && (newItemsTotal > 0 || combosTotal > 0) && (
                  <p className="text-sm text-gray-500 mt-1">
                    {existingTab && `Anterior: ${formatCurrency(existingTotal)} + `}
                    {newItemsTotal > 0 && `Productos: ${formatCurrency(newItemsTotal)}`}
                    {newItemsTotal > 0 && combosTotal > 0 && ' + '}
                    {combosTotal > 0 && `Combos: ${formatCurrency(combosTotal)}`}
                  </p>
                )}
              </div>

              {/* Métodos de pago */}
              <div className="grid grid-cols-4 gap-2">
                {(['cash', 'transfer', 'mixed', 'fiado'] as PaymentMethod[]).map(method => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      paymentMethod === method
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">
                      {method === 'cash' ? '💵' : method === 'transfer' ? '📱' : method === 'mixed' ? '💳' : '📝'}
                    </div>
                    <p className="font-medium text-xs">
                      {method === 'cash' ? 'Efectivo' : method === 'transfer' ? 'Transfer.' : method === 'mixed' ? 'Mixto' : 'Fiado'}
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

              {paymentMethod === 'fiado' && (
                <div className="space-y-4">
                  <div className="bg-orange-50 rounded-xl p-4 text-center">
                    <p className="text-orange-700 text-sm font-medium">⚠️ Esta venta quedará como fiado</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre del cliente *
                    </label>
                    <input
                      type="text"
                      value={fiadoCustomerName}
                      onChange={(e) => setFiadoCustomerName(e.target.value)}
                      className="w-full px-4 py-3 text-lg border-2 border-gray-200 rounded-xl focus:border-orange-500"
                      placeholder="¿A quién se le fía?"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Abono (opcional)
                    </label>
                    <input
                      type="number"
                      value={fiadoAbono}
                      onChange={(e) => setFiadoAbono(e.target.value)}
                      className="w-full px-4 py-3 text-lg font-bold text-center border-2 border-gray-200 rounded-xl focus:border-green-500"
                      placeholder="0"
                    />
                  </div>
                  <div className="bg-orange-100 rounded-lg p-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Total:</span>
                      <span className="font-medium">{formatCurrency(total)}</span>
                    </div>
                    {parseFloat(fiadoAbono) > 0 && (
                      <div className="flex justify-between text-sm mb-1">
                        <span>Abono:</span>
                        <span className="text-green-600 font-medium">-{formatCurrency(parseFloat(fiadoAbono) || 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg pt-2 border-t border-orange-200 mt-2">
                      <span className="font-medium">Queda debiendo:</span>
                      <span className="text-orange-700 font-bold">{formatCurrency(getFiadoAmount())}</span>
                    </div>
                  </div>
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
                  {existingTab && totalPaid > 0 && (
                    <div className="text-sm mt-1">
                      <span className="text-green-600">Pagado: {formatCurrency(totalPaid)}</span>
                      <span className="text-amber-600 ml-3">Resta: {formatCurrency(remaining)}</span>
                      <button
                        onClick={() => setShowPartialPaymentsHistory(true)}
                        className="ml-3 text-blue-600 hover:underline"
                      >
                        Ver historial
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3 flex-wrap">
                <Button variant="outline" onClick={onClose} className="flex-1 min-w-[100px]">
                  Cancelar
                </Button>
                {existingTab && (
                  <Button
                    variant="outline"
                    onClick={() => setShowPartialPaymentModal(true)}
                    disabled={existingItems.length === 0}
                    className="flex-1 min-w-[100px] border-green-500 text-green-700 hover:bg-green-50"
                  >
                    Pago Parcial
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={handleSaveAsOpen}
                  disabled={(cart.length === 0 && cartCombos.length === 0 && !existingTab) || isProcessing}
                  className="flex-1 min-w-[100px]"
                >
                  {isProcessing ? 'Guardando...' : 'Guardar (Cuenta Abierta)'}
                </Button>
                <Button
                  onClick={() => setStep('payment')}
                  disabled={(cart.length === 0 && cartCombos.length === 0 && !existingTab) || total === 0}
                  className="flex-1 min-w-[100px]"
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

      {/* Modal para combo editable */}
      {showComboModal && (
        <EditableComboModalSales
          combo={showComboModal}
          products={products}
          onClose={() => setShowComboModal(null)}
          onAdd={(items, finalPrice) => handleAddComboFromModal(showComboModal, items, finalPrice)}
        />
      )}

      {/* Modal para michelada */}
      {showMicheladaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold mb-2 text-center">
              {showMicheladaModal.product.name}
            </h2>
            <p className="text-center text-gray-600 mb-6">
              ¿Cómo lo quiere el cliente?
            </p>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleMicheladaChoice(false)}
                className="p-4 rounded-xl border-2 border-gray-200 hover:border-amber-500 hover:bg-amber-50 transition-all"
              >
                <div className="text-3xl mb-2">🍺</div>
                <p className="font-medium">Normal</p>
                <p className="text-sm text-gray-500">
                  {formatCurrency(showMicheladaModal.product.sale_price)}
                </p>
              </button>

              <button
                onClick={() => handleMicheladaChoice(true)}
                className="p-4 rounded-xl border-2 border-amber-500 bg-amber-50 hover:bg-amber-100 transition-all"
              >
                <div className="text-3xl mb-2">🌶️</div>
                <p className="font-medium text-amber-700">Michelada</p>
                <p className="text-sm text-amber-600">
                  {formatCurrency(showMicheladaModal.product.sale_price + MICHELADA_EXTRA)}
                </p>
              </button>
            </div>

            <button
              onClick={() => setShowMicheladaModal(null)}
              className="w-full mt-4 py-2 text-gray-500 hover:text-gray-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal para editar item existente */}
      {editItemModal && (
        <EditExistingItemModal
          item={editItemModal}
          onClose={() => setEditItemModal(null)}
          onSave={(newQuantity, isMichelada) => {
            const newUnitPrice = isMichelada
              ? editItemModal.original_price + MICHELADA_EXTRA
              : editItemModal.original_price;
            handleUpdateExistingItem(editItemModal.id, newQuantity, newUnitPrice);
          }}
          isProcessing={isProcessing}
        />
      )}

      {/* Modal de Pago Parcial */}
      {showPartialPaymentModal && existingTab && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">
                  Pago Parcial - {existingTab.table_number ? `Mesa ${existingTab.table_number}` : 'Sin mesa'}
                </h2>
                <button
                  onClick={() => {
                    setShowPartialPaymentModal(false);
                    setSelectedItemsForPartial({});
                    setPartialPaymentMethod('cash');
                    setPartialCashReceived('');
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Total cuenta: {formatCurrency(existingTab.total)} |
                Pagado: {formatCurrency(totalPaid)} |
                Restante: {formatCurrency(remaining)}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Selección de productos */}
              <div className="mb-6">
                <h3 className="font-medium text-gray-900 mb-3">Selecciona los productos a pagar:</h3>
                <div className="space-y-2">
                  {existingItems.map((item) => {
                    const isSelected = !!selectedItemsForPartial[item.id];
                    return (
                      <label
                        key={item.id}
                        className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => toggleItemForPartialPayment(item, e.target.checked)}
                            className="w-5 h-5 rounded text-green-600"
                          />
                          <div>
                            <p className="font-medium">
                              {item.quantity}x {item.product_name}
                              {item.is_michelada && ' 🌶️'}
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatCurrency(item.unit_price)} c/u
                            </p>
                          </div>
                        </div>
                        <span className="font-bold text-gray-900">
                          {formatCurrency(item.subtotal)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Total seleccionado */}
              <div className="bg-gray-100 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">Total seleccionado:</span>
                  <span className="text-2xl font-bold text-green-600">
                    {formatCurrency(partialPaymentTotal)}
                  </span>
                </div>
              </div>

              {/* Método de pago */}
              {partialPaymentTotal > 0 && (
                <div className="mb-6">
                  <h3 className="font-medium text-gray-900 mb-3">Método de pago:</h3>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {(['cash', 'transfer', 'mixed'] as const).map((method) => (
                      <button
                        key={method}
                        onClick={() => setPartialPaymentMethod(method)}
                        className={`p-3 rounded-lg border-2 text-center transition-all ${
                          partialPaymentMethod === method
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-xl mb-1">
                          {method === 'cash' ? '💵' : method === 'transfer' ? '📱' : '💳'}
                        </div>
                        <div className="text-sm font-medium">
                          {method === 'cash' ? 'Efectivo' : method === 'transfer' ? 'Transfer' : 'Mixto'}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Campos según método */}
                  {partialPaymentMethod === 'cash' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Efectivo recibido
                      </label>
                      <input
                        type="number"
                        value={partialCashReceived}
                        onChange={(e) => setPartialCashReceived(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg text-lg"
                        placeholder={`Mínimo ${formatCurrency(partialPaymentTotal)}`}
                      />
                      {parseFloat(partialCashReceived) >= partialPaymentTotal && (
                        <p className="text-green-600 mt-2 text-lg font-medium">
                          Cambio: {formatCurrency(getPartialChange())}
                        </p>
                      )}
                    </div>
                  )}

                  {partialPaymentMethod === 'mixed' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Transferencia
                        </label>
                        <input
                          type="number"
                          value={partialTransferAmount}
                          onChange={(e) => setPartialTransferAmount(e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg"
                          placeholder="$0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Efectivo
                        </label>
                        <input
                          type="number"
                          value={partialCashAmount}
                          onChange={(e) => setPartialCashAmount(e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg"
                          placeholder="$0"
                        />
                      </div>
                      {(parseFloat(partialTransferAmount) || 0) + (parseFloat(partialCashAmount) || 0) >= partialPaymentTotal && (
                        <p className="text-green-600 text-lg font-medium">
                          Cambio: {formatCurrency(getPartialChange())}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">
                  {error}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPartialPaymentModal(false);
                    setSelectedItemsForPartial({});
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => setShowPartialConfirmation(true)}
                  disabled={!canConfirmPartialPayment()}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  Registrar Pago
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Pago Parcial */}
      {showPartialConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">⚠️</span>
              </div>
              <h2 className="text-xl font-bold">Confirmar Pago Parcial</h2>
              <p className="text-gray-600 mt-2">
                ¿Registrar pago parcial de <span className="font-bold text-green-600">{formatCurrency(partialPaymentTotal)}</span>?
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Método:</strong>{' '}
                {partialPaymentMethod === 'cash' ? 'Efectivo' : partialPaymentMethod === 'transfer' ? 'Transferencia' : 'Mixto'}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Productos:</strong>{' '}
                {Object.keys(selectedItemsForPartial).length} item(s)
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowPartialConfirmation(false)}
                disabled={isProcessing}
                className="flex-1"
              >
                No, Cancelar
              </Button>
              <Button
                onClick={handleCreatePartialPayment}
                disabled={isProcessing}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {isProcessing ? 'Procesando...' : 'Sí, Pagar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Historial de Pagos Parciales */}
      {showPartialPaymentsHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">
                  Historial de Pagos - {existingTab?.table_number ? `Mesa ${existingTab.table_number}` : 'Sin mesa'}
                </h2>
                <button
                  onClick={() => setShowPartialPaymentsHistory(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {partialPayments.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  No hay pagos parciales registrados
                </p>
              ) : (
                <div className="space-y-4">
                  {partialPayments.map((payment, index) => (
                    <div key={payment.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">
                          Pago #{index + 1}
                        </span>
                        <span className="text-lg font-bold text-green-600">
                          {formatCurrency(payment.amount)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 mb-2">
                        {formatTime(payment.created_at)} -
                        {payment.payment_method === 'cash' ? ' Efectivo' : payment.payment_method === 'transfer' ? ' Transferencia' : ' Mixto'} |
                        Por: {payment.employee_name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {payment.items?.map((item, idx) => (
                          <span key={item.id}>
                            {item.quantity}x {item.product_name} ({formatCurrency(item.amount)})
                            {idx < payment.items.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <span className="font-medium text-gray-700">Total pagado:</span>
                <span className="text-xl font-bold text-green-600">{formatCurrency(totalPaid)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-700">Restante:</span>
                <span className="text-xl font-bold text-amber-600">{formatCurrency(remaining)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Modal para editar item existente
function EditExistingItemModal({
  item,
  onClose,
  onSave,
  isProcessing,
}: {
  item: {
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    is_michelada: boolean;
    original_price: number;
  };
  onClose: () => void;
  onSave: (quantity: number, isMichelada: boolean) => void;
  isProcessing: boolean;
}) {
  const [quantity, setQuantity] = useState(item.quantity);
  const [isMichelada, setIsMichelada] = useState(item.is_michelada);

  const newUnitPrice = isMichelada
    ? item.original_price + MICHELADA_EXTRA
    : item.original_price;
  const newSubtotal = quantity * newUnitPrice;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6">
        <h2 className="text-xl font-bold mb-4 text-center">
          Editar Item
        </h2>

        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <p className="font-medium text-gray-900">{item.product_name}</p>
          <p className="text-sm text-gray-500">Precio base: {formatCurrency(item.original_price)}</p>
        </div>

        {/* Cantidad */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cantidad
          </label>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xl hover:bg-gray-300"
              disabled={quantity <= 1}
            >
              -
            </button>
            <span className="text-2xl font-bold w-12 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center text-xl text-amber-700 hover:bg-amber-300"
            >
              +
            </button>
          </div>
        </div>

        {/* Michelada toggle */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de preparación
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setIsMichelada(false)}
              className={`p-3 rounded-xl border-2 transition-all ${
                !isMichelada
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-1">🍺</div>
              <p className="font-medium text-sm">Normal</p>
              <p className="text-xs text-gray-500">{formatCurrency(item.original_price)}</p>
            </button>
            <button
              onClick={() => setIsMichelada(true)}
              className={`p-3 rounded-xl border-2 transition-all ${
                isMichelada
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-1">🌶️</div>
              <p className="font-medium text-sm text-amber-700">Michelada</p>
              <p className="text-xs text-amber-600">{formatCurrency(item.original_price + MICHELADA_EXTRA)}</p>
            </button>
          </div>
        </div>

        {/* Resumen */}
        <div className="bg-amber-50 rounded-lg p-3 mb-4">
          <div className="flex justify-between text-sm">
            <span>Precio unitario:</span>
            <span>{formatCurrency(newUnitPrice)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg mt-1">
            <span>Subtotal:</span>
            <span className="text-amber-700">{formatCurrency(newSubtotal)}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={isProcessing}>
            Cancelar
          </Button>
          <Button
            onClick={() => onSave(quantity, isMichelada)}
            className="flex-1"
            disabled={isProcessing}
          >
            {isProcessing ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditableComboModalSales({
  combo,
  products,
  onClose,
  onAdd,
}: {
  combo: ComboWithItems;
  products: Product[];
  onClose: () => void;
  onAdd: (items: { product: Product; quantity: number; isMichelada?: boolean }[], finalPrice: number) => void;
}) {
  const [finalPrice, setFinalPrice] = useState(combo.base_price.toString());

  // Separar items fijos de items intercambiables
  const fixedItems = combo.combo_items?.filter(item => !item.is_swappable) || [];
  const swappableItems = combo.combo_items?.filter(item => item.is_swappable) || [];

  // Calcular cantidad total de items intercambiables
  const totalSwappableQty = swappableItems.reduce((sum, item) => sum + item.quantity, 0);

  // Estado para items intercambiables personalizados
  const [customSwappableItems, setCustomSwappableItems] = useState<{ productId: string; quantity: number }[]>(
    swappableItems.length > 0
      ? [{ productId: swappableItems[0].product_id, quantity: totalSwappableQty }]
      : []
  );

  // Productos disponibles para intercambio (cervezas)
  const beerProducts = products.filter(p => p.active);

  // Cantidad actual seleccionada
  const currentSwappableQty = customSwappableItems.reduce((sum, item) => sum + item.quantity, 0);
  const remainingQty = totalSwappableQty - currentSwappableQty;

  const handleAddSwappableProduct = () => {
    if (remainingQty <= 0) return;
    const availableProduct = beerProducts.find(p =>
      !customSwappableItems.some(item => item.productId === p.id)
    );
    if (availableProduct) {
      setCustomSwappableItems([...customSwappableItems, { productId: availableProduct.id, quantity: 1 }]);
    }
  };

  const handleRemoveSwappableProduct = (index: number) => {
    if (customSwappableItems.length <= 1) return;
    setCustomSwappableItems(customSwappableItems.filter((_, i) => i !== index));
  };

  const handleSwappableProductChange = (index: number, productId: string) => {
    const updated = [...customSwappableItems];
    updated[index].productId = productId;
    setCustomSwappableItems(updated);
  };

  const handleSwappableQtyChange = (index: number, qty: number) => {
    if (qty < 1) return;
    const otherQty = customSwappableItems.reduce((sum, item, i) => i === index ? sum : sum + item.quantity, 0);
    if (qty + otherQty > totalSwappableQty) return;

    const updated = [...customSwappableItems];
    updated[index].quantity = qty;
    setCustomSwappableItems(updated);
  };

  const handleSubmit = () => {
    // Agregar items fijos
    const items: { product: Product; quantity: number; isMichelada?: boolean }[] = [];

    for (const item of fixedItems) {
      const product = products.find(p => p.id === item.product_id);
      if (product) {
        items.push({ product, quantity: item.quantity, isMichelada: item.is_michelada });
      }
    }

    // Agregar items intercambiables personalizados
    for (const item of customSwappableItems) {
      if (item.quantity > 0) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          // Detectar si es michelada basado en el item original
          const originalIsMichelada = swappableItems.some(s => s.is_michelada);
          items.push({ product, quantity: item.quantity, isMichelada: originalIsMichelada });
        }
      }
    }

    onAdd(items, parseFloat(finalPrice) || combo.base_price);
  };

  const canSubmit = currentSwappableQty === totalSwappableQty || totalSwappableQty === 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-2">{combo.name}</h2>
        {combo.description && (
          <p className="text-sm text-gray-500 mb-4">{combo.description}</p>
        )}

        {/* Precio editable */}
        {combo.is_price_editable && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Precio final
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">$</span>
              <input
                type="number"
                value={finalPrice}
                onChange={(e) => setFinalPrice(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-lg font-bold"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Precio base: {formatCurrency(combo.base_price)}
            </p>
          </div>
        )}

        {/* Productos fijos del combo */}
        {fixedItems.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-sm font-medium text-gray-700">Productos fijos:</p>
            {fixedItems.map((item, index) => {
              const product = products.find(p => p.id === item.product_id);
              return (
                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium w-8 text-center">{item.quantity}x</span>
                  <span className="flex-1 text-sm">{product?.name}</span>
                  {item.is_michelada && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Mich</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Productos intercambiables */}
        {totalSwappableQty > 0 && (
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">
                Cervezas a elegir: <span className="text-amber-600">{currentSwappableQty}/{totalSwappableQty}</span>
              </p>
              {remainingQty > 0 && (
                <button
                  onClick={handleAddSwappableProduct}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  + Agregar otra
                </button>
              )}
            </div>

            {customSwappableItems.map((item, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleSwappableQtyChange(index, item.quantity - 1)}
                    className="w-6 h-6 rounded bg-gray-200 text-gray-700 text-sm hover:bg-gray-300"
                    disabled={item.quantity <= 1}
                  >
                    -
                  </button>
                  <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    onClick={() => handleSwappableQtyChange(index, item.quantity + 1)}
                    className="w-6 h-6 rounded bg-amber-200 text-amber-700 text-sm hover:bg-amber-300"
                    disabled={remainingQty <= 0}
                  >
                    +
                  </button>
                </div>
                <select
                  value={item.productId}
                  onChange={(e) => handleSwappableProductChange(index, e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  {beerProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {customSwappableItems.length > 1 && (
                  <button
                    onClick={() => handleRemoveSwappableProduct(index)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}

            {remainingQty > 0 && (
              <p className="text-xs text-amber-600">
                Faltan {remainingQty} cerveza(s) por seleccionar
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} className="flex-1">
            Agregar {formatCurrency(parseFloat(finalPrice) || combo.base_price)}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SaleDetailModal({ sale, onClose }: { sale: SaleWithDetails; onClose: () => void }) {
  // Agrupar items por combo
  const comboGroups: Record<string, { name: string; items: typeof sale.sale_items; total: number }> = {};
  const individualItems: typeof sale.sale_items = [];

  sale.sale_items?.forEach((item) => {
    if (item.combo_id && item.combos?.name) {
      if (!comboGroups[item.combo_id]) {
        comboGroups[item.combo_id] = { name: item.combos.name, items: [], total: 0 };
      }
      comboGroups[item.combo_id].items.push(item);
      comboGroups[item.combo_id].total += item.subtotal;
    } else {
      individualItems.push(item);
    }
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
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

          {/* Empleados que intervinieron */}
          <div className="bg-blue-50 rounded-lg p-3 mt-2">
            <p className="text-xs font-medium text-blue-800 mb-2">Empleados que intervinieron:</p>
            <div className="space-y-1 text-sm">
              {sale.opened_by?.name && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Abrió la cuenta:</span>
                  <span className="font-medium">{sale.opened_by.name}</span>
                </div>
              )}
              {sale.taken_over_by?.name && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Retomó la cuenta:</span>
                  <span className="font-medium">{sale.taken_over_by.name}</span>
                </div>
              )}
              {sale.closed_by?.name && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Cerró la cuenta:</span>
                  <span className="font-medium">{sale.closed_by.name}</span>
                </div>
              )}
              {!sale.opened_by?.name && !sale.taken_over_by?.name && !sale.closed_by?.name && sale.employees?.name && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Empleado:</span>
                  <span className="font-medium">{sale.employees.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Observaciones */}
          {(sale.notes || sale.close_notes || sale.takeover_notes) && (
            <div className="bg-yellow-50 rounded-lg p-3 mt-2 border border-yellow-200">
              <p className="text-xs font-medium text-yellow-800 mb-2">Observaciones:</p>
              <div className="space-y-2 text-sm">
                {sale.notes && (
                  <div>
                    <span className="text-yellow-700 font-medium">General: </span>
                    <span className="text-yellow-900">{sale.notes}</span>
                  </div>
                )}
                {sale.takeover_notes && (
                  <div>
                    <span className="text-yellow-700 font-medium">Al retomar: </span>
                    <span className="text-yellow-900">{sale.takeover_notes}</span>
                  </div>
                )}
                {sale.close_notes && (
                  <div>
                    <span className="text-yellow-700 font-medium">Al cerrar: </span>
                    <span className="text-yellow-900">{sale.close_notes}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Método de pago:</span>
            <span>
              {sale.payment_method === 'cash' ? 'Efectivo' :
               sale.payment_method === 'transfer' ? 'Transferencia' :
               sale.payment_method === 'fiado' ? 'Fiado' : 'Mixto'}
            </span>
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
          {sale.payment_method === 'fiado' && (
            <div className="bg-orange-50 rounded-lg p-3 mt-2">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Cliente:</span>
                <span className="font-medium text-orange-700">{sale.fiado_customer_name}</span>
              </div>
              {sale.fiado_abono && sale.fiado_abono > 0 && (
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Abono:</span>
                  <span className="text-green-600">{formatCurrency(sale.fiado_abono)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Queda debiendo:</span>
                <span className="font-bold text-orange-700">{formatCurrency(sale.fiado_amount || 0)}</span>
              </div>
              {sale.fiado_paid && (
                <p className="text-xs text-green-600 mt-2">✅ Pagado</p>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 pt-4 mb-4">
          <h3 className="font-medium mb-2">Productos</h3>
          <div className="space-y-2">
            {/* Combos agrupados */}
            {Object.entries(comboGroups).map(([comboId, group]) => {
              // Obtener quién agregó el combo (del primer item)
              const addedByName = group.items[0]?.added_by?.name;

              return (
                <div key={comboId} className="bg-purple-50 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-medium text-purple-800">🎁 {group.name}</span>
                      {addedByName && (
                        <p className="text-xs text-purple-600">Vendido por: {addedByName}</p>
                      )}
                    </div>
                    <span className="font-medium text-purple-700">{formatCurrency(group.total)}</span>
                  </div>
                  <div className="space-y-1 text-xs text-gray-600">
                    {group.items.map((item) => (
                      <p key={item.id}>
                        {item.quantity}x {item.products?.name}
                        {item.is_michelada && ' 🌶️'}
                      </p>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Items individuales */}
            {individualItems.map((item) => (
              <div key={item.id} className="text-sm py-1">
                <div className="flex justify-between">
                  <span>
                    {item.quantity}x {item.products?.name}
                    {item.is_michelada && <span className="text-amber-600 ml-1">🌶️ michelada</span>}
                  </span>
                  <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                </div>
                {item.added_by?.name && (
                  <p className="text-xs text-gray-500">Vendido por: {item.added_by.name}</p>
                )}
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
