import { create } from 'zustand';
import type { Product, CartItem, CartCombo, Combo, MICHELADA_PRICE } from '@/types/database';

// Re-export para conveniencia
export const MICHELADA_EXTRA = 4000;

interface CartState {
  items: CartItem[];
  combos: CartCombo[];
  total: number;

  // Items individuales
  addItem: (product: Product, isMichelada?: boolean) => void;
  addItemWithMichelada: (product: Product, isMichelada: boolean) => void;
  removeItem: (productId: string, isMichelada?: boolean) => void;
  updateQuantity: (productId: string, quantity: number, isMichelada?: boolean) => void;
  incrementQuantity: (productId: string, isMichelada?: boolean) => void;
  decrementQuantity: (productId: string, isMichelada?: boolean) => void;

  // Combos
  addCombo: (combo: Combo, items: { product: Product; quantity: number; isMichelada?: boolean }[], finalPrice: number) => void;
  removeCombo: (index: number) => void;
  updateComboPrice: (index: number, newPrice: number) => void;

  // General
  clear: () => void;
}

const calculateTotal = (items: CartItem[], combos: CartCombo[]): number => {
  const itemsTotal = items.reduce((sum, item) => {
    const basePrice = item.product.sale_price;
    const micheladaExtra = item.isMichelada ? MICHELADA_EXTRA : 0;
    return sum + (basePrice + micheladaExtra) * item.quantity;
  }, 0);

  const combosTotal = combos.reduce((sum, combo) => sum + combo.finalPrice, 0);

  return itemsTotal + combosTotal;
};

// Generar key único para items (considerando michelada)
const getItemKey = (productId: string, isMichelada?: boolean): string => {
  return `${productId}-${isMichelada ? 'mich' : 'normal'}`;
};

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  combos: [],
  total: 0,

  addItem: (product, isMichelada = false) => {
    const { items, combos } = get();
    // Buscar item con mismo producto Y mismo estado de michelada
    const existingItem = items.find(
      (item) => item.product.id === product.id && item.isMichelada === isMichelada
    );

    if (existingItem) {
      const updatedItems = items.map((item) =>
        item.product.id === product.id && item.isMichelada === isMichelada
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
      set({ items: updatedItems, total: calculateTotal(updatedItems, combos) });
    } else {
      const newItems = [...items, { product, quantity: 1, isMichelada }];
      set({ items: newItems, total: calculateTotal(newItems, combos) });
    }
  },

  addItemWithMichelada: (product, isMichelada) => {
    get().addItem(product, isMichelada);
  },

  removeItem: (productId, isMichelada) => {
    const { items, combos } = get();
    const newItems = items.filter(
      (item) => !(item.product.id === productId && item.isMichelada === isMichelada)
    );
    set({ items: newItems, total: calculateTotal(newItems, combos) });
  },

  updateQuantity: (productId, quantity, isMichelada) => {
    if (quantity <= 0) {
      get().removeItem(productId, isMichelada);
      return;
    }

    const { items, combos } = get();
    const updatedItems = items.map((item) =>
      item.product.id === productId && item.isMichelada === isMichelada
        ? { ...item, quantity }
        : item
    );
    set({ items: updatedItems, total: calculateTotal(updatedItems, combos) });
  },

  incrementQuantity: (productId, isMichelada) => {
    const { items } = get();
    const item = items.find(
      (i) => i.product.id === productId && i.isMichelada === isMichelada
    );
    if (item) {
      get().updateQuantity(productId, item.quantity + 1, isMichelada);
    }
  },

  decrementQuantity: (productId, isMichelada) => {
    const { items } = get();
    const item = items.find(
      (i) => i.product.id === productId && i.isMichelada === isMichelada
    );
    if (item) {
      get().updateQuantity(productId, item.quantity - 1, isMichelada);
    }
  },

  addCombo: (combo, items, finalPrice) => {
    const { items: cartItems, combos } = get();
    const newCombo: CartCombo = { combo, items, finalPrice };
    const newCombos = [...combos, newCombo];
    set({ combos: newCombos, total: calculateTotal(cartItems, newCombos) });
  },

  removeCombo: (index) => {
    const { items, combos } = get();
    const newCombos = combos.filter((_, i) => i !== index);
    set({ combos: newCombos, total: calculateTotal(items, newCombos) });
  },

  updateComboPrice: (index, newPrice) => {
    const { items, combos } = get();
    const updatedCombos = combos.map((combo, i) =>
      i === index ? { ...combo, finalPrice: newPrice } : combo
    );
    set({ combos: updatedCombos, total: calculateTotal(items, updatedCombos) });
  },

  clear: () => {
    set({ items: [], combos: [], total: 0 });
  },
}));
