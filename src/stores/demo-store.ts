import { create } from 'zustand';

// Estado 100% local para la cuenta de capacitación (rol 'pruebas').
// Nada de lo que hay aquí toca Supabase ni /api/* — es solo para practicar
// la mecánica de la app (mesas, ventas, turno, fiados, pagos parciales,
// combos, observaciones) con datos de mentira. La forma de las acciones
// sigue a propósito el mismo patrón que /sales, /fiados y /observations
// en producción.

export type PayMethod = 'cash' | 'transfer' | 'mixed';

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

// Plantilla de combo (equivalente a la tabla combos + combo_items real).
export interface DemoComboTemplateItem {
  productId: string; // producto por defecto
  quantity: number;
  isSwappable: boolean; // si es true, se puede cambiar por otra cerveza al agregarlo
}

export interface DemoComboTemplate {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  isPriceEditable: boolean;
  items: DemoComboTemplateItem[];
}

// Combo ya agregado a una mesa/venta (productos resueltos + precio final elegido).
export interface DemoCartCombo {
  comboId: string;
  comboName: string;
  items: DemoLineItem[];
  finalPrice: number;
}

export interface DemoPartialPayment {
  id: string;
  amount: number;
  method: PayMethod;
  cashAmount: number;
  transferAmount: number;
  createdAt: string;
}

// Observación ligada a UNA mesa/venta puntual — distinta de las observaciones
// generales de turno (DemoObservation, página /demo/observations).
export interface DemoTabObservation {
  id: string;
  text: string;
  createdAt: string;
}

export interface DemoTab {
  id: string;
  tableNumber: string;
  items: DemoLineItem[];
  combos: DemoCartCombo[];
  partialPayments: DemoPartialPayment[];
  tabObservations: DemoTabObservation[];
  createdAt: string;
}

export interface DemoClosedSale {
  id: string;
  tableNumber: string;
  items: DemoLineItem[];
  combos: DemoCartCombo[];
  tabObservations: DemoTabObservation[];
  total: number;
  paymentMethod: PayMethod;
  cashAmount: number;
  transferAmount: number;
  cashChange: number;
  closedAt: string;
}

export interface DemoFiado {
  id: string;
  tableNumber: string;
  customerName: string;
  items: DemoLineItem[];
  combos: DemoCartCombo[];
  tabObservations: DemoTabObservation[];
  total: number;
  fiadoAmount: number; // deuda original (total - abono inicial - pagos parciales previos)
  abono: number; // abono inicial al momento de fiar
  paid: boolean;
  payments: DemoPartialPayment[]; // abonos posteriores
  createdAt: string;
  paidAt: string | null;
}

export interface DemoObservation {
  id: string;
  content: string;
  createdAt: string;
}

export interface DemoShift {
  type: 'day' | 'night';
  cashStart: number;
  startedAt: string;
}

