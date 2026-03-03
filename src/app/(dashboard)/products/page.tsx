'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import type { Supplier, ProductCategory } from '@/types/database';

interface ProductWithDetails {
  id: string;
  name: string;
  category: ProductCategory;
  sale_price: number;
  min_stock: number;
  active: boolean;
  current_stock: number;
  product_suppliers: {
    id: string;
    supplier_id: string;
    purchase_price: number;
    is_preferred: boolean;
    suppliers: { id: string; name: string };
  }[];
}

const CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: 'beer_nacional', label: 'Cerveza Nacional' },
  { value: 'beer_importada', label: 'Cerveza Importada' },
  { value: 'beer_artesanal', label: 'Cerveza Artesanal' },
  { value: 'other', label: 'Otro' },
];

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithDetails | null>(null);
  const [stockProduct, setStockProduct] = useState<ProductWithDetails | null>(null);
  const [adjustProduct, setAdjustProduct] = useState<ProductWithDetails | null>(null);
  const [filter, setFilter] = useState({ category: '', showInactive: false });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productsRes, suppliersRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/suppliers'),
      ]);
      const productsData = await productsRes.json();
      const suppliersData = await suppliersRes.json();
      setProducts(productsData.products || []);
      setSuppliers(suppliersData.suppliers || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (product: ProductWithDetails) => {
    setEditingProduct(product);
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingProduct(null);
    setShowModal(true);
  };

  const handleSuccess = () => {
    setShowModal(false);
    setEditingProduct(null);
    loadData();
  };

  const handleToggleActive = async (product: ProductWithDetails) => {
    try {
      await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !product.active }),
      });
      loadData();
    } catch (error) {
      console.error('Error toggling product:', error);
    }
  };

  const handleAddStock = (product: ProductWithDetails) => {
    setStockProduct(product);
    setShowStockModal(true);
  };

  const handleStockSuccess = () => {
    setShowStockModal(false);
    setStockProduct(null);
    loadData();
  };

  const handleAdjustStock = (product: ProductWithDetails) => {
    setAdjustProduct(product);
    setShowAdjustModal(true);
  };

  const handleAdjustSuccess = () => {
    setShowAdjustModal(false);
    setAdjustProduct(null);
    loadData();
  };

  const filteredProducts = products.filter((p) => {
    if (!filter.showInactive && !p.active) return false;
    if (filter.category && p.category !== filter.category) return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
        <Button onClick={handleCreate}>+ Nuevo Producto</Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-4 mb-4">
        <select
          value={filter.category}
          onChange={(e) => setFilter({ ...filter, category: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">Todas las categorías</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={filter.showInactive}
            onChange={(e) => setFilter({ ...filter, showInactive: e.target.checked })}
          />
          <span className="text-sm text-gray-600">Mostrar inactivos</span>
        </label>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Producto</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Categoría</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Precio Venta</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Stock</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Proveedores</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProducts.map((product) => (
                <tr key={product.id} className={`hover:bg-gray-50 ${!product.active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{product.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">
                      {CATEGORIES.find((c) => c.value === product.category)?.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCurrency(product.sale_price)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleAdjustStock(product)}
                        className="w-6 h-6 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full text-sm font-bold flex items-center justify-center"
                        title="Ajustar stock"
                      >
                        −
                      </button>
                      <button
                        onClick={() => handleAdjustStock(product)}
                        className="px-2 py-1 hover:bg-gray-100 rounded cursor-pointer"
                        title="Click para ajustar"
                      >
                        <span className={`font-bold ${product.current_stock <= product.min_stock ? 'text-red-600' : 'text-gray-900'}`}>
                          {product.current_stock}
                        </span>
                        <span className="text-gray-400 text-sm"> / {product.min_stock}</span>
                      </button>
                      <button
                        onClick={() => handleAddStock(product)}
                        className="w-6 h-6 bg-amber-500 hover:bg-amber-600 text-white rounded-full text-sm font-bold flex items-center justify-center"
                        title="Agregar stock"
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {product.product_suppliers?.map((ps) => (
                        <span
                          key={ps.id}
                          className={`px-2 py-0.5 rounded text-xs ${ps.is_preferred ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}
                          title={`${formatCurrency(ps.purchase_price)}`}
                        >
                          {ps.suppliers?.name}
                        </span>
                      ))}
                      {(!product.product_suppliers || product.product_suppliers.length === 0) && (
                        <span className="text-gray-400 text-sm">Sin proveedores</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => handleEdit(product)}
                      className="text-amber-600 hover:text-amber-800 text-sm font-medium"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleToggleActive(product)}
                      className="text-gray-500 hover:text-gray-700 text-sm font-medium"
                    >
                      {product.active ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No hay productos
          </div>
        )}
      </div>

      {showModal && (
        <ProductModal
          product={editingProduct}
          suppliers={suppliers}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}

      {showStockModal && stockProduct && (
        <QuickStockModal
          product={stockProduct}
          suppliers={suppliers}
          onClose={() => {
            setShowStockModal(false);
            setStockProduct(null);
          }}
          onSuccess={handleStockSuccess}
        />
      )}

      {showAdjustModal && adjustProduct && (
        <AdjustProductStockModal
          product={adjustProduct}
          onClose={() => {
            setShowAdjustModal(false);
            setAdjustProduct(null);
          }}
          onSuccess={handleAdjustSuccess}
        />
      )}
    </div>
  );
}

interface ProductModalProps {
  product: ProductWithDetails | null;
  suppliers: Supplier[];
  onClose: () => void;
  onSuccess: () => void;
}

function ProductModal({ product, suppliers, onClose, onSuccess }: ProductModalProps) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    category: product?.category || 'beer_nacional',
    sale_price: product?.sale_price?.toString() || '',
    min_stock: product?.min_stock?.toString() || '10',
  });

  const [productSuppliers, setProductSuppliers] = useState<{
    supplier_id: string;
    purchase_price: string;
    is_preferred: boolean;
  }[]>(
    product?.product_suppliers?.map((ps) => ({
      supplier_id: ps.supplier_id,
      purchase_price: ps.purchase_price.toString(),
      is_preferred: ps.is_preferred,
    })) || []
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!product;

  const addSupplier = () => {
    setProductSuppliers([...productSuppliers, { supplier_id: '', purchase_price: '', is_preferred: false }]);
  };

  const removeSupplier = (index: number) => {
    setProductSuppliers(productSuppliers.filter((_, i) => i !== index));
  };

  const updateSupplier = (index: number, field: string, value: string | boolean) => {
    const updated = [...productSuppliers];
    updated[index] = { ...updated[index], [field]: value };

    // Si se marca como preferido, desmarcar los demás
    if (field === 'is_preferred' && value === true) {
      updated.forEach((s, i) => {
        if (i !== index) s.is_preferred = false;
      });
    }

    setProductSuppliers(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim() || !formData.sale_price) {
      setError('Nombre y precio de venta son requeridos');
      return;
    }

    setIsLoading(true);

    try {
      const url = isEditing ? `/api/products/${product.id}` : '/api/products';
      const method = isEditing ? 'PUT' : 'POST';

      const supplierData = productSuppliers
        .filter((s) => s.supplier_id && s.purchase_price)
        .map((s) => ({
          supplier_id: s.supplier_id,
          purchase_price: parseFloat(s.purchase_price),
          is_preferred: s.is_preferred,
        }));

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          suppliers: supplierData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Error al guardar');
        return;
      }

      onSuccess();
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl p-6 my-8">
        <h2 className="text-xl font-bold mb-6">
          {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as ProductCategory })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio de Venta</label>
              <input
                type="number"
                value={formData.sale_price}
                onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock Mínimo</label>
              <input
                type="number"
                value={formData.min_stock}
                onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
          </div>

          {/* Proveedores */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">Proveedores y Precios de Compra</h3>
              <button
                type="button"
                onClick={addSupplier}
                className="text-sm text-amber-600 hover:text-amber-800"
              >
                + Agregar proveedor
              </button>
            </div>

            {productSuppliers.length === 0 ? (
              <p className="text-sm text-gray-500">No hay proveedores asignados</p>
            ) : (
              <div className="space-y-3">
                {productSuppliers.map((ps, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <select
                      value={ps.supplier_id}
                      onChange={(e) => updateSupplier(index, 'supplier_id', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">Seleccionar proveedor...</option>
                      {suppliers.filter((s) => s.active).map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={ps.purchase_price}
                      onChange={(e) => updateSupplier(index, 'purchase_price', e.target.value)}
                      placeholder="Precio compra"
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <label className="flex items-center gap-1 text-sm whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={ps.is_preferred}
                        onChange={(e) => updateSupplier(index, 'is_preferred', e.target.checked)}
                      />
                      Preferido
                    </label>
                    <button
                      type="button"
                      onClick={() => removeSupplier(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
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

interface QuickStockModalProps {
  product: ProductWithDetails;
  suppliers: Supplier[];
  onClose: () => void;
  onSuccess: () => void;
}

function QuickStockModal({ product, suppliers, onClose, onSuccess }: QuickStockModalProps) {
  const [formData, setFormData] = useState({
    supplier_id: product.product_suppliers?.[0]?.supplier_id || '',
    packages: '1',
    units_per_package: '',
    price_per_package: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
          product_id: product.id,
          supplier_id: formData.supplier_id,
          quantity: totalUnits,
          purchase_price: unitPrice,
          batch_date: new Date().toISOString().split('T')[0],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Error al agregar stock');
        return;
      }

      onSuccess();
    } catch {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-2">Agregar Stock</h2>
        <p className="text-gray-600 mb-4">{product.name}</p>
        <p className="text-sm text-gray-500 mb-4">Stock actual: <span className="font-bold">{product.current_stock}</span></p>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              <option value="">Seleccionar...</option>
              {suppliers.filter(s => s.active).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Sección de paquetes */}
          <div className="bg-amber-50 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-amber-800">Información del paquete</p>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Paquetes</label>
                <input
                  type="number"
                  value={formData.packages}
                  onChange={(e) => setFormData({ ...formData, packages: e.target.value })}
                  required
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Uds/Paquete</label>
                <input
                  type="number"
                  value={formData.units_per_package}
                  onChange={(e) => setFormData({ ...formData, units_per_package: e.target.value })}
                  required
                  min="1"
                  placeholder="24"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">$/Paquete</label>
                <input
                  type="number"
                  value={formData.price_per_package}
                  onChange={(e) => setFormData({ ...formData, price_per_package: e.target.value })}
                  required
                  min="0"
                  placeholder="68000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center"
                />
              </div>
            </div>

            {totalUnits > 0 && (
              <div className="bg-white rounded-lg p-3 border border-amber-200">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-gray-500">Total Uds</p>
                    <p className="text-lg font-bold text-gray-900">{totalUnits}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">$/Unidad</p>
                    <p className="text-lg font-bold text-amber-600">{formatCurrency(unitPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(totalCost)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? 'Guardando...' : 'Agregar Stock'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AdjustProductStockModalProps {
  product: ProductWithDetails;
  onClose: () => void;
  onSuccess: () => void;
}

function AdjustProductStockModal({ product, onClose, onSuccess }: AdjustProductStockModalProps) {
  const [mode, setMode] = useState<'quick' | 'package'>('quick');
  const [newStock, setNewStock] = useState(product.current_stock.toString());
  const [packageData, setPackageData] = useState({
    packages: '1',
    units_per_package: '',
    price_per_package: '',
  });
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Cálculos para modo paquete
  const packages = parseInt(packageData.packages) || 0;
  const unitsPerPackage = parseInt(packageData.units_per_package) || 0;
  const pricePerPackage = parseFloat(packageData.price_per_package) || 0;
  const packageUnits = packages * unitsPerPackage;
  const unitPrice = unitsPerPackage > 0 ? pricePerPackage / unitsPerPackage : 0;

  // Diferencia según el modo
  const quickDiff = parseInt(newStock || '0') - product.current_stock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    let finalStock: number;

    if (mode === 'quick') {
      finalStock = parseInt(newStock);
      if (isNaN(finalStock) || finalStock < 0) {
        setError('Ingrese un valor válido');
        setIsLoading(false);
        return;
      }
    } else {
      // Modo paquete - restar unidades
      if (packageUnits <= 0) {
        setError('Ingrese cantidad válida de paquetes');
        setIsLoading(false);
        return;
      }
      finalStock = product.current_stock - packageUnits;
      if (finalStock < 0) {
        setError(`No hay suficiente stock. Máximo a restar: ${product.current_stock}`);
        setIsLoading(false);
        return;
      }
    }

    if (finalStock === product.current_stock) {
      onClose();
      return;
    }

    try {
      const response = await fetch('/api/inventory/adjust-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          new_stock: finalStock,
          reason: reason || (mode === 'package'
            ? `Salida: ${packageUnits} uds (${packages} paq x ${unitsPerPackage} uds)`
            : 'Ajuste manual'),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Error al ajustar stock');
        return;
      }

      onSuccess();
    } catch {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-2">Ajustar Stock</h2>
        <p className="text-gray-600 mb-2">{product.name}</p>
        <p className="text-sm mb-4">
          Stock actual: <span className="font-bold text-lg">{product.current_stock}</span>
          <span className="text-gray-400"> / mín: {product.min_stock}</span>
        </p>

        {/* Tabs de modo */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMode('quick')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              mode === 'quick'
                ? 'bg-amber-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Ajuste Directo
          </button>
          <button
            type="button"
            onClick={() => setMode('package')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              mode === 'package'
                ? 'bg-amber-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Por Paquetes
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'quick' ? (
            /* Modo ajuste directo */
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nuevo Stock *
              </label>
              <input
                type="number"
                value={newStock}
                onChange={(e) => setNewStock(e.target.value)}
                required
                min="0"
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 text-center text-2xl font-bold"
              />
              {quickDiff !== 0 && (
                <p className={`text-sm mt-2 text-center font-medium ${quickDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {quickDiff > 0 ? '+' : ''}{quickDiff} unidades
                </p>
              )}
            </div>
          ) : (
            /* Modo paquetes - para restar */
            <div className="bg-red-50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-red-800">Restar por paquetes vendidos/dañados</p>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Paquetes</label>
                  <input
                    type="number"
                    value={packageData.packages}
                    onChange={(e) => setPackageData({ ...packageData, packages: e.target.value })}
                    required
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Uds/Paquete</label>
                  <input
                    type="number"
                    value={packageData.units_per_package}
                    onChange={(e) => setPackageData({ ...packageData, units_per_package: e.target.value })}
                    required
                    min="1"
                    placeholder="24"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">$/Paquete</label>
                  <input
                    type="number"
                    value={packageData.price_per_package}
                    onChange={(e) => setPackageData({ ...packageData, price_per_package: e.target.value })}
                    min="0"
                    placeholder="68000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center"
                  />
                </div>
              </div>

              {packageUnits > 0 && (
                <div className="bg-white rounded-lg p-3 border border-red-200">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-gray-500">Restar</p>
                      <p className="text-lg font-bold text-red-600">-{packageUnits}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">$/Unidad</p>
                      <p className="text-lg font-bold text-gray-600">{formatCurrency(unitPrice)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Nuevo Stock</p>
                      <p className={`text-lg font-bold ${product.current_stock - packageUnits < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {product.current_stock - packageUnits}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Razón del ajuste
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Conteo físico, producto dañado, venta..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
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
