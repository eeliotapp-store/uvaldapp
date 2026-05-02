import { create } from 'zustand';
import type { Product, CartItem, CartCombo, Combo, MICHELADA_PRICE } from '@/types/database';

// Re-export para conveniencia
export const MICHELADA_EXTRA = 4000;

interface CartState {
  items: CartItem[];
  combos: CartCombo[];
  total: number;

  // Items individuales
  addItem: (product: Product, isMichelada?: boolean, isBomba?: boolean) => void;
  addItemWithMichelada: (product: Product, isMichelada: boolean) => void;
  removeItem: (productId: string, isMichelada?: boolean, isBomba?: boolean) => void;
  updateQuantity: (productId: string, quantity: number, isMichelada?: boolean, isBomba?: boolean) => void;
  incrementQuantity: (productId: string, isMichelada?: boolean, isBomba?: boolean) => void;
  decrementQuantity: (productId: string, isMichelada?: boolean, isBomba?: boolean) => void;

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
    const bombaExtra = item.isBomba ? (item.product.bomba_extra || 0) : 0;
    return sum + (basePrice + micheladaExtra + bombaExtra) * item.quantity;
  }, 0);

  const combosTotal = combos.reduce((sum, combo) => sum + combo.finalPrice, 0);

  return itemsTotal + combosTotal;
};

// Generar key único para items (considerando michelada y bomba)
const getItemKey = (productId: string, isMichelada?: boolean, isBomba?: boolean): string => {
  if (isMichelada) return `${productId}-mich`;
  if (isBomba) return `${productId}-bomba`;
  return `${productId}-normal`;
};

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  combos: [],
  total: 0,

  addItem: (product, isMichelada = false, isBomba = false) => {
    const { items, combos } = get();
    const existingItem = items.find(
      (item) => item.product.id === product.id && item.isMichelada === isMichelada && item.isBomba === isBomba
    );

    if (existingItem) {
      const updatedItems = items.map((item) =>
        item.product.id === product.id && item.isMichelada === isMichelada && item.isBomba === isBomba
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
      set({ items: updatedItems, total: calculateTotal(updatedItems, combos) });
    } else {
      const newItems = [...items, { product, quantity: 1, isMichelada, isBomba }];
      set({ items: newItems, total: calculateTotal(newItems, combos) });
    }
  },

  addItemWithMichelada: (product, isMichelada) => {
    get().addItem(product, isMichelada, false);
  },

  removeItem: (productId, isMichelada, isBomba) => {
    const { items, combos } = get();
    const newItems = items.filter(
      (item) => !(item.product.id === productId && item.isMichelada === isMichelada && item.isBomba === isBomba)
    );
    set({ items: newItems, total: calculateTotal(newItems, combos) });
  },

  updateQuantity: (productId, quantity, isMichelada, isBomba) => {
    if (quantity <= 0) {
      get().removeItem(productId, isMichelada, isBomba);
      return;
    }

    const { items, combos } = get();
    const updatedItems = items.map((item) =>
      item.product.id === productId && item.isMichelada === isMichelada && item.isBomba === isBomba
        ? { ...item, quantity }
        : item
    );
    set({ items: updatedItems, total: calculateTotal(updatedItems, combos) });
  },

  incrementQuantity: (productId, isMichelada, isBomba) => {
    const { items } = get();
    const item = items.find(
      (i) => i.product.id === productId && i.isMichelada === isMichelada && i.isBomba === isBomba
    );
    if (item) {
      get().updateQuantity(productId, item.quantity + 1, isMichelada, isBomba);
    }
  },

  decrementQuantity: (productId, isMichelada, isBomba) => {
    const { items } = get();
    const item = items.find(
      (i) => i.product.id === productId && i.isMichelada === isMichelada && i.isBomba === isBomba
    );
    if (item) {
      get().updateQuantity(productId, item.quantity - 1, isMichelada, isBomba);
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