// Copia estática de los nombres, categorías y precios reales del catálogo
// (56 productos activos, leídos una sola vez de producción — solo lectura,
// nunca se vuelve a conectar). El stock es de mentira, propio de este modo
// de práctica, no el inventario real.
const INITIAL_PRODUCTS: DemoProduct[] = [
  { id: 'demo-1', name: '1/2 Aguardiente Amarillo', category: 'beer_nacional', sale_price: 70000, stock: 20 },
  { id: 'demo-2', name: '1/2 Antioqueño Azul', category: 'beer_nacional', sale_price: 60000, stock: 20 },
  { id: 'demo-3', name: '1/2 Antioqueño Verde', category: 'beer_nacional', sale_price: 60000, stock: 20 },
  { id: 'demo-4', name: '1/2 Ron medellín dorado', category: 'beer_nacional', sale_price: 60000, stock: 20 },
  { id: 'demo-5', name: 'Aguila', category: 'beer_nacional', sale_price: 4000, stock: 20 },
  { id: 'demo-6', name: 'BAÑO', category: 'beer_nacional', sale_price: 1000, stock: 20 },
  { id: 'demo-7', name: 'Botella Aguardiente Amarillo', category: 'beer_nacional', sale_price: 120000, stock: 20 },
  { id: 'demo-8', name: 'Botella Antioqueño Azul', category: 'beer_nacional', sale_price: 90000, stock: 20 },
  { id: 'demo-9', name: 'Botella Antioqueño rojo', category: 'beer_nacional', sale_price: 100000, stock: 20 },
  { id: 'demo-10', name: 'Botella Antioqueño Verde', category: 'beer_nacional', sale_price: 90000, stock: 20 },
  { id: 'demo-11', name: 'Botella Bacardi Limón', category: 'beer_nacional', sale_price: 95000, stock: 20 },
  { id: 'demo-12', name: 'Botella Bacardi Mojito', category: 'beer_nacional', sale_price: 95000, stock: 20 },
  { id: 'demo-13', name: 'Botella Buchanans', category: 'beer_nacional', sale_price: 240000, stock: 20 },
  { id: 'demo-14', name: 'Botella Ron', category: 'beer_nacional', sale_price: 100000, stock: 20 },
  { id: 'demo-15', name: 'Botella Smirnoff Tamarindo', category: 'beer_nacional', sale_price: 120000, stock: 20 },
  { id: 'demo-16', name: 'Botella Whiskey Honey', category: 'beer_nacional', sale_price: 180000, stock: 20 },
  { id: 'demo-17', name: 'Budweiser', category: 'beer_nacional', sale_price: 4000, stock: 20 },
  { id: 'demo-18', name: 'Cafe con leche', category: 'beer_nacional', sale_price: 2500, stock: 20 },
  { id: 'demo-19', name: 'Chicles x 3', category: 'beer_nacional', sale_price: 1000, stock: 20 },
  { id: 'demo-20', name: 'ChiXuni', category: 'beer_nacional', sale_price: 500, stock: 20 },
  { id: 'demo-21', name: 'Club', category: 'beer_nacional', sale_price: 4500, stock: 20 },
  { id: 'demo-22', name: 'CocaCola', category: 'beer_nacional', sale_price: 4000, stock: 20 },
  { id: 'demo-23', name: 'Congelados', category: 'beer_nacional', sale_price: 3500, stock: 20 },
  { id: 'demo-24', name: 'Corona Extra', category: 'beer_nacional', sale_price: 9000, stock: 20 },
  { id: 'demo-25', name: 'Coronita', category: 'beer_nacional', sale_price: 5000, stock: 20 },
  { id: 'demo-26', name: 'Descorche', category: 'beer_nacional', sale_price: 25000, stock: 20 },
  { id: 'demo-27', name: 'Electrolit', category: 'beer_nacional', sale_price: 10000, stock: 20 },
  { id: 'demo-28', name: 'Gatorade', category: 'beer_nacional', sale_price: 5000, stock: 20 },
  { id: 'demo-29', name: 'Heineken', category: 'beer_nacional', sale_price: 5000, stock: 20 },
  { id: 'demo-30', name: 'Jugos en agua', category: 'beer_nacional', sale_price: 4500, stock: 20 },
  { id: 'demo-31', name: 'Jugos en leche', category: 'beer_nacional', sale_price: 5000, stock: 20 },
  { id: 'demo-32', name: 'Light', category: 'beer_nacional', sale_price: 4500, stock: 20 },
  { id: 'demo-33', name: 'MANI', category: 'beer_nacional', sale_price: 7000, stock: 20 },
  { id: 'demo-34', name: 'Media Tamarindo', category: 'beer_nacional', sale_price: 80000, stock: 20 },
  { id: 'demo-35', name: 'Milo', category: 'beer_nacional', sale_price: 4500, stock: 20 },
  { id: 'demo-36', name: 'Modelo', category: 'beer_nacional', sale_price: 15000, stock: 20 },
  { id: 'demo-37', name: 'Papas', category: 'beer_nacional', sale_price: 4000, stock: 20 },
  { id: 'demo-38', name: 'PLATO LECHONA', category: 'beer_nacional', sale_price: 7500, stock: 20 },
  { id: 'demo-39', name: 'Poker', category: 'beer_nacional', sale_price: 4000, stock: 20 },
  { id: 'demo-40', name: 'Porcion Mani adicional', category: 'beer_nacional', sale_price: 3500, stock: 20 },
  { id: 'demo-41', name: 'RedBull', category: 'beer_nacional', sale_price: 12000, stock: 20 },
  { id: 'demo-42', name: 'SHOT AMARILLO', category: 'beer_nacional', sale_price: 8000, stock: 20 },
  { id: 'demo-43', name: 'SHOT BUCHANANS', category: 'beer_nacional', sale_price: 12000, stock: 20 },
  { id: 'demo-44', name: 'SHOT RON MED', category: 'beer_nacional', sale_price: 6000, stock: 20 },
  { id: 'demo-45', name: 'SHOT TAMARINDO', category: 'beer_nacional', sale_price: 7000, stock: 20 },
  { id: 'demo-46', name: 'Smirnoff', category: 'beer_nacional', sale_price: 12000, stock: 20 },
  { id: 'demo-47', name: 'Stella', category: 'beer_nacional', sale_price: 9000, stock: 20 },
  { id: 'demo-48', name: 'Tinto', category: 'beer_nacional', sale_price: 1500, stock: 20 },
  { id: 'demo-49', name: '1/2 Smirnof lulo', category: 'other', sale_price: 60000, stock: 20 },
  { id: 'demo-50', name: 'BONFIEST SOBRE', category: 'other', sale_price: 7000, stock: 20 },
  { id: 'demo-51', name: 'Cover', category: 'other', sale_price: 1000, stock: 20 },
  { id: 'demo-52', name: 'OTROS', category: 'other', sale_price: 1000, stock: 20 },
  { id: 'demo-53', name: 'Agua', category: 'agua', sale_price: 3000, stock: 20 },
  { id: 'demo-54', name: 'Soda', category: 'soda', sale_price: 5000, stock: 20 },
  { id: 'demo-55', name: '1/2 Cig', category: 'cigarros', sale_price: 9000, stock: 20 },
  { id: 'demo-56', name: 'Cig', category: 'cigarros', sale_price: 1300, stock: 20 },
];

