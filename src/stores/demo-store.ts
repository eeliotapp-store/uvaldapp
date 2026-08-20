import { create } from 'zustand';

// Estado 100% local para la cuenta de capacitación (rol 'pruebas').
// Nada de lo que hay aquí toca Supabase ni /api/* — es solo para practicar
// la mecánica de la app (mesas, ventas, turno) con datos de mentira.

export interface DemoProduct {
  id: string;
  name: string;
  category: string;
  sale_price: number;
  stock: number;
}

export interface DemoCartItem {
  product: DemoProduct;
  quantity: number;
}

export interface DemoTab {
  id: string;
  tableNumber: string;
  items: DemoCartItem[];
  createdAt: string;
}

export interface DemoClosedSale {
  id: string;
  tableNumber: string;
  items: DemoCartItem[];
  total: number;
  paymentMethod: 'cash' | 'transfer';
  closedAt: string;
}

export interface DemoShift {
  type: 'day' | 'night';
  cashStart: number;
  startedAt: string;
}

const INITIAL_PRODUCTS: DemoProduct[] = [
  { id: 'demo-1', name: 'Corona Extra', category: 'beer_nacional', sale_price: 4500, stock: 20 },
  { id: 'demo-2', name: 'Modelo Especial', category: 'beer_nacional', sale_price: 5000, stock: 20 },
  { id: 'demo-3', name: 'Heineken', category: 'beer_importada', sale_price: 6500, stock: 20 },
  { id: 'demo-4', name: 'Stella Artois', category: 'beer_importada', sale_price: 7000, stock: 20 },
  { id: 'demo-5', name: 'Club Colombia', category: 'beer_nacional', sale_price: 4000, stock: 20 },
  { id: 'demo-6', name: 'Poker', category: 'beer_nacional', sale_price: 3500, stock: 20 },
  { id: 'demo-7', name: 'Aguila', category: 'beer_nacional', sale_price: 3500, stock: 20 },
  { id: 'demo-8', name: '3 Cordilleras', category: 'beer_artesanal', sale_price: 8500, stock: 20 },
];

interface DemoState {
  products: DemoProduct[];
  shift: DemoShift | null;
  tabs: DemoTab[];
  closedSales: DemoClosedSale[];
  nextTabNumber: number;

  startShift: (type: 'day' | 'night', cashStart: number) => void;
  closeShift: () => void;

  openTab: () => string;
  addItemToTab: (tabId: string, product: DemoProduct) => void;
  decrementItemInTab: (tabId: string, productId: string) => void;
  closeTab: (tabId: string, paymentMethod: 'cash' | 'transfer') => void;

  adjustStock: (productId: string, delta: number) => void;

  reset: () => void;
}

export const useDemoStore = create<DemoState>((set, get) => ({
  products: INITIAL_PRODUCTS,
  shift: null,
  tabs: [],
  closedSales: [],
  nextTabNumber: 1,

  startShift: (type, cashStart) => {
    set({ shift: { type, cashStart, startedAt: new Date().toISOString() } });
  },

  closeShift: () => {
    set({ shift: null, tabs: [], closedSales: [], products: INITIAL_PRODUCTS, nextTabNumber: 1 });
  },

  openTab: () => {
    const { tabs, nextTabNumber } = get();
    const id = `tab-${Date.now()}`;
    const tableNumber = `Mesa ${nextTabNumber}`;
    set({
      tabs: [...tabs, { id, tableNumber, items: [], createdAt: new Date().toISOString() }],
      nextTabNumber: nextTabNumber + 1,
    });
    return id;
  },

  addItemToTab: (tabId, product) => {
    const { tabs, products } = get();
    const stockItem = products.find((p) => p.id === product.id);
    if (!stockItem || stockItem.stock <= 0) return;

    const updatedTabs = tabs.map((tab) => {
      if (tab.id !== tabId) return tab;
      const existing = tab.items.find((i) => i.product.id === product.id);
      const items = existing
        ? tab.items.map((i) =>
            i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
          )
        : [...tab.items, { product, quantity: 1 }];
      return { ...tab, items };
    });

    const updatedProducts = products.map((p) =>
      p.id === product.id ? { ...p, stock: p.stock - 1 } : p
    );

    set({ tabs: updatedTabs, products: updatedProducts });
  },

  decrementItemInTab: (tabId, productId) => {
    const { tabs, products } = get();
    const tab = tabs.find((t) => t.id === tabId);
    const item = tab?.items.find((i) => i.product.id === productId);
    if (!tab || !item) return;

    const updatedTabs = tabs.map((t) => {
      if (t.id !== tabId) return t;
      const items =
        item.quantity <= 1
          ? t.items.filter((i) => i.product.id !== productId)
          : t.items.map((i) =>
              i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i
            );
      return { ...t, items };
    });

    const updatedProducts = products.map((p) =>
      p.id === productId ? { ...p, stock: p.stock + 1 } : p
    );

    set({ tabs: updatedTabs, products: updatedProducts });
  },

  closeTab: (tabId, paymentMethod) => {
    const { tabs, closedSales } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab || tab.items.length === 0) return;

    const total = tab.items.reduce((sum, i) => sum + i.product.sale_price * i.quantity, 0);
    const closedSale: DemoClosedSale = {
      id: tab.id,
      tableNumber: tab.tableNumber,
      items: tab.items,
      total,
      paymentMethod,
      closedAt: new Date().toISOString(),
    };

    set({
      tabs: tabs.filter((t) => t.id !== tabId),
      closedSales: [...closedSales, closedSale],
    });
  },

  adjustStock: (productId, delta) => {
    const { products } = get();
    set({
      products: products.map((p) =>
        p.id === productId ? { ...p, stock: Math.max(0, p.stock + delta) } : p
      ),
    });
  },

  reset: () => {
    set({ products: INITIAL_PRODUCTS, shift: null, tabs: [], closedSales: [], nextTabNumber: 1 });
  },
}));
