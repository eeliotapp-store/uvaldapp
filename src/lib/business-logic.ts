/**
 * Lógica de negocio pura para el sistema de ventas
 * Estas funciones no tienen dependencias externas y son fáciles de testear
 */

// Constantes
export const MICHELADA_EXTRA = 4000;

// Tipos básicos para las funciones puras
export interface ProductForCalc {
  id: string;
  sale_price: number;
  name?: string;
}

export interface CartItemForCalc {
  product: ProductForCalc;
  quantity: number;
  isMichelada?: boolean;
}

export interface CartComboForCalc {
  finalPrice: number;
  items: { product: ProductForCalc; quantity: number; isMichelada?: boolean }[];
}

export interface StockMap {
  [productId: string]: number;
}

// ==========================================
// CÁLCULOS DE PRECIOS
// ==========================================

/**
 * Calcula el precio unitario de un item considerando michelada
 */
export function calculateItemUnitPrice(
  basePrice: number,
  isMichelada: boolean
): number {
  return basePrice + (isMichelada ? MICHELADA_EXTRA : 0);
}

/**
 * Calcula el subtotal de un item (precio * cantidad)
 */
export function calculateItemSubtotal(
  basePrice: number,
  quantity: number,
  isMichelada: boolean
): number {
  const unitPrice = calculateItemUnitPrice(basePrice, isMichelada);
  return unitPrice * quantity;
}

/**
 * Calcula el total de items individuales en el carrito
 */
export function calculateItemsTotal(items: CartItemForCalc[]): number {
  return items.reduce((sum, item) => {
    return sum + calculateItemSubtotal(
      item.product.sale_price,
      item.quantity,
      item.isMichelada || false
    );
  }, 0);
}

/**
 * Calcula el total de combos en el carrito
 */
export function calculateCombosTotal(combos: CartComboForCalc[]): number {
  return combos.reduce((sum, combo) => sum + combo.finalPrice, 0);
}

/**
 * Calcula el total general del carrito
 */
export function calculateCartTotal(
  items: CartItemForCalc[],
  combos: CartComboForCalc[]
): number {
  return calculateItemsTotal(items) + calculateCombosTotal(combos);
}

// ==========================================
// VALIDACIÓN DE STOCK
// ==========================================

export interface StockValidationResult {
  valid: boolean;
  errors: { productId: string; productName: string; required: number; available: number }[];
}

/**
 * Agrupa cantidades requeridas por producto
 */
export function aggregateProductQuantities(
  items: { product_id: string; quantity: number }[]
): Record<string, number> {
  const quantities: Record<string, number> = {};

  for (const item of items) {
    quantities[item.product_id] = (quantities[item.product_id] || 0) + item.quantity;
  }

  return quantities;
}

/**
 * Valida que hay suficiente stock para todos los productos
 */
export function validateStock(
  items: CartItemForCalc[],
  combos: CartComboForCalc[],
  stockMap: StockMap,
  productNames: Record<string, string> = {}
): StockValidationResult {
  // Recopilar todas las cantidades requeridas
  const allItems: { product_id: string; quantity: number }[] = [];

  // Items individuales
  for (const item of items) {
    allItems.push({ product_id: item.product.id, quantity: item.quantity });
  }

  // Items de combos
  for (const combo of combos) {
    for (const item of combo.items) {
      allItems.push({ product_id: item.product.id, quantity: item.quantity });
    }
  }

  // Agrupar por producto
  const required = aggregateProductQuantities(allItems);

  // Validar stock
  const errors: StockValidationResult['errors'] = [];

  for (const [productId, requiredQty] of Object.entries(required)) {
    const available = stockMap[productId] || 0;

    if (available < requiredQty) {
      errors.push({
        productId,
        productName: productNames[productId] || productId,
        required: requiredQty,
        available,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ==========================================
// DISTRIBUCIÓN DE COMBOS
// ==========================================

export interface SwappableDistribution {
  productId: string;
  quantity: number;
}

/**
 * Valida que la distribución de items intercambiables suma la cantidad correcta
 */
export function validateSwappableDistribution(
  distributions: SwappableDistribution[],
  totalRequired: number
): { valid: boolean; currentTotal: number; remaining: number } {
  const currentTotal = distributions.reduce((sum, d) => sum + d.quantity, 0);
  const remaining = totalRequired - currentTotal;

  return {
    valid: currentTotal === totalRequired,
    currentTotal,
    remaining,
  };
}

/**
 * Verifica que no hay productos duplicados en la distribución
 */
export function validateNoDuplicateProducts(
  distributions: SwappableDistribution[]
): { valid: boolean; duplicates: string[] } {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const dist of distributions) {
    if (seen.has(dist.productId)) {
      duplicates.push(dist.productId);
    }
    seen.add(dist.productId);
  }

  return {
    valid: duplicates.length === 0,
    duplicates,
  };
}

// ==========================================
// PREPARACIÓN DE SALE ITEMS
// ==========================================

export interface SaleItemInput {
  product_id: string;
  quantity: number;
  unit_price: number;
  is_michelada: boolean;
}

export interface ComboInput {
  combo_id: string;
  final_price: number;
  items: { product_id: string; quantity: number; is_michelada: boolean }[];
}

export interface PreparedSaleItem {
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  is_michelada: boolean;
  combo_id: string | null;
  combo_price_override: number | null;
}

/**
 * Prepara los items individuales para insertar en la BD
 */
export function prepareSaleItems(
  saleId: string,
  items: SaleItemInput[]
): PreparedSaleItem[] {
  return items.map(item => ({
    sale_id: saleId,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    subtotal: item.unit_price * item.quantity,
    is_michelada: item.is_michelada,
    combo_id: null,
    combo_price_override: null,
  }));
}

/**
 * Prepara los items de combos para insertar en la BD
 * El primer item del combo tiene el precio override
 */
export function prepareComboSaleItems(
  saleId: string,
  combos: ComboInput[]
): PreparedSaleItem[] {
  const result: PreparedSaleItem[] = [];

  for (const combo of combos) {
    const totalComboItems = combo.items.reduce((sum, i) => sum + i.quantity, 0);
    const pricePerItem = totalComboItems > 0 ? combo.final_price / totalComboItems : 0;

    let isFirstItem = true;

    for (const item of combo.items) {
      result.push({
        sale_id: saleId,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: pricePerItem,
        subtotal: pricePerItem * item.quantity,
        is_michelada: item.is_michelada,
        combo_id: combo.combo_id,
        combo_price_override: isFirstItem ? combo.final_price : null,
      });
      isFirstItem = false;
    }
  }

  return result;
}

/**
 * Calcula el nuevo total de una venta al agregar items
 */
export function calculateNewSaleTotal(
  currentTotal: number,
  items: SaleItemInput[],
  combos: ComboInput[]
): number {
  const itemsTotal = items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  );
  const combosTotal = combos.reduce(
    (sum, combo) => sum + combo.final_price,
    0
  );

  return currentTotal + itemsTotal + combosTotal;
}