const DEMO_COMBOS: DemoComboTemplate[] = [
  {
    id: 'combo-1',
    name: '2 Coronitas',
    description: '2 Coronita a precio de combo',
    basePrice: 8500,
    isPriceEditable: false,
    items: [{ productId: 'demo-25', quantity: 2, isSwappable: false }],
  },
  {
    id: 'combo-2',
    name: '4 Cervezas Surtidas',
    description: 'Elige 4 cervezas',
    basePrice: 16000,
    isPriceEditable: false,
    items: [{ productId: 'demo-39', quantity: 4, isSwappable: true }],
  },
  {
    id: 'combo-3',
    name: 'Combo Fiesta (6 cervezas)',
    description: 'Elige 6 cervezas, precio ajustable',
    basePrice: 24000,
    isPriceEditable: true,
    items: [{ productId: 'demo-39', quantity: 6, isSwappable: true }],
  },
];

function comboItemsTotal(combos: DemoCartCombo[]): number {
  return combos.reduce((sum, c) => sum + c.finalPrice, 0);
}

function tabTotal(tab: Pick<DemoTab, 'items' | 'combos'>): number {
  const itemsTotal = tab.items.reduce((sum, i) => sum + i.product.sale_price * i.quantity, 0);
  return itemsTotal + comboItemsTotal(tab.combos);
}

function tabPaid(tab: Pick<DemoTab, 'partialPayments'>): number {
  return tab.partialPayments.reduce((sum, p) => sum + p.amount, 0);
}

function fiadoPaid(fiado: Pick<DemoFiado, 'payments'>): number {
  return fiado.payments.reduce((sum, p) => sum + p.amount, 0);
}

// Junta items sueltos + productos dentro de combos en un solo mapa de cantidades
// por producto — así el descuento/devolución de stock trata todo por igual.
function resolvedQtyByProduct(items: DemoLineItem[], combos: DemoCartCombo[]): Record<string, number> {
  const qty: Record<string, number> = {};
  items.forEach((i) => {
    qty[i.product.id] = (qty[i.product.id] || 0) + i.quantity;
  });
  combos.forEach((c) => {
    c.items.forEach((i) => {
      qty[i.product.id] = (qty[i.product.id] || 0) + i.quantity;
    });
  });
  return qty;
}

interface DemoState {
  products: DemoProduct[];
  combos: DemoComboTemplate[];
  shift: DemoShift | null;
  tabs: DemoTab[];
  closedSales: DemoClosedSale[];
  fiados: DemoFiado[];
  observations: DemoObservation[];

  startShift: (type: 'day' | 'night', cashStart: number) => void;
  closeShift: () => void;

