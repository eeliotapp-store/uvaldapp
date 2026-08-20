import { create } from 'zustand';

// Estado 100% local para la cuenta de capacitación (rol 'pruebas').
// Nada de lo que hay aquí toca Supabase ni /api/* — es solo para practicar
// la mecánica de la app (mesas, ventas, turno) con datos de mentira.
// La forma de las acciones (guardar mesa, cobrar, descartar) sigue a
// propósito el mismo patrón que /sales en producción.

export interface DemoProduct {
  id: string;
  name: string;
  category: string;
  sale_price: number;
  stock: number;
}

export interface DemoLineItem {
  product: DemoProduct;
  quantity: number;
}

export interface DemoTab {
  id: string;
  tableNumber: string;
  items: DemoLineItem[];
  createdAt: string;
}

export interface DemoClosedSale {
  id: string;
  tableNumber: string;
  items: DemoLineItem[];
  total: number;
  paymentMethod: 'cash' | 'transfer' | 'mixed';
  cashAmount: number;
  transferAmount: number;
  cashChange: number;
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

function tabTotal(tab: Pick<DemoTab, 'items'>): number {
  return tab.items.reduce((sum, i) => sum + i.product.sale_price * i.quantity, 0);
}

interface DemoState {
  products: DemoProduct[];
  shift: DemoShift | null;
  tabs: DemoTab[];
  closedSales: DemoClosedSale[];

  startShift: (type: 'day' | 'night', cashStart: number) => void;
  closeShift: () => void;

  // El modal de venta trabaja con una lista local de items (el contenido final
  // deseado de la mesa) y esta acción la concilia contra el stock: crea la mesa
  // si existingTabId es null, o ajusta el stock por la diferencia si ya existía.
  // Igual efecto que "Guardar (Cuenta Abierta)" en /sales.
  upsertTab: (existingTabId: string | null, tableNumber: string, items: DemoLineItem[]) => string;
  // Devuelve el stock de los items de la mesa y la elimina — igual que "Descartar cuenta".
  discardTab: (tabId: string) => void;
  // Cierra y cobra la mesa — igual que "Dar la Cuenta" + "Confirmar Pago".
  closeTab: (
    tabId: string,
    payment: { method: 'cash' | 'transfer' | 'mixed'; cashAmount: number; transferAmount: number; cashChange: number }
  ) => void;

  adjustStock: (productId: string, delta: number) => void;

  reset: () => void;
}

export const useDemoStore = create<DemoState>((set, get) => ({
  products: INITIAL_PRODUCTS,
  shift: null,
  tabs: [],
  closedSales: [],

  startShift: (type, cashStart) => {
    set({ shift: { type, cashStart, startedAt: new Date().toISOString() } });
  },

  closeShift: () => {
    set({ shift: null, tabs: [], closedSales: [], products: INITIAL_PRODUCTS });
  },

  upsertTab: (existingTabId, tableNumber, items) => {
    const { tabs, products } = get();
    const cleanItems = items.filter((i) => i.quantity > 0);

    if (existingTabId) {
      const existingTab = tabs.find((t) => t.id === existingTabId);
      const oldQtyByProduct: Record<string, number> = {};
      existingTab?.items.forEach((i) => {
        oldQtyByProduct[i.product.id] = (oldQtyByProduct[i.product.id] || 0) + i.quantity;
      });
      const newQtyByProduct: Record<string, number> = {};
      cleanItems.forEach((i) => {
        newQtyByProduct[i.product.id] = (newQtyByProduct[i.product.id] || 0) + i.quantity;
      });
      // Delta positivo = se agregó (descuenta stock), negativo = se quitó (devuelve stock)
      const productIds = new Set([...Object.keys(oldQtyByProduct), ...Object.keys(newQtyByProduct)]);
      const updatedProducts = products.map((p) => {
        if (!productIds.has(p.id)) return p;
        const delta = (newQtyByProduct[p.id] || 0) - (oldQtyByProduct[p.id] || 0);
        return delta ? { ...p, stock: Math.max(0, p.stock - delta) } : p;
      });

      const updatedTabs = tabs.map((tab) =>
        tab.id === existingTabId ? { ...tab, items: cleanItems } : tab
      );
      set({ tabs: updatedTabs, products: updatedProducts });
      return existingTabId;
    }

    const stockDelta: Record<string, number> = {};
    cleanItems.forEach((i) => {
      stockDelta[i.product.id] = (stockDelta[i.product.id] || 0) + i.quantity;
    });
    const updatedProducts = products.map((p) =>
      stockDelta[p.id] ? { ...p, stock: Math.max(0, p.stock - stockDelta[p.id]) } : p
    );

    const id = `tab-${Date.now()}`;
    const tab: DemoTab = {
      id,
      tableNumber: tableNumber.trim() || 'Sin número',
      items: cleanItems,
      createdAt: new Date().toISOString(),
    };
    set({ tabs: [...tabs, tab], products: updatedProducts });
    return id;
  },

  discardTab: (tabId) => {
    const { tabs, products } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    const restoreDelta: Record<string, number> = {};
    tab.items.forEach((i) => {
      restoreDelta[i.product.id] = (restoreDelta[i.product.id] || 0) + i.quantity;
    });
    const updatedProducts = products.map((p) =>
      restoreDelta[p.id] ? { ...p, stock: p.stock + restoreDelta[p.id] } : p
    );

    set({ tabs: tabs.filter((t) => t.id !== tabId), products: updatedProducts });
  },

  closeTab: (tabId, payment) => {
    const { tabs, closedSales } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab || tab.items.length === 0) return;

    const closedSale: DemoClosedSale = {
      id: tab.id,
      tableNumber: tab.tableNumber,
      items: tab.items,
      total: tabTotal(tab),
      paymentMethod: payment.method,
      cashAmount: payment.cashAmount,
      transferAmount: payment.transferAmount,
      cashChange: payment.cashChange,
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
    set({ products: INITIAL_PRODUCTS, shift: null, tabs: [], closedSales: [] });
  },
}));

export { tabTotal };
