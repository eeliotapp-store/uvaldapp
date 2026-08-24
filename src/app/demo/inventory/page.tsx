'use client';

import { useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useDemoStore, type DemoInventoryBatch, type DemoProduct, type DemoSupplier } from '@/stores/demo-store';

type TabType = 'stock' | 'history';

export default function DemoInventoryPage() {
  const { products, suppliers, inventoryBatches, setProductStock, setProductPrice } = useDemoStore();

  const [activeTab, setActiveTab] = useState<TabType>('stock');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCountModal, setShowCountModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<DemoProduct | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<DemoInventoryBatch | null>(null);

  const [editingCell, setEditingCell] = useState<{ productId: string; field: 'stock' | 'price' } | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEditing = (productId: string, field: 'stock' | 'price', currentValue: number) => {
    setEditingCell({ productId, field });
    setEditValue(currentValue.toString());
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveEdit = (productId: string, field: 'stock' | 'price') => {
    const value = parseFloat(editValue) || 0;
    if (field === 'stock') {
      setProductStock(productId, Math.floor(value));
    } else {
      setProductPrice(productId, value);
    }
    cancelEditing();
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, productId: string, field: 'stock' | 'price') => {
    if (e.key === 'Enter') saveEdit(productId, field);
    else if (e.key === 'Escape') cancelEditing();
  };

  const handleCount = (product: DemoProduct) => {
    setSelectedProduct(product);
    setShowCountModal(true);
  };

  const handleAdjust = (entry: DemoInventoryBatch) => {
    setSelectedEntry(entry);
    setShowAdjustModal(true);
  };

  const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);
  const totalValue = products.reduce((sum, p) => sum + p.stock * p.sale_price, 0);
  const lowStockCount = products.filter((p) => p.stock <= 5).length;

  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name || 'N/A';
  const productName = (id: string) => products.find((p) => p.id === id)?.name || 'N/A';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Inventario — Práctica</h1>
        <Button onClick={() => setShowAddModal(true)}>+ Agregar Stock</Button>
      </div>

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

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('stock')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'stock'
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-700'
          }`}
        >
          Stock Actual
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-700'
          }`}
        >
          Historial de Compras
        </button>
      </div>

      {activeTab === 'stock' && (
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-neutral-950 border-b border-gray-200 dark:border-neutral-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-neutral-300">Producto</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 dark:text-neutral-300">Stock</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-neutral-300">Precio</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 dark:text-neutral-300">Estado</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 dark:text-neutral-300">Acción</th>
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
                        {editingCell?.productId === p.id && editingCell.field === 'stock' ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveEdit(p.id, 'stock')}
                            onKeyDown={(e) => handleEditKeyDown(e, p.id, 'stock')}
                            className="w-20 px-2 py-1 text-center text-lg font-bold border-2 border-amber-400 rounded focus:outline-none focus:border-amber-500"
                            autoFocus
                            min="0"
                          />
                        ) : (
                          <span
                            onClick={() => startEditing(p.id, 'stock', p.stock)}
                            className={`text-lg font-bold cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900 px-2 py-1 rounded ${
                              lowStock ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-neutral-100'
                            }`}
                            title="Clic para editar"
                          >
                            {p.stock}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editingCell?.productId === p.id && editingCell.field === 'price' ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveEdit(p.id, 'price')}
                            onKeyDown={(e) => handleEditKeyDown(e, p.id, 'price')}
                            className="w-24 px-2 py-1 text-right border-2 border-amber-400 rounded focus:outline-none focus:border-amber-500"
                            autoFocus
                            min="0"
                            step="100"
                          />
                        ) : (
                          <span
                            onClick={() => startEditing(p.id, 'price', p.sale_price)}
                            className="cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900 px-2 py-1 rounded text-gray-600 dark:text-neutral-300"
                            title="Clic para editar"
                          >
                            {formatCurrency(p.sale_price)}
                          </span>
                        )}
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
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleCount(p)}
                          className="px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900 font-medium"
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
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-neutral-950 border-b border-gray-200 dark:border-neutral-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-neutral-300">Fecha</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-neutral-300">Producto</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-neutral-300">Proveedor</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 dark:text-neutral-300">Cant. Inicial</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 dark:text-neutral-300">Cant. Actual</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-neutral-300">Precio Compra</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-neutral-300">Total</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 dark:text-neutral-300">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-700">
                {inventoryBatches.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-neutral-950">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-neutral-100">{entry.batchDate}</p>
                      <p className="text-xs text-gray-500 dark:text-neutral-400">
                        {new Date(entry.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900 dark:text-neutral-100">{productName(entry.productId)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600 dark:text-neutral-300">{supplierName(entry.supplierId)}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-neutral-300">{entry.initialQuantity}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-bold ${entry.quantity === 0 ? 'text-gray-500 dark:text-neutral-400' : 'text-gray-900 dark:text-neutral-100'}`}>
                        {entry.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-neutral-100">{formatCurrency(entry.purchasePrice)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-neutral-100">
                      {formatCurrency(entry.purchasePrice * entry.initialQuantity)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleAdjust(entry)}
                        className="px-2 py-1 text-xs bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 rounded hover:bg-amber-100 dark:hover:bg-amber-900"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {inventoryBatches.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-neutral-400">No hay historial de compras</div>
          )}
        </div>
      )}

      {showAddModal && (
        <AddStockModal products={products} suppliers={suppliers} onClose={() => setShowAddModal(false)} />
      )}

      {showAdjustModal && selectedEntry && (
        <EditInventoryModal
          entry={selectedEntry}
          suppliers={suppliers}
          onClose={() => {
            setShowAdjustModal(false);
            setSelectedEntry(null);
          }}
        />
      )}

      {showCountModal && selectedProduct && (
        <CountInventoryModal
          product={selectedProduct}
          onClose={() => {
            setShowCountModal(false);
            setSelectedProduct(null);
          }}
        />
      )}
    </div>
  );
}

