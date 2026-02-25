import { create } from 'zustand';
import type { Product, CartItem } from '@/types/database';

interface CartState {
  items: CartItem[];
  total: number;

  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  incrementQuantity: (productId: string) => void;
  decrementQuantity: (productId: string) => void;
  clear: () => void;
}

const calculateTotal = (items: CartItem[]): number => {
  return items.reduce((sum, item) => sum + item.product.sale_price * item.quantity, 0);
};

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  total: 0,

  addItem: (product) => {
    const { items } = get();
    const existingItem = items.find((item) => item.product.id === product.id);

    if (existingItem) {
      const updatedItems = items.map((item) =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
      set({ items: updatedItems, total: calculateTotal(updatedItems) });
    } else {
      const newItems = [...items, { product, quantity: 1 }];
      set({ items: newItems, total: calculateTotal(newItems) });
    }
  },

  removeItem: (productId) => {
    const { items } = get();
    const newItems = items.filter((item) => item.product.id !== productId);
    set({ items: newItems, total: calculateTotal(newItems) });
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }

    const { items } = get();
    const updatedItems = items.map((item) =>
      item.product.id === productId ? { ...item, quantity } : item
    );
    set({ items: updatedItems, total: calculateTotal(updatedItems) });
  },

  incrementQuantity: (productId) => {
    const { items } = get();
    const item = items.find((i) => i.product.id === productId);
    if (item) {
      get().updateQuantity(productId, item.quantity + 1);
    }
  },

  decrementQuantity: (productId) => {
    const { items } = get();
    const item = items.find((i) => i.product.id === productId);
    if (item) {
      get().updateQuantity(productId, item.quantity - 1);
    }
  },

  clear: () => {
    set({ items: [], total: 0 });
  },
}));
