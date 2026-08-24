'use client';

import { useState } from 'react';
import {
  useDemoStore,
  tabTotal,
  tabPaid,
  comboItemsTotal,
  lineItemUnitPrice,
  getBombaExtra,
  MICHELADA_EXTRA,
  type DemoProduct,
  type DemoLineItem,
  type DemoTab,
  type DemoCartCombo,
  type DemoComboTemplate,
  type PayMethod,
} from '@/stores/demo-store';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DemoShiftGuard } from '@/components/layout/demo-shift-guard';

export default function DemoPosPage() {
  return (
    <DemoShiftGuard>
      <DemoPosContent />
    </DemoShiftGuard>
  );
}

function DemoPosContent() {
  const { tabs, products, discardTab, sellMostrador } = useDemoStore();
  const [showModal, setShowModal] = useState(false);
  const [editingTab, setEditingTab] = useState<DemoTab | null>(null);
  const [showCigModal, setShowCigModal] = useState(false);
  const [cigCounts, setCigCounts] = useState<Record<string, number>>({});
  const [cigPaymentMethod, setCigPaymentMethod] = useState<'cash' | 'transfer'>('cash');

  const cigProducts = products.filter((p) => p.category === 'cigarros');

  const handleOpenTab = (tab: DemoTab) => {
    setEditingTab(tab);
    setShowModal(true);
  };

  const handleNewSale = () => {
    setEditingTab(null);
    setShowModal(true);
  };

  const handleDiscard = (tab: DemoTab) => {
    const hasItems = tab.items.length > 0 || tab.combos.length > 0;
    const msg = hasItems
      ? `¿Descartar la cuenta de Mesa ${tab.tableNumber}? Se devolverán los productos (y combos) al inventario.`
      : `¿Descartar la cuenta vacía de Mesa ${tab.tableNumber}?`;
    if (!confirm(msg)) return;
    discardTab(tab.id);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Punto de Venta — Práctica</h1>
        <div className="flex gap-2">
          {cigProducts.length > 0 && (
            <Button
              variant="outline"
              onClick={() => { setCigCounts({}); setCigPaymentMethod('cash'); setShowCigModal(true); }}
            >
              🚬 Cigarrillos
            </Button>
          )}
          <Button onClick={handleNewSale} className="bg-amber-500 hover:bg-amber-600 focus:ring-amber-500">
            + Nueva Venta
          </Button>
        </div>
      </div>

      {tabs.length > 0 ? (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-neutral-100 mb-3 flex items-center gap-2">
            <span className="w-3 h-3 bg-amber-500 rounded-full animate-pulse"></span>
            Cuentas Abiertas ({tabs.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className="border-2 rounded-xl text-left hover:shadow-md transition-all bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 hover:border-amber-400"
              >
                <div className="p-4 cursor-pointer" onClick={() => handleOpenTab(tab)}>
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-bold text-lg text-amber-800 dark:text-amber-400">
                      Mesa {tab.tableNumber}
                    </span>
                    <div className="text-right">
                      <span className="text-xl font-bold text-gray-900 dark:text-neutral-100">
                        {formatCurrency(tabTotal(tab))}
                      </span>
                      {tabPaid(tab) > 0 && (
                        <div className="text-xs mt-1">
                          <span className="text-green-600 dark:text-green-400">Pagado: {formatCurrency(tabPaid(tab))}</span>
                          <span className="text-amber-600 dark:text-amber-400 ml-2">Resta: {formatCurrency(tabTotal(tab) - tabPaid(tab))}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-neutral-300">
                    {tab.items.length === 0 && tab.combos.length === 0 ? (
                      <span className="text-gray-500 dark:text-neutral-400 italic">Sin productos</span>
                    ) : (
                      <>
                        {tab.combos.map((c, idx) => (
                          <span key={`c-${idx}`}>🎁 {c.comboName}{idx < tab.combos.length - 1 || tab.items.length > 0 ? ', ' : ''}</span>
                        ))}
                        {tab.items.slice(0, 3).map((item, idx) => (
                          <span key={idx}>
                            {item.quantity}x {item.product.name}
                            {idx < Math.min(tab.items.length - 1, 2) ? ', ' : ''}
                          </span>
                        ))}
                        {tab.items.length > 3 && (
                          <span className="text-gray-500 dark:text-neutral-400"> +{tab.items.length - 3} más</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="px-4 pb-3 flex justify-end">
                  <button
                    onClick={() => handleDiscard(tab)}
                    className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 px-2 py-1 rounded transition-colors"
                  >
                    Descartar cuenta
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500 dark:text-neutral-400 bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700">
          No hay mesas abiertas. Crea una con &quot;+ Nueva Venta&quot;.
        </div>
      )}

      {showModal && (
        <SaleModal
          existingTab={editingTab}
          onClose={() => {
            setShowModal(false);
            setEditingTab(null);
          }}
        />
      )}

      {showCigModal && (() => {
        const total = cigProducts.reduce((sum, p) => sum + (cigCounts[p.id] || 0) * p.sale_price, 0);
        const hasAny = cigProducts.some((p) => (cigCounts[p.id] || 0) > 0);
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-neutral-100">🚬 Mostrador</h2>
                <button onClick={() => setShowCigModal(false)} className="text-gray-500 dark:text-neutral-400 hover:text-gray-600 dark:hover:text-neutral-300 text-3xl leading-none">×</button>
              </div>

              <div className="flex gap-3 mb-5">
                {cigProducts.map((p) => {
                  const count = cigCounts[p.id] || 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setCigCounts((prev) => ({ ...prev, [p.id]: (prev[p.id] || 0) + 1 }))}
                      className="flex-1 flex flex-col items-center justify-center gap-2 py-8 rounded-2xl bg-gray-900 hover:bg-gray-700 active:scale-95 transition-transform text-white select-none"
                    >
                      <span className="text-5xl font-black">{count > 0 ? count : '+'}</span>
                      <span className="text-lg font-semibold">{p.name}</span>
                      <span className="text-gray-400 text-sm">{formatCurrency(p.sale_price)}</span>
                    </button>
                  );
                })}
              </div>

              {hasAny && (
                <div className="flex justify-between items-center bg-gray-50 dark:bg-neutral-950 rounded-xl px-4 py-3 mb-4">
                  <span className="text-gray-500 dark:text-neutral-400 text-sm">Total</span>
                  <span className="font-bold text-gray-900 dark:text-neutral-100 text-xl">{formatCurrency(total)}</span>
                </div>
              )}

              {hasAny && (
                <button
                  onClick={() => setCigCounts({})}
                  className="w-full py-2 mb-3 rounded-xl bg-gray-100 dark:bg-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-600 dark:text-neutral-300 text-sm font-medium"
                >
                  Resetear cantidad
                </button>
              )}

              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setCigPaymentMethod('cash')}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${cigPaymentMethod === 'cash' ? 'bg-green-600 text-white border-green-600' : 'bg-white dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 border-gray-300 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-950'}`}
                >
                  💵 Efectivo
                </button>
                <button
                  onClick={() => setCigPaymentMethod('transfer')}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${cigPaymentMethod === 'transfer' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 border-gray-300 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-950'}`}
                >
                  🔄 Transferencia
                </button>
              </div>

              <button
                onClick={() => {
                  sellMostrador(cigCounts, cigPaymentMethod);
                  setShowCigModal(false);
                  setCigCounts({});
                }}
                disabled={!hasAny}
                className="w-full py-4 rounded-xl bg-gray-900 text-white font-bold text-base hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Confirmar → Mostrador
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

type Step = 'products' | 'payment';
type PaymentMethod = PayMethod | 'fiado';

function SaleModal({ existingTab, onClose }: { existingTab: DemoTab | null; onClose: () => void }) {
  const { products, combos, upsertTab, closeTab, closeTabAsFiado, addTabObservation } = useDemoStore();
  // Las observaciones se leen en vivo del store (no del snapshot de existingTab)
  // para que la lista se actualice al instante al agregar una nueva.
  const liveObservations = useDemoStore((s) => s.tabs.find((t) => t.id === existingTab?.id)?.tabObservations) || [];
  const [newTabObservation, setNewTabObservation] = useState('');

  const [step, setStep] = useState<Step>('products');
  const [tableNumber, setTableNumber] = useState(existingTab?.tableNumber || '');
  const [items, setItems] = useState<DemoLineItem[]>(existingTab ? existingTab.items.map((i) => ({ ...i })) : []);
  const [comboItems, setComboItems] = useState<DemoCartCombo[]>(existingTab ? existingTab.combos.map((c) => ({ ...c })) : []);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [selectedComboId, setSelectedComboId] = useState('');
  const [editingCombo, setEditingCombo] = useState<DemoComboTemplate | null>(null);
  const [committedTabId, setCommittedTabId] = useState<string | null>(existingTab?.id || null);
  const [showPartialModal, setShowPartialModal] = useState(false);
  const [showMicheladaModal, setShowMicheladaModal] = useState<{ product: DemoProduct; qty: number } | null>(null);
  const [showBombaModal, setShowBombaModal] = useState<{ product: DemoProduct; qty: number } | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cashReceived, setCashReceived] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [cashAmountMixed, setCashAmountMixed] = useState('');
  const [fiadoCustomerName, setFiadoCustomerName] = useState('');
  const [fiadoAbono, setFiadoAbono] = useState('');

  const total = items.reduce((sum, i) => sum + lineItemUnitPrice(i) * i.quantity, 0) + comboItemsTotal(comboItems);
  const alreadyPaid = existingTab ? tabPaid(existingTab) : 0;
  const totalToPay = Math.max(0, total - alreadyPaid);

  const getChange = () => {
    if (paymentMethod === 'cash') return Math.max(0, (parseFloat(cashReceived) || 0) - totalToPay);
    if (paymentMethod === 'mixed') {
      const paid = (parseFloat(transferAmount) || 0) + (parseFloat(cashAmountMixed) || 0);
      return Math.max(0, paid - totalToPay);
    }
    return 0;
  };

  const canConfirmPayment = () => {
    if (paymentMethod === 'transfer') return true;
    if (paymentMethod === 'cash') return (parseFloat(cashReceived) || 0) >= totalToPay;
    if (paymentMethod === 'mixed') {
      const paid = (parseFloat(transferAmount) || 0) + (parseFloat(cashAmountMixed) || 0);
      return paid >= totalToPay;
    }
    if (paymentMethod === 'fiado') return fiadoCustomerName.trim().length > 0;
    return false;
  };

  const addResolvedItem = (product: DemoProduct, qty: number, isMichelada: boolean, isBomba: boolean) => {
    setItems((prev) => {
      const existing = prev.find(
        (i) => i.product.id === product.id && !!i.isMichelada === isMichelada && !!i.isBomba === isBomba
      );
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id && !!i.isMichelada === isMichelada && !!i.isBomba === isBomba
            ? { ...i, quantity: i.quantity + qty }
            : i
        );
      }
      return [...prev, { product, quantity: qty, isMichelada, isBomba }];
    });
  };

  const handleAddProduct = () => {
    if (!selectedProductId) return;
    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;
    const qty = parseInt(quantity) || 1;

    if (product.category.includes('beer')) {
      setShowMicheladaModal({ product, qty });
      setSelectedProductId('');
      setQuantity('1');
      return;
    }
    if (product.category === 'agua' || product.category === 'soda') {
      setShowBombaModal({ product, qty });
      setSelectedProductId('');
      setQuantity('1');
      return;
    }

    addResolvedItem(product, qty, false, false);
    setSelectedProductId('');
    setQuantity('1');
  };

  const handleMicheladaChoice = (isMichelada: boolean) => {
    if (!showMicheladaModal) return;
    addResolvedItem(showMicheladaModal.product, showMicheladaModal.qty, isMichelada, false);
    setShowMicheladaModal(null);
  };

  const handleBombaChoice = (isMichelada: boolean, isBomba: boolean) => {
    if (!showBombaModal) return;
    addResolvedItem(showBombaModal.product, showBombaModal.qty, isMichelada, isBomba);
    setShowBombaModal(null);
  };

  const handleUpdateQty = (item: DemoLineItem, newQty: number) => {
    const productId = item.product.id;
    const isMichelada = !!item.isMichelada;
    const isBomba = !!item.isBomba;
    const matches = (i: DemoLineItem) => i.product.id === productId && !!i.isMichelada === isMichelada && !!i.isBomba === isBomba;
    if (newQty <= 0) {
      setItems((prev) => prev.filter((i) => !matches(i)));
      return;
    }
    setItems((prev) => prev.map((i) => (matches(i) ? { ...i, quantity: newQty } : i)));
  };

  const handleSelectCombo = (comboId: string) => {
    setSelectedComboId('');
    const template = combos.find((c) => c.id === comboId);
    if (!template) return;

    const needsModal = template.isPriceEditable || template.items.some((i) => i.isSwappable);
    if (needsModal) {
      setEditingCombo(template);
      return;
    }

    const resolvedItems: DemoLineItem[] = template.items
      .map((ti) => {
        const product = products.find((p) => p.id === ti.productId);
        return product ? { product, quantity: ti.quantity } : null;
      })
      .filter((i): i is DemoLineItem => i !== null);

    setComboItems((prev) => [...prev, { comboId: template.id, comboName: template.name, items: resolvedItems, finalPrice: template.basePrice }]);
  };

  const handleAddComboFromModal = (cartCombo: DemoCartCombo) => {
    setComboItems((prev) => [...prev, cartCombo]);
    setEditingCombo(null);
  };

  const handleRemoveCombo = (index: number) => {
    setComboItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDiscard = () => {
    if (!existingTab) return;
    const hasItems = existingTab.items.length > 0 || existingTab.combos.length > 0;
    const msg = hasItems
      ? '¿Descartar esta cuenta? Se devolverán los productos (y combos) al inventario.'
      : '¿Descartar esta cuenta vacía?';
    if (!confirm(msg)) return;
    useDemoStore.getState().discardTab(existingTab.id);
    onClose();
  };

  const handleSaveOpen = () => {
    upsertTab(committedTabId, tableNumber, items, comboItems);
    onClose();
  };

  const handleGoToPayment = () => {
    const id = upsertTab(committedTabId, tableNumber, items, comboItems);
    setCommittedTabId(id);
    setStep('payment');
  };

  const handleConfirmPayment = () => {
    if (!committedTabId || !paymentMethod) return;
    const change = getChange();
    if (paymentMethod === 'cash') {
      closeTab(committedTabId, { method: 'cash', cashAmount: totalToPay, transferAmount: 0, cashChange: change });
    } else if (paymentMethod === 'transfer') {
      closeTab(committedTabId, { method: 'transfer', cashAmount: 0, transferAmount: totalToPay, cashChange: 0 });
    } else if (paymentMethod === 'mixed') {
      const cashAmountMixedNum = parseFloat(cashAmountMixed) || 0;
      closeTab(committedTabId, {
        method: 'mixed',
        cashAmount: cashAmountMixedNum - change,
        transferAmount: parseFloat(transferAmount) || 0,
        cashChange: change,
      });
    } else {
      closeTabAsFiado(committedTabId, fiadoCustomerName, parseFloat(fiadoAbono) || 0);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-neutral-100">
                {existingTab ? `Mesa ${existingTab.tableNumber}` : step === 'products' ? 'Nueva Venta' : 'Método de Pago'}
              </h2>
              {existingTab && <p className="text-sm text-gray-500 dark:text-neutral-400">Total actual: {formatCurrency(tabTotal(existingTab))}</p>}
            </div>
            <button onClick={onClose} className="text-gray-500 dark:text-neutral-400 hover:text-gray-600 dark:hover:text-neutral-300">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'products' ? (
            <>
              {!existingTab && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    Número de Mesa (opcional)
                  </label>
                  <input
                    type="text"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder="Ej: 5, Barra, Terraza..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              )}

              {existingTab && (
                <div className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl p-4 mb-4">
                  <h3 className="font-medium text-gray-700 dark:text-neutral-300 mb-3">📝 Observaciones</h3>
                  {liveObservations.length > 0 && (
                    <ul className="mb-3 space-y-1">
                      {liveObservations.map((obs) => (
                        <li key={obs.id} className="text-sm text-gray-600 dark:text-neutral-300 flex items-start gap-2">
                          <span className="text-gray-500 dark:text-neutral-400 mt-0.5">•</span>
                          <span>{obs.text}</span>
                          <span className="ml-auto text-xs text-gray-500 dark:text-neutral-400 whitespace-nowrap">
                            {new Date(obs.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTabObservation}
                      onChange={(e) => setNewTabObservation(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newTabObservation.trim()) {
                          addTabObservation(existingTab.id, newTabObservation);
                          setNewTabObservation('');
                        }
                      }}
                      placeholder="Escribe una observación..."
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                    />
                    <Button
                      onClick={() => {
                        if (!newTabObservation.trim()) return;
                        addTabObservation(existingTab.id, newTabObservation);
                        setNewTabObservation('');
                      }}
                      disabled={!newTabObservation.trim()}
                      size="sm"
                      className="bg-amber-500 hover:bg-amber-600 focus:ring-amber-500"
                    >
                      Agregar
                    </Button>
                  </div>
                </div>
              )}

              <div className="bg-amber-50 dark:bg-amber-950 rounded-xl p-4 mb-4">
                <h3 className="font-medium text-amber-800 dark:text-amber-400 mb-3">Agregar Producto</h3>
                <div className="flex gap-3">
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                  >
                    <option value="">Seleccionar producto...</option>
                    {products.map((product: DemoProduct) => (
                      <option key={product.id} value={product.id} disabled={product.stock === 0}>
                        {product.name} - {formatCurrency(product.sale_price)} ({product.stock} disp.)
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="1"
                    className="w-20 px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-center"
                  />
                  <Button onClick={handleAddProduct} disabled={!selectedProductId} className="bg-amber-500 hover:bg-amber-600 focus:ring-amber-500">
                    Agregar
                  </Button>
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-950 rounded-xl p-4 mb-4">
                <h3 className="font-medium text-purple-800 dark:text-purple-400 mb-3">🎁 Agregar Combo</h3>
                {combos.length > 0 ? (
                  <select
                    value={selectedComboId}
                    onChange={(e) => { if (e.target.value) handleSelectCombo(e.target.value); }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="">Seleccionar combo...</option>
                    {combos.map((combo) => (
                      <option key={combo.id} value={combo.id}>
                        {combo.name} - {formatCurrency(combo.basePrice)}
                        {combo.isPriceEditable ? ' (Editable)' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-purple-600 dark:text-purple-400">No hay combos de ejemplo.</p>
                )}
              </div>

              <div className="space-y-3">
                {comboItems.length === 0 && items.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-neutral-400">
                    <p>No hay productos</p>
                    <p className="text-sm">Selecciona un producto o combo arriba</p>
                  </div>
                ) : (
                  <>
                    {comboItems.length > 0 && (
                      <>
                        <h3 className="font-medium text-gray-700 dark:text-neutral-300">🎁 Combos</h3>
                        {comboItems.map((c, index) => (
                          <div key={`combo-${index}`} className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-purple-900 dark:text-purple-300">{c.comboName}</p>
                                <div className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                                  {c.items.map((item, i) => (
                                    <span key={i}>
                                      {item.quantity}x {item.product.name}
                                      {i < c.items.length - 1 && ', '}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-purple-700 dark:text-purple-400">{formatCurrency(c.finalPrice)}</span>
                                <button onClick={() => handleRemoveCombo(index)} className="text-red-500 hover:text-red-700 dark:hover:text-red-400">
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
                    {items.length > 0 && <h3 className="font-medium text-gray-700 dark:text-neutral-300 mt-4">Productos</h3>}
                  </>
                )}
                {items.length > 0 && (
                  items.map((item) => (
                    <div
                      key={`${item.product.id}-${item.isMichelada}-${item.isBomba}`}
                      className="flex items-center justify-between bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg p-4"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-neutral-100">
                          {item.product.name}
                          {item.isMichelada && <span className="text-amber-600 dark:text-amber-400 ml-1">🌶️</span>}
                          {item.isBomba && <span className="text-blue-600 dark:text-blue-400 ml-1">💣</span>}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-neutral-400">{formatCurrency(lineItemUnitPrice(item))} c/u</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleUpdateQty(item, item.quantity - 1)}
                            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-neutral-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-neutral-700"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <button
                            onClick={() => handleUpdateQty(item, item.quantity + 1)}
                            className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center text-amber-700 dark:text-amber-400 hover:bg-amber-200"
                          >
                            +
                          </button>
                        </div>
                        <span className="w-24 text-right font-bold">{formatCurrency(lineItemUnitPrice(item) * item.quantity)}</span>
                        <button onClick={() => handleUpdateQty(item, 0)} className="text-red-500 hover:text-red-700 dark:hover:text-red-400">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="space-y-6">
              <div className="bg-amber-50 dark:bg-amber-950 rounded-xl p-4 text-center">
                <p className="text-gray-600 dark:text-neutral-300 text-sm">{alreadyPaid > 0 ? 'Restante a cobrar' : 'Total a cobrar'}</p>
                <p className="text-3xl font-bold text-amber-700 dark:text-amber-400">{formatCurrency(totalToPay)}</p>
                {alreadyPaid > 0 && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">(Pagos parciales: {formatCurrency(alreadyPaid)} de {formatCurrency(total)})</p>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2">
                {(['cash', 'transfer', 'mixed', 'fiado'] as PaymentMethod[]).map((method) => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      paymentMethod === method
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950'
                        : 'border-gray-200 dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    <div className="text-2xl mb-1">{method === 'cash' ? '💵' : method === 'transfer' ? '📱' : method === 'mixed' ? '💳' : '📝'}</div>
                    <p className="font-medium text-xs">{method === 'cash' ? 'Efectivo' : method === 'transfer' ? 'Transfer.' : method === 'mixed' ? 'Mixto' : 'Fiado'}</p>
                  </button>
                ))}
              </div>

              {paymentMethod === 'cash' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Efectivo recibido</label>
                  <input
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className="w-full px-4 py-3 text-xl font-bold text-center border-2 border-gray-200 dark:border-neutral-700 rounded-xl focus:border-amber-500"
                    placeholder="0"
                    autoFocus
                  />
                  {parseFloat(cashReceived) > 0 && (
                    <div className="mt-3 text-center">
                      <p className="text-gray-600 dark:text-neutral-300 text-sm">Cambio a devolver</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(getChange())}</p>
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === 'transfer' && (
                <div className="bg-blue-50 dark:bg-blue-950 rounded-xl p-6 text-center">
                  <p className="text-gray-700 dark:text-neutral-300 mb-2">Solicita la transferencia por:</p>
                  <p className="text-3xl font-bold text-blue-700 dark:text-blue-400 mb-2">{formatCurrency(totalToPay)}</p>
                  <p className="text-sm text-gray-500 dark:text-neutral-400">Verifica el comprobante antes de confirmar</p>
                </div>
              )}

              {paymentMethod === 'fiado' && (
                <div className="space-y-4">
                  <div className="bg-amber-50 dark:bg-amber-950 rounded-xl p-4 text-center">
                    <p className="text-amber-700 dark:text-amber-400 text-sm font-medium">⚠️ Esta venta quedará como fiado</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Nombre del cliente *</label>
                    <input
                      type="text"
                      value={fiadoCustomerName}
                      onChange={(e) => setFiadoCustomerName(e.target.value)}
                      className="w-full px-4 py-3 text-lg border-2 border-gray-200 dark:border-neutral-700 rounded-xl focus:border-amber-500"
                      placeholder="¿A quién se le fía?"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Abono (opcional)</label>
                    <input
                      type="number"
                      value={fiadoAbono}
                      onChange={(e) => setFiadoAbono(e.target.value)}
                      className="w-full px-4 py-3 text-lg font-bold text-center border-2 border-gray-200 dark:border-neutral-700 rounded-xl focus:border-green-500"
                      placeholder="0"
                    />
                  </div>
                  <div className="bg-amber-100 dark:bg-amber-900 rounded-lg p-4">
                    <div className="flex justify-between text-lg">
                      <span className="font-medium">Queda debiendo:</span>
                      <span className="text-amber-700 dark:text-amber-400 font-bold">
                        {formatCurrency(Math.max(0, totalToPay - (parseFloat(fiadoAbono) || 0)))}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === 'mixed' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Monto en Transferencia</label>
                    <input
                      type="number"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      className="w-full px-4 py-3 text-lg font-bold text-center border-2 border-gray-200 dark:border-neutral-700 rounded-xl focus:border-blue-500"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Efectivo recibido</label>
                    <input
                      type="number"
                      value={cashAmountMixed}
                      onChange={(e) => setCashAmountMixed(e.target.value)}
                      className="w-full px-4 py-3 text-lg font-bold text-center border-2 border-gray-200 dark:border-neutral-700 rounded-xl focus:border-green-500"
                      placeholder="0"
                    />
                  </div>
                  {(parseFloat(transferAmount) > 0 || parseFloat(cashAmountMixed) > 0) && (
                    <div className="bg-gray-50 dark:bg-neutral-950 rounded-lg p-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Transferencia:</span>
                        <span className="text-blue-600 dark:text-blue-400 font-medium">{formatCurrency(parseFloat(transferAmount) || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Efectivo:</span>
                        <span className="text-green-600 dark:text-green-400 font-medium">{formatCurrency(parseFloat(cashAmountMixed) || 0)}</span>
                      </div>
                      {getChange() > 0 && (
                        <div className="flex justify-between text-sm pt-2 border-t border-gray-200 dark:border-neutral-700 mt-2">
                          <span>Cambio:</span>
                          <span className="text-amber-600 dark:text-amber-400 font-bold">{formatCurrency(getChange())}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-950">
          {step === 'products' ? (
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-gray-600 dark:text-neutral-300 text-sm">Total</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-neutral-100">{formatCurrency(total)}</p>
              </div>
              <div className="flex gap-3 flex-wrap">
                <Button variant="outline" onClick={onClose} className="flex-1 min-w-[100px]">
                  Cancelar
                </Button>
                {existingTab && (
                  <Button
                    variant="outline"
                    onClick={handleDiscard}
                    className="flex-1 min-w-[100px] border-red-300 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    Descartar cuenta
                  </Button>
                )}
                {existingTab && (existingTab.items.length > 0 || existingTab.combos.length > 0) && (
                  <Button
                    variant="outline"
                    onClick={() => setShowPartialModal(true)}
                    className="flex-1 min-w-[100px] border-green-500 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950"
                  >
                    Pago Parcial
                  </Button>
                )}
                <Button variant="secondary" onClick={handleSaveOpen} disabled={items.length === 0 && comboItems.length === 0 && !existingTab} className="flex-1 min-w-[100px]">
                  Guardar (Cuenta Abierta)
                </Button>
                <Button
                  onClick={handleGoToPayment}
                  disabled={(items.length === 0 && comboItems.length === 0 && !existingTab) || total === 0}
                  className="flex-1 min-w-[100px] bg-amber-500 hover:bg-amber-600 focus:ring-amber-500"
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
                onClick={handleConfirmPayment}
                disabled={!canConfirmPayment()}
                className="flex-1 bg-amber-500 hover:bg-amber-600 focus:ring-amber-500"
              >
                Confirmar Pago
              </Button>
            </div>
          )}
        </div>
      </div>

      {showPartialModal && existingTab && (
        <PartialPaymentModal tab={existingTab} onClose={() => setShowPartialModal(false)} />
      )}

      {editingCombo && (
        <ComboModal combo={editingCombo} products={products} onClose={() => setEditingCombo(null)} onAdd={handleAddComboFromModal} />
      )}

      {showMicheladaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold mb-2 text-center text-gray-900 dark:text-neutral-100">{showMicheladaModal.product.name}</h2>
            <p className="text-center text-gray-600 dark:text-neutral-300 mb-6">¿Cómo la quiere el cliente?</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleMicheladaChoice(false)}
                className="p-4 rounded-xl border-2 border-gray-200 dark:border-neutral-700 hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950 transition-all"
              >
                <div className="text-3xl mb-2">🍺</div>
                <p className="font-medium text-gray-900 dark:text-neutral-100">Normal</p>
                <p className="text-sm text-gray-500 dark:text-neutral-400">{formatCurrency(showMicheladaModal.product.sale_price)}</p>
              </button>
              <button
                onClick={() => handleMicheladaChoice(true)}
                className="p-4 rounded-xl border-2 border-amber-500 bg-amber-50 dark:bg-amber-950 hover:bg-amber-100 dark:hover:bg-amber-900 transition-all"
              >
                <div className="text-3xl mb-2">🌶️</div>
                <p className="font-medium text-amber-700 dark:text-amber-400">Michelada</p>
                <p className="text-sm text-amber-600 dark:text-amber-400">{formatCurrency(showMicheladaModal.product.sale_price + MICHELADA_EXTRA)}</p>
              </button>
            </div>
            <button
              onClick={() => setShowMicheladaModal(null)}
              className="w-full mt-4 py-2 text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {showBombaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold mb-2 text-center text-gray-900 dark:text-neutral-100">{showBombaModal.product.name}</h2>
            <p className="text-center text-gray-600 dark:text-neutral-300 mb-6">¿Cómo lo quiere el cliente?</p>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleBombaChoice(false, false)}
                className="p-4 rounded-xl border-2 border-gray-200 dark:border-neutral-700 hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-950 transition-all"
              >
                <div className="text-3xl mb-2">💧</div>
                <p className="font-medium text-gray-900 dark:text-neutral-100">Normal</p>
                <p className="text-sm text-gray-500 dark:text-neutral-400">{formatCurrency(showBombaModal.product.sale_price)}</p>
              </button>
              <button
                onClick={() => handleBombaChoice(true, false)}
                className="p-4 rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950 hover:bg-amber-100 dark:hover:bg-amber-900 transition-all"
              >
                <div className="text-3xl mb-2">🌶️</div>
                <p className="font-medium text-amber-700 dark:text-amber-400">Michelada</p>
                <p className="text-sm text-amber-600 dark:text-amber-400">{formatCurrency(showBombaModal.product.sale_price + MICHELADA_EXTRA)}</p>
              </button>
              <button
                onClick={() => handleBombaChoice(false, true)}
                className="p-4 rounded-xl border-2 border-blue-500 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 transition-all"
              >
                <div className="text-3xl mb-2">💣</div>
                <p className="font-medium text-blue-700 dark:text-blue-400">Con Bomba</p>
                <p className="text-sm text-blue-600 dark:text-blue-400">{formatCurrency(showBombaModal.product.sale_price + getBombaExtra(showBombaModal.product))}</p>
              </button>
            </div>
            <button
              onClick={() => setShowBombaModal(null)}
              className="w-full mt-4 py-2 text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ComboModal({
  combo,
  products,
  onClose,
  onAdd,
}: {
  combo: DemoComboTemplate;
  products: DemoProduct[];
  onClose: () => void;
  onAdd: (cartCombo: DemoCartCombo) => void;
}) {
  const [finalPrice, setFinalPrice] = useState(combo.basePrice.toString());
  const [selectedProductIds, setSelectedProductIds] = useState<Record<number, string>>(
    Object.fromEntries(combo.items.map((_, idx) => [idx, combo.items[idx].productId]))
  );

  const beerProducts = products.filter((p) => p.category.includes('beer'));

  const handleSubmit = () => {
    const items: DemoLineItem[] = combo.items
      .map((templateItem, idx) => {
        const productId = selectedProductIds[idx] || templateItem.productId;
        const product = products.find((p) => p.id === productId);
        return product ? { product, quantity: templateItem.quantity } : null;
      })
      .filter((i): i is DemoLineItem => i !== null);

    onAdd({
      comboId: combo.id,
      comboName: combo.name,
      items,
      finalPrice: parseFloat(finalPrice) || combo.basePrice,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-neutral-100">{combo.name}</h2>
        {combo.description && <p className="text-sm text-gray-500 dark:text-neutral-400 mb-4">{combo.description}</p>}

        {combo.isPriceEditable && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Precio final</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 dark:text-neutral-400">$</span>
              <input
                type="number"
                value={finalPrice}
                onChange={(e) => setFinalPrice(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-lg font-bold"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">Precio base: {formatCurrency(combo.basePrice)}</p>
          </div>
        )}

        <div className="space-y-3 mb-4">
          <p className="text-sm font-medium text-gray-700 dark:text-neutral-300">Productos incluidos:</p>
          {combo.items.map((templateItem, index) => (
            <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-neutral-950 rounded-lg">
              <span className="text-sm font-medium w-8 text-center">{templateItem.quantity}x</span>
              {templateItem.isSwappable ? (
                <select
                  value={selectedProductIds[index] || templateItem.productId}
                  onChange={(e) => setSelectedProductIds((prev) => ({ ...prev, [index]: e.target.value }))}
                  className="flex-1 px-2 py-1 border border-gray-300 dark:border-neutral-600 rounded text-sm"
                >
                  {beerProducts.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              ) : (
                <span className="flex-1 text-sm">{products.find((p) => p.id === templateItem.productId)?.name}</span>
              )}
              {templateItem.isSwappable && <span className="text-xs text-blue-600 dark:text-blue-400">* intercambiable</span>}
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="flex-1 bg-amber-500 hover:bg-amber-600 focus:ring-amber-500">
            Agregar {formatCurrency(parseFloat(finalPrice) || combo.basePrice)}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PartialPaymentModal({ tab, onClose }: { tab: DemoTab; onClose: () => void }) {
  const addPartialPayment = useDemoStore((s) => s.addPartialPayment);
  const total = tabTotal(tab);
  const paid = tabPaid(tab);
  const remaining = Math.max(0, total - paid);

  const [amount, setAmount] = useState(remaining.toString());
  const [method, setMethod] = useState<PayMethod>('cash');
  const [cashReceived, setCashReceived] = useState(remaining.toString());
  const [transferAmount, setTransferAmount] = useState('');
  const [cashAmountMixed, setCashAmountMixed] = useState('');

  const amountNum = parseFloat(amount) || 0;

  const canConfirm = () => {
    if (amountNum <= 0) return false;
    if (method === 'transfer') return true;
    if (method === 'cash') return (parseFloat(cashReceived) || 0) >= amountNum;
    const paidNow = (parseFloat(transferAmount) || 0) + (parseFloat(cashAmountMixed) || 0);
    return paidNow >= amountNum;
  };

  const handleConfirm = () => {
    if (method === 'cash') {
      addPartialPayment(tab.id, amountNum, 'cash', amountNum, 0);
    } else if (method === 'transfer') {
      addPartialPayment(tab.id, amountNum, 'transfer', 0, amountNum);
    } else {
      addPartialPayment(tab.id, amountNum, 'mixed', parseFloat(cashAmountMixed) || 0, parseFloat(transferAmount) || 0);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-neutral-100">
          Pago Parcial — Mesa {tab.tableNumber}
        </h2>
        <p className="text-sm text-gray-500 dark:text-neutral-400">
          Total: {formatCurrency(total)} · Pagado: {formatCurrency(paid)} · Restante:{' '}
          <span className="font-medium text-amber-600 dark:text-amber-400">{formatCurrency(remaining)}</span>
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Monto a cobrar</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              if (method === 'cash') setCashReceived(e.target.value);
            }}
            className="w-full px-4 py-3 text-xl font-bold text-center border-2 border-gray-200 dark:border-neutral-700 rounded-xl focus:border-green-500 outline-none"
            placeholder="0"
            autoFocus
          />
          <button
            onClick={() => {
              setAmount(remaining.toString());
              if (method === 'cash') setCashReceived(remaining.toString());
            }}
            className="mt-2 w-full text-xs py-1.5 border border-green-300 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-50 dark:hover:bg-green-950"
          >
            Cobrar todo ({formatCurrency(remaining)})
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Método de pago</label>
          <div className="grid grid-cols-3 gap-2">
            {(['cash', 'transfer', 'mixed'] as PayMethod[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMethod(m);
                  if (m === 'cash') setCashReceived(amount);
                }}
                className={`py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                  method === m ? 'border-green-500 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400' : 'border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-300'
                }`}
              >
                {m === 'cash' ? '💵 Efectivo' : m === 'transfer' ? '📱 Transfer.' : '💳 Mixto'}
              </button>
            ))}
          </div>
        </div>

        {method === 'cash' && (
          <div>
            <label className="block text-xs text-gray-600 dark:text-neutral-300 mb-1">Efectivo recibido</label>
            <input
              type="number"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-center"
              placeholder="0"
            />
          </div>
        )}

        {method === 'mixed' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 dark:text-neutral-300 mb-1">Efectivo</label>
              <input
                type="number"
                value={cashAmountMixed}
                onChange={(e) => setCashAmountMixed(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-center"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-neutral-300 mb-1">Transferencia</label>
              <input
                type="number"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-center"
                placeholder="0"
              />
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm()} className="flex-1 bg-green-600 hover:bg-green-700">
            Confirmar pago
          </Button>
        </div>
      </div>
    </div>
  );
}