function AddStockModal({
  products,
  suppliers,
  onClose,
}: {
  products: DemoProduct[];
  suppliers: DemoSupplier[];
  onClose: () => void;
}) {
  const addInventoryBatch = useDemoStore((s) => s.addInventoryBatch);
  const [formData, setFormData] = useState({
    product_id: '',
    supplier_id: '',
    packages: '1',
    units_per_package: '',
    price_per_package: '',
    batch_date: new Date().toISOString().split('T')[0],
  });
  const [error, setError] = useState('');

  const packages = parseInt(formData.packages) || 0;
  const unitsPerPackage = parseInt(formData.units_per_package) || 0;
  const pricePerPackage = parseFloat(formData.price_per_package) || 0;

  const totalUnits = packages * unitsPerPackage;
  const unitPrice = unitsPerPackage > 0 ? pricePerPackage / unitsPerPackage : 0;
  const totalCost = packages * pricePerPackage;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.product_id || !formData.supplier_id) {
      setError('Debe seleccionar producto y proveedor');
      return;
    }
    if (totalUnits <= 0) {
      setError('Debe ingresar cantidad válida');
      return;
    }

    addInventoryBatch(formData.product_id, formData.supplier_id, totalUnits, totalUnits, unitPrice, formData.batch_date);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-neutral-100">Agregar Stock — Práctica</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Producto *</label>
            <select
              value={formData.product_id}
              onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-amber-500 focus:border-amber-500 dark:bg-neutral-900 dark:text-neutral-100"
            >
              <option value="">Seleccionar...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Proveedor *</label>
            <select
              value={formData.supplier_id}
              onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-amber-500 focus:border-amber-500 dark:bg-neutral-900 dark:text-neutral-100"
            >
              <option value="">Seleccionar...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Información del paquete</p>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-neutral-300 mb-1">Paquetes</label>
                <input
                  type="number"
                  value={formData.packages}
                  onChange={(e) => setFormData({ ...formData, packages: e.target.value })}
                  required
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-center dark:bg-neutral-900 dark:text-neutral-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-neutral-300 mb-1">Uds/Paquete</label>
                <input
                  type="number"
                  value={formData.units_per_package}
                  onChange={(e) => setFormData({ ...formData, units_per_package: e.target.value })}
                  required
                  min="1"
                  placeholder="24"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-center dark:bg-neutral-900 dark:text-neutral-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-neutral-300 mb-1">$/Paquete</label>
                <input
                  type="number"
                  value={formData.price_per_package}
                  onChange={(e) => setFormData({ ...formData, price_per_package: e.target.value })}
                  required
                  min="0"
                  placeholder="68000"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-center dark:bg-neutral-900 dark:text-neutral-100"
                />
              </div>
            </div>

            {totalUnits > 0 && (
              <div className="bg-white dark:bg-neutral-800 rounded-lg p-3 mt-3 border border-amber-200 dark:border-amber-800">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-neutral-400">Total Unidades</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-neutral-100">{totalUnits}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-neutral-400">Precio/Unidad</p>
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{formatCurrency(unitPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-neutral-400">Total Compra</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-neutral-100">{formatCurrency(totalCost)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Fecha de Compra</label>
            <input
              type="date"
              value={formData.batch_date}
              onChange={(e) => setFormData({ ...formData, batch_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:ring-amber-500 focus:border-amber-500 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>

          {error && (
            <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950 p-3 rounded-lg">{error}</div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" className="flex-1">Guardar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditInventoryModal({
  entry,
  suppliers,
  onClose,
}: {
  entry: DemoInventoryBatch;
  suppliers: DemoSupplier[];
  onClose: () => void;
}) {
  const editInventoryBatch = useDemoStore((s) => s.editInventoryBatch);
  const [formData, setFormData] = useState({
    quantity: entry.quantity.toString(),
    initial_quantity: entry.initialQuantity.toString(),
    purchase_price: entry.purchasePrice.toString(),
    supplier_id: entry.supplierId,
    batch_date: entry.batchDate,
  });
  const [error, setError] = useState('');

  const purchasePrice = parseFloat(formData.purchase_price) || 0;
  const initialQty = parseInt(formData.initial_quantity) || 0;
  const totalCost = purchasePrice * initialQty;
  const qtyDiff = parseInt(formData.quantity || '0') - entry.quantity;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.supplier_id) {
      setError('Debe seleccionar un proveedor');
      return;
    }

    editInventoryBatch(entry.id, {
      quantity: parseInt(formData.quantity) || 0,
      initialQuantity: parseInt(formData.initial_quantity) || 0,
      purchasePrice,
      supplierId: formData.supplier_id,
      batchDate: formData.batch_date,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl w-full max-w-md p-6 my-8">
        <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-neutral-100">Editar Entrada de Inventario</h2>
        <p className="text-gray-600 dark:text-neutral-300 mb-4">
          {useDemoStore.getState().products.find((p) => p.id === entry.productId)?.name}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Proveedor *</label>
            <select
              value={formData.supplier_id}
              onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg dark:bg-neutral-900 dark:text-neutral-100"
            >
              <option value="">Seleccionar proveedor...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Cantidades</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-neutral-300 mb-1">Cantidad Inicial</label>
                <input
                  type="number"
                  value={formData.initial_quantity}
                  onChange={(e) => setFormData({ ...formData, initial_quantity: e.target.value })}
                  required
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-center dark:bg-neutral-900 dark:text-neutral-100"
                />
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">Original: {entry.initialQuantity}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-neutral-300 mb-1">Cantidad Actual</label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  required
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-center dark:bg-neutral-900 dark:text-neutral-100"
                />
                {qtyDiff !== 0 && (
                  <p className={`text-xs mt-1 text-center font-medium ${qtyDiff > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {qtyDiff > 0 ? '+' : ''}{qtyDiff} uds
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-neutral-950 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700 dark:text-neutral-300">Precio de Compra</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-neutral-300 mb-1">Precio por Unidad</label>
              <input
                type="number"
                value={formData.purchase_price}
                onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                required
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg dark:bg-neutral-900 dark:text-neutral-100"
              />
              <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">Original: {formatCurrency(entry.purchasePrice)}</p>
            </div>

            {totalCost > 0 && (
              <div className="bg-white dark:bg-neutral-800 rounded-lg p-3 border border-gray-200 dark:border-neutral-700">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-neutral-300">Total compra:</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-neutral-100">{formatCurrency(totalCost)}</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Fecha de Compra</label>
            <input
              type="date"
              value={formData.batch_date}
              onChange={(e) => setFormData({ ...formData, batch_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>

          {error && (
            <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950 p-3 rounded-lg">{error}</div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" className="flex-1">Guardar Cambios</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CountInventoryModal({
  product,
  onClose,
}: {
  product: DemoProduct;
  onClose: () => void;
}) {
  const addInventoryCount = useDemoStore((s) => s.addInventoryCount);
  const [realStock, setRealStock] = useState(product.stock.toString());
  const [notes, setNotes] = useState('');

  const systemStock = product.stock;
  const realStockNum = parseInt(realStock) || 0;
  const difference = realStockNum - systemStock;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addInventoryCount(product.id, realStockNum, notes.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-neutral-100">Registrar Conteo</h2>
        <p className="text-gray-600 dark:text-neutral-300 mb-4">{product.name}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-neutral-400 mb-1">Stock Sistema</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-neutral-100">{systemStock}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-neutral-400 mb-1">Stock Real</p>
                <input
                  type="number"
                  value={realStock}
                  onChange={(e) => setRealStock(e.target.value)}
                  min="0"
                  required
                  className="w-full px-2 py-1 text-2xl font-bold text-center border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:outline-none dark:bg-neutral-900 dark:text-neutral-100"
                />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-neutral-400 mb-1">Diferencia</p>
                <p className={`text-2xl font-bold ${difference > 0 ? 'text-green-600 dark:text-green-400' : difference < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-neutral-300'}`}>
                  {difference > 0 ? '+' : ''}{difference}
                </p>
              </div>
            </div>

            {difference !== 0 && (
              <div className={`mt-3 p-2 rounded-lg text-sm text-center ${difference > 0 ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-400'}`}>
                {difference > 0 ? `Hay ${difference} unidades de más (sobrante)` : `Faltan ${Math.abs(difference)} unidades (faltante)`}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Encontré 2 rotas, se devolvieron al proveedor..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg resize-none dark:bg-neutral-900 dark:text-neutral-100"
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" className="flex-1">Registrar Conteo</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
