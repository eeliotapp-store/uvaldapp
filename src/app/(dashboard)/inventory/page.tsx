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

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<TabType>('stock');
  const [stock, setStock] = useState<CurrentStock[]>([]);
  const [history, setHistory] = useState<InventoryEntry[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<InventoryEntry | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [stockResponse, suppliersResponse, historyResponse] = await Promise.all([
        supabase.from('v_current_stock').select('*').order('product_name'),
        supabase.from('suppliers').select('*').eq('active', true),
        fetch('/api/inventory?limit=200').then(r => r.json()),
      ]);

      setStock((stockResponse.data as CurrentStock[]) || []);
      setSuppliers((suppliersResponse.data as Supplier[]) || []);
      setHistory(historyResponse.inventory || []);
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setIsLoading(false);
    }
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
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    Categoria
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                    Stock
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                    Minimo
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                    Precio Venta
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stock.map((item) => (
                  <tr key={item.product_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">
                        {item.product_name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600 capitalize">
                        {item.category.replace('_', ' ')}
                      </span>
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
                    <td className="px-4 py-3 text-center text-gray-600">
                      {item.min_stock}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(item.sale_price)}
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
                  </tr>
                ))}
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
                      {entry.quantity > 0 && (
                        <button
                          onClick={() => handleAdjust(entry)}
                          className="px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded hover:bg-amber-100"
                        >
                          Ajustar
                        </button>
                      )}
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

      {/* Adjust Stock Modal */}
      {showAdjustModal && selectedEntry && (
        <AdjustStockModal
          entry={selectedEntry}
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
    quantity: '',
    purchase_price: '',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: formData.product_id,
          supplier_id: formData.supplier_id,
          quantity: formData.quantity,
          purchase_price: formData.purchase_price,
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cantidad *
              </label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({ ...formData, quantity: e.target.value })
                }
                required
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Precio Compra *
              </label>
              <input
                type="number"
                value={formData.purchase_price}
                onChange={(e) =>
                  setFormData({ ...formData, purchase_price: e.target.value })
                }
                required
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
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

interface AdjustStockModalProps {
  entry: InventoryEntry;
  onClose: () => void;
  onSuccess: () => void;
}

function AdjustStockModal({ entry, onClose, onSuccess }: AdjustStockModalProps) {
  const [newQuantity, setNewQuantity] = useState(entry.quantity.toString());
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventory_id: entry.id,
          new_quantity: newQuantity,
          reason: reason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Error al ajustar inventario');
        return;
      }

      onSuccess();
    } catch (err) {
      console.error('Error adjusting inventory:', err);
      setError('Error al ajustar inventario');
    } finally {
      setIsLoading(false);
    }
  };

  const diff = parseInt(newQuantity || '0') - entry.quantity;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-2">Ajustar Inventario</h2>
        <p className="text-sm text-gray-500 mb-6">
          {entry.products?.name} - {entry.suppliers?.name}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">Cantidad actual:</span>
              <span className="font-medium">{entry.quantity}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Cantidad inicial:</span>
              <span className="text-gray-600">{entry.initial_quantity}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nueva Cantidad *
            </label>
            <input
              type="number"
              value={newQuantity}
              onChange={(e) => setNewQuantity(e.target.value)}
              required
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
            />
            {diff !== 0 && (
              <p className={`text-sm mt-1 ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {diff > 0 ? '+' : ''}{diff} unidades
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Razon del ajuste
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Ej: Producto danado, conteo fisico, error de registro..."
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
              {isLoading ? 'Guardando...' : 'Guardar Ajuste'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
