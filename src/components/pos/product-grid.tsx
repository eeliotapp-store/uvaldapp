'use client';

import { Product } from '@/types/database';
import { formatCurrency } from '@/lib/utils';
import { useCartStore } from '@/stores/cart-store';

interface ProductGridProps {
  products: Product[];
  stockMap: Record<string, number>;
}

export function ProductGrid({ products, stockMap }: ProductGridProps) {
  const addItem = useCartStore((state) => state.addItem);

  const handleAddProduct = (product: Product) => {
    addItem(product);
  };

  if (products.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <div className="text-gray-400 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <p className="text-lg font-medium text-gray-600">No hay productos</p>
        <p className="text-sm text-gray-400 mt-1">Ve a Productos para crear los productos primero</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {products.map((product) => {
        const stock = stockMap[product.id] || 0;
        const isOutOfStock = stock <= 0;

        return (
          <button
            key={product.id}
            onClick={() => handleAddProduct(product)}
            disabled={isOutOfStock}
            className={`
              relative p-4 rounded-xl border-2 text-left transition-all
              ${isOutOfStock
                ? 'bg-gray-100 border-gray-200 opacity-50 cursor-not-allowed'
                : 'bg-white border-gray-200 hover:border-amber-400 hover:shadow-md active:scale-95'
              }
            `}
          >
            {/* Stock Badge */}
            <span
              className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium
                ${stock <= 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}
              `}
            >
              {stock}
            </span>

            {/* Product Image Placeholder */}
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-3">
              <svg
                className="w-6 h-6 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                />
              </svg>
            </div>

            {/* Product Info */}
            <h3 className="font-medium text-gray-900 text-sm line-clamp-2">
              {product.name}
            </h3>
            <p className="text-amber-600 font-bold mt-1">
              {formatCurrency(product.sale_price)}
            </p>

            {/* Out of Stock Overlay */}
            {isOutOfStock && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
                <span className="text-red-600 font-medium text-sm">Agotado</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