  // El modal de venta trabaja con listas locales de items y combos (el contenido
  // final deseado de la mesa) y esta acción las concilia contra el stock: crea la
  // mesa si existingTabId es null, o ajusta el stock por la diferencia si ya
  // existía. Igual efecto que "Guardar (Cuenta Abierta)" en /sales.
  upsertTab: (existingTabId: string | null, tableNumber: string, items: DemoLineItem[], combos: DemoCartCombo[]) => string;
  // Devuelve el stock de los items/combos de la mesa y la elimina — igual que "Descartar cuenta".
  discardTab: (tabId: string) => void;
  // Cierra y cobra la mesa completa (efectivo/transferencia/mixto) — igual que
  // "Dar la Cuenta" + "Confirmar Pago".
  closeTab: (
    tabId: string,
    payment: { method: PayMethod; cashAmount: number; transferAmount: number; cashChange: number }
  ) => void;
  // Cierra la mesa como fiado — igual que elegir método "Fiado" al cobrar.
  closeTabAsFiado: (tabId: string, customerName: string, abono: number) => void;
  // Venta rápida de mostrador (cigarrillos) — se cobra y cierra al instante,
  // sin pasar por el flujo de mesas. Igual que el botón "🚬 Cigarrillos" en /pos.
  sellMostrador: (counts: Record<string, number>, method: 'cash' | 'transfer') => void;
  // Abono parcial sobre una mesa TODAVÍA abierta — igual que "Pago Parcial" en /sales.
  addPartialPayment: (tabId: string, amount: number, method: PayMethod, cashAmount: number, transferAmount: number) => void;
  // Abono sobre un fiado ya cerrado — igual que "Registrar pago" en /fiados.
  addFiadoPayment: (fiadoId: string, amount: number, method: PayMethod, cashAmount: number, transferAmount: number) => void;
  // Observación ligada a una mesa puntual — igual que el campo de notas dentro
  // del modal de una cuenta abierta en /sales. Se guarda al instante, no espera
  // a "Guardar"/"Dar la Cuenta".
  addTabObservation: (tabId: string, text: string) => void;

  addObservation: (content: string) => void;
  deleteObservation: (id: string) => void;

  adjustStock: (productId: string, delta: number) => void;

  reset: () => void;
}

