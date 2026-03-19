'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { useShiftStore } from '@/stores/shift-store';
import { useAuthStore } from '@/stores/auth-store';
import type { CurrentStock } from '@/types/database';

interface ProductCount {
  product_id: string;
  product_name: string;
  category: string;
  current_stock: number;
  real_stock: string;
}

export default function InventoryCountPage() {
  const router = useRouter();
  const employee = useAuthStore((state) => state.employee);
  const { currentShift } = useShiftStore();
  const [products, setProducts] = useState<ProductCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);

  useEffect(() => {
    if (!employee) {
      router.push('/login');
      return;
    }
    if (!currentShift) {
      router.push('/shifts/start');
      return;
    }
    loadProducts();
  }, [employee, currentShift, router]);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('v_current_stock')
        .select('*')
        .order('product_name');

      if (error) throw error;

      const productCounts: ProductCount[] = (data as CurrentStock[]).map((p) => ({
        product_id: p.product_id,
        product_name: p.product_name,
        category: p.category,
        current_stock: p.current_stock,
        real_stock: p.current_stock.toString(),
      }));

      setProducts(productCounts);
    } catch (err) {
      console.error('Error loading products:', err);
      setError('Error al cargar productos');
    } finally {
      setIsLoading(false);
    }
  };

  const updateRealStock = (productId: string, value: string) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.product_id === productId ? { ...p, real_stock: value } : p
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      // Validar que todos los campos tengan valores válidos
      for (const product of products) {
        const realStock = parseInt(product.real_stock);
        if (isNaN(realStock) || realStock < 0) {
          setError(`Stock inválido para ${product.product_name}`);
          setIsSubmitting(false);
          return;
        }
      }

      // Enviar todos los conteos
      const counts = products.map((p) => ({
        product_id: p.product_id,
        system_stock: p.current_stock,
        real_stock: parseInt(p.real_stock),
        shift_id: currentShift?.id,
      }));

      const response = await fetch('/api/inventory/counts/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counts }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Error al registrar conteos');
        return;
      }

      // Redirigir al POS
      router.push('/pos');
    } catch (err) {
      console.error('Error submitting counts:', err);
      setError('Error al registrar conteos');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Calcular totales
  const totalProducts = products.length;
  const totalDifference = products.reduce((sum, p) => {
    const real = parseInt(p.real_stock) || 0;
    return sum + (real - p.current_stock);
  }, 0);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Conteo de Inventario Inicial</h1>
              <p className="text-sm text-gray-500">
                Registra el stock real de cada producto para iniciar el turno
              </p>
            </div>
          </div>

          {/* Resumen */}
          <div className="mt-4 flex gap-4">
            <div className="bg-gray-50 rounded-lg px-4 py-2">
              <p className="text-xs text-gray-500">Productos</p>
              <p className="text-lg font-bold text-gray-900">{totalProducts}</p>
            </div>
            <div className={`rounded-lg px-4 py-2 ${
              totalDifference > 0 ? 'bg-green-50' : totalDifference < 0 ? 'bg-red-50' : 'bg-gray-50'
            }`}>
              <p className="text-xs text-gray-500">Diferencia Total</p>
              <p className={`text-lg font-bold ${
                totalDifference > 0 ? 'text-green-600' : totalDifference < 0 ? 'text-red-600' : 'text-gray-900'
              }`}>
                {totalDifference > 0 ? '+' : ''}{totalDifference}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    Producto
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 w-28">
                    Sistema
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 w-32">
                    Stock Real
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600 w-24">
                    Dif.
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((product) => {
                  const realStock = parseInt(product.real_stock) || 0;
                  const difference = realStock - product.current_stock;

                  return (
                    <tr key={product.product_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{product.product_name}</p>
                          <p className="text-xs text-gray-500 capitalize">
                            {product.category.replace('_', ' ')}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-medium text-gray-600">
                          {product.current_stock}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={product.real_stock}
                          onChange={(e) => updateRealStock(product.product_id, e.target.value)}
                          min="0"
                          required
                          className="w-full px-3 py-2 text-center font-bold border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-bold ${
                            difference > 0
                              ? 'text-green-600'
                              : difference < 0
                              ? 'text-red-600'
                              : 'text-gray-400'
                          }`}
                        >
                          {difference !== 0 && (difference > 0 ? '+' : '')}{difference !== 0 ? difference : '-'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddProduct(true)}
                className="flex-1"
              >
                + Agregar Producto
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? 'Guardando...' : 'Confirmar Conteo'}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Add Product Modal */}
      {showAddProduct && (
        <AddProductModal
          onClose={() => setShowAddProduct(false)}
          onSuccess={() => {
            setShowAddProduct(false);
            loadProducts();
          }}
        />
      )}
    </div>
  );
}

interface AddProductModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function AddProductModal({ onClose, onSuccess }: AddProductModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('cerveza');
  const [salePrice, setSalePrice] = useState('');
  const [minStock, setMinStock] = useState('5');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category,
          sale_price: parseFloat(salePrice),
          min_stock: parseInt(minStock),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Error al crear producto');
        return;
      }

      onSuccess();
    } catch (err) {
      console.error('Error creating product:', err);
      setError('Error al crear producto');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4">Agregar Producto</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Ej: Corona Extra"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="cerveza">Cerveza</option>
              <option value="licor">Licor</option>
              <option value="bebida">Bebida</option>
              <option value="snack">Snack</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Precio de Venta *
            </label>
            <input
              type="number"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              required
              min="0"
              placeholder="5000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stock Mínimo
            </label>
            <input
              type="number"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              min="0"
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
