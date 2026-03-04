'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import type { ComboWithItems, Product } from '@/types/database';

export default function CombosPage() {
  const [combos, setCombos] = useState<ComboWithItems[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState<ComboWithItems | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [combosRes, productsRes] = await Promise.all([
        fetch('/api/combos?includeInactive=true'),
        fetch('/api/products'),
      ]);
      const combosData = await combosRes.json();
      const productsData = await productsRes.json();
      setCombos(combosData.combos || []);
      setProducts(productsData.products || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingCombo(null);
    setShowModal(true);
  };

  const handleEdit = (combo: ComboWithItems) => {
    setEditingCombo(combo);
    setShowModal(true);
  };

  const handleSuccess = () => {
    setShowModal(false);
    setEditingCombo(null);
    loadData();
  };

  const handleToggleActive = async (combo: ComboWithItems) => {
    try {
      await fetch(`/api/combos/${combo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !combo.is_active }),
      });
      loadData();
    } catch (error) {
      console.error('Error toggling combo:', error);
    }
  };

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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Combos y Promociones</h1>
          <p className="text-sm text-gray-500 mt-1">Gestiona las promociones del POS</p>
        </div>
        <Button onClick={handleCreate}>+ Nuevo Combo</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Nombre</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Productos</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Precio Base</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Editable</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Estado</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {combos.map((combo) => (
                <tr key={combo.id} className={`hover:bg-gray-50 ${!combo.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-medium text-gray-900">{combo.name}</span>
                      {combo.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{combo.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {combo.combo_items?.map((item) => (
                        <span
                          key={item.id}
                          className={`px-2 py-0.5 rounded text-xs ${
                            item.is_swappable
                              ? 'bg-blue-100 text-blue-700'
                              : item.is_michelada
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {item.quantity}x {item.products?.name}
                          {item.is_michelada && ' (Mich)'}
                          {item.is_swappable && ' *'}
                        </span>
                      ))}
                    </div>
                    {combo.combo_items?.some(i => i.is_swappable) && (
                      <p className="text-xs text-blue-600 mt-1">* Intercambiable</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCurrency(combo.base_price)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {combo.is_price_editable ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        Sí
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">
                        No
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {combo.is_active ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        Activo
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                        Inactivo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => handleEdit(combo)}
                      className="text-amber-600 hover:text-amber-800 text-sm font-medium"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleToggleActive(combo)}
                      className="text-gray-500 hover:text-gray-700 text-sm font-medium"
                    >
                      {combo.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {combos.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No hay combos creados. Crea el primero haciendo click en "+ Nuevo Combo"
          </div>
        )}
      </div>

      {showModal && (
        <ComboModal
          combo={editingCombo}
          products={products}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}

interface ComboModalProps {
  combo: ComboWithItems | null;
  products: Product[];
  onClose: () => void;
  onSuccess: () => void;
}

function ComboModal({ combo, products, onClose, onSuccess }: ComboModalProps) {
  const [formData, setFormData] = useState({
    name: combo?.name || '',
    description: combo?.description || '',
    base_price: combo?.base_price?.toString() || '',
    is_price_editable: combo?.is_price_editable || false,
  });

  const [comboItems, setComboItems] = useState<{
    product_id: string;
    quantity: string;
    is_swappable: boolean;
    is_michelada: boolean;
  }[]>(
    combo?.combo_items?.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity.toString(),
      is_swappable: item.is_swappable,
      is_michelada: item.is_michelada,
    })) || [{ product_id: '', quantity: '1', is_swappable: false, is_michelada: false }]
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!combo;

  const addItem = () => {
    setComboItems([...comboItems, { product_id: '', quantity: '1', is_swappable: false, is_michelada: false }]);
  };

  const removeItem = (index: number) => {
    if (comboItems.length > 1) {
      setComboItems(comboItems.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: string, value: string | boolean) => {
    const updated = [...comboItems];
    updated[index] = { ...updated[index], [field]: value };
    setComboItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim() || !formData.base_price) {
      setError('Nombre y precio base son requeridos');
      return;
    }

    const validItems = comboItems.filter((item) => item.product_id && parseInt(item.quantity) > 0);
    if (validItems.length === 0) {
      setError('Debe agregar al menos un producto');
      return;
    }

    setIsLoading(true);

    try {
      const url = isEditing ? `/api/combos/${combo.id}` : '/api/combos';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          items: validItems.map((item) => ({
            product_id: item.product_id,
            quantity: parseInt(item.quantity),
            is_swappable: item.is_swappable,
            is_michelada: item.is_michelada,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Error al guardar');
        return;
      }

      onSuccess();
    } catch {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const activeProducts = products.filter((p) => p.active);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl p-6 my-8">
        <h2 className="text-xl font-bold mb-6">
          {isEditing ? 'Editar Combo' : 'Nuevo Combo'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: 2 Coronitas Micheladas"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ej: Aguardiente azul o verde"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio Base *</label>
              <input
                type="number"
                value={formData.base_price}
                onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                placeholder="12000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
              />
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_price_editable}
                  onChange={(e) => setFormData({ ...formData, is_price_editable: e.target.checked })}
                  className="w-4 h-4 text-amber-500 border-gray-300 rounded focus:ring-amber-500"
                />
                <span className="text-sm font-medium text-gray-700">Precio editable</span>
              </label>
              <span className="text-xs text-gray-500 ml-2">(permite ajustar al vender)</span>
            </div>
          </div>

          {/* Productos del combo */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">Productos del combo</h3>
              <button
                type="button"
                onClick={addItem}
                className="text-sm text-amber-600 hover:text-amber-800"
              >
                + Agregar producto
              </button>
            </div>

            <div className="space-y-3">
              {comboItems.map((item, index) => (
                <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                    min="1"
                    className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-center text-sm"
                  />
                  <span className="text-gray-500">x</span>
                  <select
                    value={item.product_id}
                    onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Seleccionar producto...</option>
                    {activeProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={item.is_michelada}
                      onChange={(e) => updateItem(index, 'is_michelada', e.target.checked)}
                      className="w-3 h-3"
                    />
                    Mich
                  </label>
                  <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={item.is_swappable}
                      onChange={(e) => updateItem(index, 'is_swappable', e.target.checked)}
                      className="w-3 h-3"
                    />
                    Intercambiable
                  </label>
                  {comboItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-red-500 hover:text-red-700 px-2"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
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
