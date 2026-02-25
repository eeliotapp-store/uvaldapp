'use client';

import { useCartStore } from '@/stores/cart-store';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface CartProps {
  onCheckout: () => void;
}

export function Cart({ onCheckout }: CartProps) {
  const { items, total, incrementQuantity, decrementQuantity, removeItem, clear } =
    useCartStore();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
        <svg
          className="w-16 h-16 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <p className="text-lg font-medium">Carrito vacío</p>
        <p className="text-sm">Selecciona productos para comenzar</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {items.map((item) => (
          <div
            key={item.product.id}
            className="bg-white rounded-lg p-3 border border-gray-200"
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-medium text-gray-900 text-sm line-clamp-1 flex-1">
                {item.product.name}
              </h4>
              <button
                onClick={() => removeItem(item.product.id)}
                className="text-gray-400 hover:text-red-500 ml-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => decrementQuantity(item.product.id)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200"
                >
                  -
                </button>
                <span className="w-8 text-center font-medium">{item.quantity}</span>
                <button
                  onClick={() => incrementQuantity(item.product.id)}
                  className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 hover:bg-amber-200"
                >
                  +
                </button>
              </div>
              <span className="font-bold text-gray-900">
                {formatCurrency(item.product.sale_price * item.quantity)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Cart Footer */}
      <div className="border-t border-gray-200 pt-4 mt-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-gray-600">Total</span>
          <span className="text-2xl font-bold text-gray-900">
            {formatCurrency(total)}
          </span>
        </div>

        <div className="space-y-2">
          <Button onClick={onCheckout} size="lg" className="w-full">
            Dar la Cuenta
          </Button>
          <Button onClick={clear} variant="outline" size="sm" className="w-full">
            Vaciar carrito
          </Button>
        </div>
      </div>
    </div>
  );
}
