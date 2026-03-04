'use client';

import { useState } from 'react';
import { useCartStore } from '@/stores/cart-store';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ComboWithItems, Product } from '@/types/database';

interface ComboGridProps {
  combos: ComboWithItems[];
  products: Product[];
}

export function ComboGrid({ combos, products }: ComboGridProps) {
  const [selectedCombo, setSelectedCombo] = useState<ComboWithItems | null>(null);
  const { addCombo } = useCartStore();

  const handleComboClick = (combo: ComboWithItems) => {
    if (combo.is_price_editable || combo.combo_items?.some(i => i.is_swappable)) {
      // Abrir modal para editar
      setSelectedCombo(combo);
    } else {
      // Agregar directamente al carrito
      const items = combo.combo_items?.map(item => ({
        product: item.products,
        quantity: item.quantity,
        isMichelada: item.is_michelada,
      })) || [];
      addCombo(combo, items, combo.base_price);
    }
  };

  if (combos.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No hay combos disponibles</p>
        <p className="text-sm mt-1">Crea combos desde la página de Combos</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {combos.map((combo) => (
          <button
            key={combo.id}
            onClick={() => handleComboClick(combo)}
            className="bg-white rounded-xl p-4 border-2 border-gray-200 hover:border-amber-500 transition-colors text-left"
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-2xl">🎁</span>
              {combo.is_price_editable && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                  Editable
                </span>
              )}
            </div>
            <h3 className="font-medium text-gray-900 text-sm mb-1 line-clamp-2">
              {combo.name}
            </h3>
            {combo.description && (
              <p className="text-xs text-gray-500 mb-2 line-clamp-1">{combo.description}</p>
            )}
            <div className="flex flex-wrap gap-1 mb-2">
              {combo.combo_items?.slice(0, 3).map((item) => (
                <span key={item.id} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                  {item.quantity}x {item.products?.name?.substring(0, 10)}
                  {item.is_michelada && ' 🌶️'}
                </span>
              ))}
              {(combo.combo_items?.length || 0) > 3 && (
                <span className="text-xs text-gray-400">+{(combo.combo_items?.length || 0) - 3}</span>
              )}
            </div>
            <p className="text-lg font-bold text-amber-600">
              {formatCurrency(combo.base_price)}
            </p>
          </button>
        ))}
      </div>

      {/* Modal para combo editable */}
      {selectedCombo && (
        <EditableComboModal
          combo={selectedCombo}
          products={products}
          onClose={() => setSelectedCombo(null)}
          onAdd={(items, finalPrice) => {
            addCombo(selectedCombo, items, finalPrice);
            setSelectedCombo(null);
          }}
        />
      )}
    </>
  );
}

interface EditableComboModalProps {
  combo: ComboWithItems;
  products: Product[];
  onClose: () => void;
  onAdd: (items: { product: Product; quantity: number; isMichelada?: boolean }[], finalPrice: number) => void;
}

function EditableComboModal({ combo, products, onClose, onAdd }: EditableComboModalProps) {
  const [finalPrice, setFinalPrice] = useState(combo.base_price.toString());
  const [comboItems, setComboItems] = useState(
    combo.combo_items?.map(item => ({
      originalProductId: item.product_id,
      productId: item.product_id,
      quantity: item.quantity,
      isMichelada: item.is_michelada,
      isSwappable: item.is_swappable,
    })) || []
  );

  const handleProductChange = (index: number, newProductId: string) => {
    const updated = [...comboItems];
    updated[index].productId = newProductId;
    setComboItems(updated);
  };

  const handleSubmit = () => {
    const items = comboItems.map(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) return null;
      return {
        product,
        quantity: item.quantity,
        isMichelada: item.isMichelada,
      };
    }).filter(Boolean) as { product: Product; quantity: number; isMichelada?: boolean }[];

    onAdd(items, parseFloat(finalPrice) || combo.base_price);
  };

  // Filtrar productos activos (solo cervezas para intercambio)
  const beerProducts = products.filter(p =>
    p.active && (p.category.includes('beer') || p.category === 'other')
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
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

        {/* Productos del combo */}
        <div className="space-y-3 mb-4">
          <p className="text-sm font-medium text-gray-700">Productos incluidos:</p>
          {comboItems.map((item, index) => {
            const currentProduct = products.find(p => p.id === item.productId);
            return (
              <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium w-8 text-center">{item.quantity}x</span>
                {item.isSwappable ? (
                  <select
                    value={item.productId}
                    onChange={(e) => handleProductChange(index, e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    {beerProducts.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                ) : (
                  <span className="flex-1 text-sm">{currentProduct?.name}</span>
                )}
                {item.isMichelada && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                    Mich
                  </span>
                )}
                {item.isSwappable && (
                  <span className="text-xs text-blue-600">*</span>
                )}
              </div>
            );
          })}
          {comboItems.some(i => i.isSwappable) && (
            <p className="text-xs text-blue-600">* Producto intercambiable</p>
          )}
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="flex-1">
            Agregar {formatCurrency(parseFloat(finalPrice) || combo.base_price)}
          </Button>
        </div>
      </div>
    </div>
  );
}
