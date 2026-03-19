'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { CurrentStock, Supplier } from '@/types/database';

type TabType = 'stock' | 'history';

interface InventoryEntry {
  id: string;
  product_id: string;
  supplier_id: string;
  quantity: number;
  initial_quantity: number;
  purchase_price: number;
  batch_date: string;
  created_at: string;
  products: { id: string; name: string; sale_price: number };
  suppliers: { id: string; name: string };
  employees: { name: string } | null;
}

interface InventoryCount {
  id: string;
  product_id: string;
  employee_id: string;
  system_stock: number;
  real_stock: number;
  difference: number;
  notes: string | null;
  created_at: string;
  employee_name: string;
}

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<TabType>('stock');
  const [stock, setStock] = useState<CurrentStock[]>([]);
  const [history, setHistory] = useState<InventoryEntry[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryCounts, setInventoryCounts] = useState<InventoryCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showCountModal, setShowCountModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<InventoryEntry | null>(null);
  const [selectedStockItem, setSelectedStockItem] = useState<CurrentStock | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [stockResponse, suppliersResponse, historyResponse, countsResponse] = await Promise.all([
        supabase.from('v_current_stock').select('*').order('product_name'),
        supabase.from('suppliers').select('*').eq('active', true),
        fetch('/api/inventory?limit=200').then(r => r.json()),
        fetch('/api/inventory/counts?latest=true').then(r => r.json()),
      ]);

      setStock((stockResponse.data as CurrentStock[]) || []);
      setSuppliers((suppliersResponse.data as Supplier[]) || []);
      setHistory(historyResponse.inventory || []);
      setInventoryCounts(countsResponse.counts || []);
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Función para obtener el último conteo de un producto
  const getLatestCount = (productId: string): InventoryCount | undefined => {
    return inventoryCounts.find(c => c.product_id === productId);
  };

  const handleCount = (item: CurrentStock) => {
    setSelectedStockItem(item);
    setShowCountModal(true);
  };

  const handleAdjust = (entry: InventoryEntry) => {
    setSelectedEntry(entry);
    setShowAdjustModal(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Calculate summary stats
  const totalProducts = stock.length;
  const lowStockCount = stock.filter(s => s.is_low_stock).length;
  const totalUnits = stock.reduce((sum, s) => sum + s.current_stock, 0);
  const totalValue = stock.reduce((sum, s) => sum + (s.current_stock * s.sale_price), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
        <Button onClick={() => setShowAddModal(true)}>+ Agregar Stock</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Productos</p>
          <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Unidades Total</p>
          <p className="text-2xl font-bold text-gray-900">{totalUnits}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Valor Inventario</p>
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(totalValue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Stock Bajo</p>
          <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {lowStockCount}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('stock')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'stock'
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Stock Actual
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Historial de Compras
        </button>
      </div>

      {/* Stock Table */}
      {activeTab === 'stock' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    Producto
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                    Stock Sistema
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                    Stock Real
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                    Diferencia
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    Último Conteo
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stock.map((item) => {
                  const lastCount = getLatestCount(item.product_id);
                  const difference = lastCount ? lastCount.difference : null;

                  return (
                    <tr key={item.product_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium text-gray-900">
                            {item.product_name}
                          </span>
                          <p className="text-xs text-gray-500 capitalize">
                            {item.category.replace('_', ' ')}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-bold ${
                            item.is_low_stock ? 'text-red-600' : 'text-gray-900'
                          }`}
                        >
                          {item.current_stock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {lastCount ? (
                          <span className="font-bold text-blue-600">
                            {lastCount.real_stock}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {difference !== null ? (
                          <span
                            className={`font-bold ${
                              difference > 0
                                ? 'text-green-600'
                                : difference < 0
                                ? 'text-red-600'
                                : 'text-gray-600'
                            }`}
                          >
                            {difference > 0 ? '+' : ''}{difference}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {lastCount ? (
                          <div className="text-xs">
                            <p className="font-medium text-gray-700">{lastCount.employee_name}</p>
                            <p className="text-gray-500">
                              {new Date(lastCount.created_at).toLocaleDateString('es-CO', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                            {lastCount.notes && (
                              <p className="text-amber-600 italic mt-1">{lastCount.notes}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Sin conteo</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.is_low_stock ? (
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                            Bajo
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            OK
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleCount(item)}
                          className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium"
                        >
                          Contar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {stock.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No hay productos en el inventario
            </div>
          )}
        </div>
      )}

      {/* History Table */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    Producto
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    Proveedor
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                    Cant. Inicial
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                    Cant. Actual
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                    Precio Compra
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                    Total
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {formatDate(entry.batch_date)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(entry.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">
                        {entry.products?.name || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">
                        {entry.suppliers?.name || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {entry.initial_quantity}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-bold ${entry.quantity === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
                        {entry.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {formatCurrency(entry.purchase_price)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(entry.purchase_price * entry.initial_quantity)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleAdjust(entry)}
                        className="px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded hover:bg-amber-100"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {history.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No hay historial de compras
            </div>
          )}
        </div>
      )}

      {/* Add Stock Modal */}
      {showAddModal && (
        <AddStockModal
          suppliers={suppliers}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadData();
          }}
        />
      )}

      {/* Edit Inventory Modal */}
      {showAdjustModal && selectedEntry && (
        <EditInventoryModal
          entry={selectedEntry}
          suppliers={suppliers}
          onClose={() => {
            setShowAdjustModal(false);
            setSelectedEntry(null);
          }}
          onSuccess={() => {
            setShowAdjustModal(false);
            setSelectedEntry(null);
            loadData();
          }}
        />
      )}

      {/* Count Inventory Modal */}
      {showCountModal && selectedStockItem && (
        <CountInventoryModal
          item={selectedStockItem}
          onClose={() => {
            setShowCountModal(false);
            setSelectedStockItem(null);
          }}
          onSuccess={() => {
            setShowCountModal(false);
            setSelectedStockItem(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

interface AddStockModalProps {
  suppliers: Supplier[];
  onClose: () => void;
  onSuccess: () => void;
}

function AddStockModal({ suppliers, onClose, onSuccess }: AddStockModalProps) {
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [formData, setFormData] = useState({
    product_id: '',
    supplier_id: '',
    packages: '1',
    units_per_package: '',
    price_per_package: '',
    batch_date: new Date().toISOString().split('T')[0],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name')
      .eq('active', true)
      .order('name');
    setProducts(data || []);
  };

  // Calcular totales
  const packages = parseInt(formData.packages) || 0;
  const unitsPerPackage = parseInt(formData.units_per_package) || 0;
  const pricePerPackage = parseFloat(formData.price_per_package) || 0;

  const totalUnits = packages * unitsPerPackage;
  const unitPrice = unitsPerPackage > 0 ? pricePerPackage / unitsPerPackage : 0;
  const totalCost = packages * pricePerPackage;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (totalUnits <= 0) {
      setError('Debe ingresar cantidad válida');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: formData.product_id,
          supplier_id: formData.supplier_id,
          quantity: totalUnits,
          purchase_price: unitPrice,
          batch_date: formData.batch_date,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Error al agregar stock');
        return;
      }

      onSuccess();
    } catch (err) {
      console.error('Error adding stock:', err);
      setError('Error al agregar stock');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-6">Agregar Stock</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Producto *
            </label>
            <select
              value={formData.product_id}
              onChange={(e) =>
                setFormData({ ...formData, product_id: e.target.value })
              }
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="">Seleccionar...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Proveedor *
            </label>
            <select
              value={formData.supplier_id}
              onChange={(e) =>
                setFormData({ ...formData, supplier_id: e.target.value })
              }
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="">Seleccionar...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sección de paquetes */}
          <div className="bg-amber-50 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-amber-800">Información del paquete</p>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Paquetes
                </label>
                <input
                  type="number"
                  value={formData.packages}
                  onChange={(e) =>
                    setFormData({ ...formData, packages: e.target.value })
                  }
                  required
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 text-center"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Uds/Paquete
                </label>
                <input
                  type="number"
                  value={formData.units_per_package}
                  onChange={(e) =>
                    setFormData({ ...formData, units_per_package: e.target.value })
                  }
                  required
                  min="1"
                  placeholder="24"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 text-center"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  $/Paquete
                </label>
                <input
                  type="number"
                  value={formData.price_per_package}
                  onChange={(e) =>
                    setFormData({ ...formData, price_per_package: e.target.value })
                  }
                  required
                  min="0"
                  placeholder="68000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 text-center"
                />
              </div>
            </div>

            {/* Resumen calculado */}
            {totalUnits > 0 && (
              <div className="bg-white rounded-lg p-3 mt-3 border border-amber-200">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-gray-500">Total Unidades</p>
                    <p className="text-lg font-bold text-gray-900">{totalUnits}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Precio/Unidad</p>
                    <p className="text-lg font-bold text-amber-600">{formatCurrency(unitPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Compra</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(totalCost)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de Compra
            </label>
            <input
              type="date"
              value={formData.batch_date}
              onChange={(e) =>
                setFormData({ ...formData, batch_date: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface EditInventoryModalProps {
  entry: InventoryEntry;
  suppliers: Supplier[];
  onClose: () => void;
  onSuccess: () => void;
}

function EditInventoryModal({ entry, suppliers, onClose, onSuccess }: EditInventoryModalProps) {
  const [formData, setFormData] = useState({
    quantity: entry.quantity.toString(),
    initial_quantity: entry.initial_quantity.toString(),
    purchase_price: entry.purchase_price.toString(),
    supplier_id: entry.supplier_id || '',
    batch_date: entry.batch_date,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Si el proveedor de la entrada no está en la lista (fue desactivado), agregarlo
  const availableSuppliers = suppliers.some(s => s.id === entry.supplier_id)
    ? suppliers
    : entry.suppliers
      ? [...suppliers, { id: entry.supplier_id, name: `${entry.suppliers.name} (inactivo)`, active: false } as Supplier]
      : suppliers;

  // Calcular precio total basado en cantidad inicial y precio unitario
  const purchasePrice = parseFloat(formData.purchase_price) || 0;
  const initialQty = parseInt(formData.initial_quantity) || 0;
  const totalCost = purchasePrice * initialQty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Validar que haya proveedor seleccionado
      if (!formData.supplier_id) {
        setError('Debe seleccionar un proveedor');
        setIsLoading(false);
        return;
      }

      const response = await fetch(`/api/inventory/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: parseInt(formData.quantity),
          initial_quantity: parseInt(formData.initial_quantity),
          purchase_price: parseFloat(formData.purchase_price),
          supplier_id: formData.supplier_id,
          batch_date: formData.batch_date,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Error al editar inventario');
        return;
      }

      onSuccess();
    } catch (err) {
      console.error('Error editing inventory:', err);
      setError('Error al editar inventario');
    } finally {
      setIsLoading(false);
    }
  };

  const qtyDiff = parseInt(formData.quantity || '0') - entry.quantity;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 my-8">
        <h2 className="text-xl font-bold mb-2">Editar Entrada de Inventario</h2>
        <p className="text-gray-600 mb-4">{entry.products?.name}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Proveedor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Proveedor *
            </label>
            <select
              value={formData.supplier_id}
              onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="">Seleccionar proveedor...</option>
              {availableSuppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Cantidades */}
          <div className="bg-amber-50 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-amber-800">Cantidades</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Cantidad Inicial
                </label>
                <input
                  type="number"
                  value={formData.initial_quantity}
                  onChange={(e) => setFormData({ ...formData, initial_quantity: e.target.value })}
                  required
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center"
                />
                <p className="text-xs text-gray-500 mt-1">Original: {entry.initial_quantity}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Cantidad Actual
                </label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  required
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center"
                />
                {qtyDiff !== 0 && (
                  <p className={`text-xs mt-1 text-center font-medium ${qtyDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {qtyDiff > 0 ? '+' : ''}{qtyDiff} uds
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Precio */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Precio de Compra</p>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Precio por Unidad
              </label>
              <input
                type="number"
                value={formData.purchase_price}
                onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                required
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                Original: {formatCurrency(entry.purchase_price)}
              </p>
            </div>

            {totalCost > 0 && (
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total compra:</span>
                  <span className="text-lg font-bold text-gray-900">{formatCurrency(totalCost)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de Compra
            </label>
            <input
              type="date"
              value={formData.batch_date}
              onChange={(e) => setFormData({ ...formData, batch_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface CountInventoryModalProps {
  item: CurrentStock;
  onClose: () => void;
  onSuccess: () => void;
}

function CountInventoryModal({ item, onClose, onSuccess }: CountInventoryModalProps) {
  const [realStock, setRealStock] = useState(item.current_stock.toString());
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const systemStock = item.current_stock;
  const realStockNum = parseInt(realStock) || 0;
  const difference = realStockNum - systemStock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/inventory/counts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: item.product_id,
          system_stock: systemStock,
          real_stock: realStockNum,
          notes: notes.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Error al registrar conteo');
        return;
      }

      onSuccess();
    } catch (err) {
      console.error('Error creating count:', err);
      setError('Error al registrar conteo');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-2">Registrar Conteo</h2>
        <p className="text-gray-600 mb-4">{item.product_name}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Comparación de stocks */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Stock Sistema</p>
                <p className="text-2xl font-bold text-gray-900">{systemStock}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Stock Real</p>
                <input
                  type="number"
                  value={realStock}
                  onChange={(e) => setRealStock(e.target.value)}
                  min="0"
                  required
                  className="w-full px-2 py-1 text-2xl font-bold text-center border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Diferencia</p>
                <p
                  className={`text-2xl font-bold ${
                    difference > 0
                      ? 'text-green-600'
                      : difference < 0
                      ? 'text-red-600'
                      : 'text-gray-600'
                  }`}
                >
                  {difference > 0 ? '+' : ''}{difference}
                </p>
              </div>
            </div>

            {difference !== 0 && (
              <div className={`mt-3 p-2 rounded-lg text-sm text-center ${
                difference > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {difference > 0
                  ? `Hay ${difference} unidades de más (sobrante)`
                  : `Faltan ${Math.abs(difference)} unidades (faltante)`
                }
              </div>
            )}
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Encontré 2 rotas, se devolvieron al proveedor..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={2}
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? 'Guardando...' : 'Registrar Conteo'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
