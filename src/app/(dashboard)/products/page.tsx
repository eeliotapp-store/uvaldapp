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
  const [editingProduct, setEditingProduct] = useState<ProductWithDetails | null>(null);
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
                    <span className={`font-bold ${product.current_stock <= product.min_stock ? 'text-red-600' : 'text-gray-900'}`}>
                      {product.current_stock}
                    </span>
                    <span className="text-gray-400 text-sm"> / {product.min_stock}</span>
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