export const useDemoStore = create<DemoState>((set, get) => ({
  products: INITIAL_PRODUCTS,
  combos: DEMO_COMBOS,
  shift: null,
  tabs: [],
  closedSales: [],
  fiados: [],
  observations: [],

  startShift: (type, cashStart) => {
    set({ shift: { type, cashStart, startedAt: new Date().toISOString() } });
  },

  closeShift: () => {
    set({
      shift: null,
      tabs: [],
      closedSales: [],
      fiados: [],
      observations: [],
      products: INITIAL_PRODUCTS,
    });
  },

  upsertTab: (existingTabId, tableNumber, items, combos) => {
    const { tabs, products } = get();
    const cleanItems = items.filter((i) => i.quantity > 0);
    const cleanCombos = combos.filter((c) => c.items.length > 0);

    if (existingTabId) {
      const existingTab = tabs.find((t) => t.id === existingTabId);
      const oldQty = resolvedQtyByProduct(existingTab?.items || [], existingTab?.combos || []);
      const newQty = resolvedQtyByProduct(cleanItems, cleanCombos);
      // Delta positivo = se agregó (descuenta stock), negativo = se quitó (devuelve stock)
      const productIds = new Set([...Object.keys(oldQty), ...Object.keys(newQty)]);
      const updatedProducts = products.map((p) => {
        if (!productIds.has(p.id)) return p;
        const delta = (newQty[p.id] || 0) - (oldQty[p.id] || 0);
        return delta ? { ...p, stock: Math.max(0, p.stock - delta) } : p;
      });

      const updatedTabs = tabs.map((tab) =>
        tab.id === existingTabId ? { ...tab, items: cleanItems, combos: cleanCombos } : tab
      );
      set({ tabs: updatedTabs, products: updatedProducts });
      return existingTabId;
    }

    const newQty = resolvedQtyByProduct(cleanItems, cleanCombos);
    const updatedProducts = products.map((p) =>
      newQty[p.id] ? { ...p, stock: Math.max(0, p.stock - newQty[p.id]) } : p
    );

    const id = `tab-${Date.now()}`;
    const tab: DemoTab = {
      id,
      tableNumber: tableNumber.trim() || 'Sin número',
      items: cleanItems,
      combos: cleanCombos,
      partialPayments: [],
      tabObservations: [],
      createdAt: new Date().toISOString(),
    };
    set({ tabs: [...tabs, tab], products: updatedProducts });
    return id;
  },

  discardTab: (tabId) => {
    const { tabs, products } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    const restoreQty = resolvedQtyByProduct(tab.items, tab.combos);
    const updatedProducts = products.map((p) =>
      restoreQty[p.id] ? { ...p, stock: p.stock + restoreQty[p.id] } : p
    );

    set({ tabs: tabs.filter((t) => t.id !== tabId), products: updatedProducts });
  },

  closeTab: (tabId, payment) => {
    const { tabs, closedSales } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab || (tab.items.length === 0 && tab.combos.length === 0)) return;

    const closedSale: DemoClosedSale = {
      id: tab.id,
      tableNumber: tab.tableNumber,
      items: tab.items,
      combos: tab.combos,
      tabObservations: tab.tabObservations,
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

  closeTabAsFiado: (tabId, customerName, abono) => {
    const { tabs, fiados } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab || (tab.items.length === 0 && tab.combos.length === 0)) return;

    const total = tabTotal(tab);
    const alreadyPaid = tabPaid(tab); // pagos parciales previos, antes de fiar el resto
    const fiadoAmount = Math.max(0, total - alreadyPaid - abono);

    const fiado: DemoFiado = {
      id: tab.id,
      tableNumber: tab.tableNumber,
      customerName: customerName.trim() || 'Sin nombre',
      items: tab.items,
      combos: tab.combos,
      tabObservations: tab.tabObservations,
      total,
      fiadoAmount,
      abono,
      paid: fiadoAmount <= 0,
      payments: [],
      createdAt: new Date().toISOString(),
      paidAt: fiadoAmount <= 0 ? new Date().toISOString() : null,
    };

    set({
      tabs: tabs.filter((t) => t.id !== tabId),
      fiados: [...fiados, fiado],
    });
  },

  sellMostrador: (counts, method) => {
    const { products, closedSales } = get();
    const items: DemoLineItem[] = Object.entries(counts)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => {
        const product = products.find((p) => p.id === productId);
        return product ? { product, quantity: qty } : null;
      })
      .filter((i): i is DemoLineItem => i !== null);

    if (items.length === 0) return;

    const total = items.reduce((sum, i) => sum + i.product.sale_price * i.quantity, 0);
    const newQty: Record<string, number> = {};
    items.forEach((i) => {
      newQty[i.product.id] = (newQty[i.product.id] || 0) + i.quantity;
    });
    const updatedProducts = products.map((p) =>
      newQty[p.id] ? { ...p, stock: Math.max(0, p.stock - newQty[p.id]) } : p
    );

    const closedSale: DemoClosedSale = {
      id: `mostrador-${Date.now()}`,
      tableNumber: 'Mostrador',
      items,
      combos: [],
      tabObservations: [],
      total,
      paymentMethod: method,
      cashAmount: method === 'cash' ? total : 0,
      transferAmount: method === 'transfer' ? total : 0,
      cashChange: 0,
      closedAt: new Date().toISOString(),
    };

    set({ products: updatedProducts, closedSales: [...closedSales, closedSale] });
  },

  addPartialPayment: (tabId, amount, method, cashAmount, transferAmount) => {
    const { tabs } = get();
    if (amount <= 0) return;
    const payment: DemoPartialPayment = {
      id: `pp-${Date.now()}`,
      amount,
      method,
      cashAmount,
      transferAmount,
      createdAt: new Date().toISOString(),
    };
    set({
      tabs: tabs.map((t) =>
        t.id === tabId ? { ...t, partialPayments: [...t.partialPayments, payment] } : t
      ),
    });
  },

  addFiadoPayment: (fiadoId, amount, method, cashAmount, transferAmount) => {
    const { fiados } = get();
    if (amount <= 0) return;
    const payment: DemoPartialPayment = {
      id: `fp-${Date.now()}`,
      amount,
      method,
      cashAmount,
      transferAmount,
      createdAt: new Date().toISOString(),
    };
    set({
      fiados: fiados.map((f) => {
        if (f.id !== fiadoId) return f;
        const payments = [...f.payments, payment];
        const remaining = Math.max(0, f.fiadoAmount - fiadoPaid({ payments }));
        return { ...f, payments, paid: remaining <= 0, paidAt: remaining <= 0 ? new Date().toISOString() : null };
      }),
    });
  },

  addTabObservation: (tabId, text) => {
    if (!text.trim()) return;
    const { tabs } = get();
    const observation: DemoTabObservation = {
      id: `tobs-${Date.now()}`,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    set({
      tabs: tabs.map((t) =>
        t.id === tabId ? { ...t, tabObservations: [...t.tabObservations, observation] } : t
      ),
    });
  },

  addObservation: (content) => {
    if (!content.trim()) return;
    const { observations } = get();
    set({
      observations: [
        { id: `obs-${Date.now()}`, content: content.trim(), createdAt: new Date().toISOString() },
        ...observations,
      ],
    });
  },

  deleteObservation: (id) => {
    const { observations } = get();
    set({ observations: observations.filter((o) => o.id !== id) });
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
    set({
      products: INITIAL_PRODUCTS,
      shift: null,
      tabs: [],
      closedSales: [],
      fiados: [],
      observations: [],
    });
  },
}));

export { tabTotal, tabPaid, fiadoPaid, comboItemsTotal };
