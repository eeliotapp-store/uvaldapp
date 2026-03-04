import { describe, it, expect } from 'vitest';
import {
  MICHELADA_EXTRA,
  calculateItemUnitPrice,
  calculateItemSubtotal,
  calculateItemsTotal,
  calculateCombosTotal,
  calculateCartTotal,
  aggregateProductQuantities,
  validateStock,
  validateSwappableDistribution,
  validateNoDuplicateProducts,
  prepareSaleItems,
  prepareComboSaleItems,
  calculateNewSaleTotal,
  type CartItemForCalc,
  type CartComboForCalc,
  type StockMap,
} from './business-logic';

// ==========================================
// CÁLCULOS DE MICHELADA
// ==========================================

describe('Cálculos de Michelada', () => {
  describe('calculateItemUnitPrice', () => {
    it('devuelve precio base cuando no es michelada', () => {
      expect(calculateItemUnitPrice(5000, false)).toBe(5000);
    });

    it('suma MICHELADA_EXTRA cuando es michelada', () => {
      expect(calculateItemUnitPrice(5000, true)).toBe(5000 + MICHELADA_EXTRA);
      expect(calculateItemUnitPrice(5000, true)).toBe(9000); // 5000 + 4000
    });

    it('MICHELADA_EXTRA es 4000', () => {
      expect(MICHELADA_EXTRA).toBe(4000);
    });
  });

  describe('calculateItemSubtotal', () => {
    it('calcula subtotal sin michelada', () => {
      // Corona $5,000 x 3 = $15,000
      expect(calculateItemSubtotal(5000, 3, false)).toBe(15000);
    });

    it('calcula subtotal con michelada', () => {
      // Corona michelada $9,000 x 2 = $18,000
      expect(calculateItemSubtotal(5000, 2, true)).toBe(18000);
    });

    it('maneja cantidad 1', () => {
      expect(calculateItemSubtotal(6000, 1, false)).toBe(6000);
      expect(calculateItemSubtotal(6000, 1, true)).toBe(10000);
    });
  });
});

// ==========================================
// CÁLCULOS DE CARRITO
// ==========================================

describe('Cálculos de Carrito', () => {
  const corona: CartItemForCalc['product'] = { id: '1', sale_price: 5000, name: 'Corona' };
  const stella: CartItemForCalc['product'] = { id: '2', sale_price: 8000, name: 'Stella' };

  describe('calculateItemsTotal', () => {
    it('devuelve 0 para carrito vacío', () => {
      expect(calculateItemsTotal([])).toBe(0);
    });

    it('calcula total de un item sin michelada', () => {
      const items: CartItemForCalc[] = [
        { product: corona, quantity: 2, isMichelada: false },
      ];
      expect(calculateItemsTotal(items)).toBe(10000); // 5000 * 2
    });

    it('calcula total de un item con michelada', () => {
      const items: CartItemForCalc[] = [
        { product: corona, quantity: 2, isMichelada: true },
      ];
      expect(calculateItemsTotal(items)).toBe(18000); // 9000 * 2
    });

    it('calcula total mixto de items', () => {
      const items: CartItemForCalc[] = [
        { product: corona, quantity: 2, isMichelada: false }, // 10,000
        { product: corona, quantity: 1, isMichelada: true },  // 9,000
        { product: stella, quantity: 1, isMichelada: false }, // 8,000
      ];
      expect(calculateItemsTotal(items)).toBe(27000);
    });
  });

  describe('calculateCombosTotal', () => {
    it('devuelve 0 para lista vacía', () => {
      expect(calculateCombosTotal([])).toBe(0);
    });

    it('calcula total de combos', () => {
      const combos: CartComboForCalc[] = [
        { finalPrice: 12000, items: [] }, // 2 coronitas micheladas
        { finalPrice: 85000, items: [] }, // Botella con descuento
      ];
      expect(calculateCombosTotal(combos)).toBe(97000);
    });
  });

  describe('calculateCartTotal', () => {
    it('suma items y combos correctamente', () => {
      const items: CartItemForCalc[] = [
        { product: corona, quantity: 2, isMichelada: true }, // 18,000
      ];
      const combos: CartComboForCalc[] = [
        { finalPrice: 65000, items: [] }, // Media botella
      ];
      expect(calculateCartTotal(items, combos)).toBe(83000);
    });

    it('funciona solo con items', () => {
      const items: CartItemForCalc[] = [
        { product: stella, quantity: 3, isMichelada: false }, // 24,000
      ];
      expect(calculateCartTotal(items, [])).toBe(24000);
    });

    it('funciona solo con combos', () => {
      const combos: CartComboForCalc[] = [
        { finalPrice: 19000, items: [] }, // 4 coronitas
      ];
      expect(calculateCartTotal([], combos)).toBe(19000);
    });
  });
});

// ==========================================
// VALIDACIÓN DE STOCK
// ==========================================

describe('Validación de Stock', () => {
  describe('aggregateProductQuantities', () => {
    it('agrupa cantidades por producto', () => {
      const items = [
        { product_id: 'corona', quantity: 2 },
        { product_id: 'stella', quantity: 1 },
        { product_id: 'corona', quantity: 3 }, // otra corona
      ];
      const result = aggregateProductQuantities(items);
      expect(result).toEqual({
        corona: 5,
        stella: 1,
      });
    });

    it('devuelve objeto vacío para lista vacía', () => {
      expect(aggregateProductQuantities([])).toEqual({});
    });
  });

  describe('validateStock', () => {
    const stockMap: StockMap = {
      corona: 10,
      stella: 5,
      aguila: 3,
    };

    const productNames = {
      corona: 'Corona Extra',
      stella: 'Stella Artois',
      aguila: 'Aguila Light',
    };

    it('valida correctamente cuando hay suficiente stock', () => {
      const items: CartItemForCalc[] = [
        { product: { id: 'corona', sale_price: 5000 }, quantity: 5 },
        { product: { id: 'stella', sale_price: 8000 }, quantity: 3 },
      ];

      const result = validateStock(items, [], stockMap, productNames);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detecta stock insuficiente', () => {
      const items: CartItemForCalc[] = [
        { product: { id: 'corona', sale_price: 5000 }, quantity: 15 }, // Solo hay 10
      ];

      const result = validateStock(items, [], stockMap, productNames);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        productId: 'corona',
        productName: 'Corona Extra',
        required: 15,
        available: 10,
      });
    });

    it('considera items de combos en la validación', () => {
      const items: CartItemForCalc[] = [
        { product: { id: 'corona', sale_price: 5000 }, quantity: 8 },
      ];
      const combos: CartComboForCalc[] = [
        {
          finalPrice: 65000,
          items: [
            { product: { id: 'corona', sale_price: 5000 }, quantity: 3 }, // 8 + 3 = 11 > 10
          ],
        },
      ];

      const result = validateStock(items, combos, stockMap, productNames);
      expect(result.valid).toBe(false);
      expect(result.errors[0].required).toBe(11);
      expect(result.errors[0].available).toBe(10);
    });

    it('valida múltiples productos con stock insuficiente', () => {
      const items: CartItemForCalc[] = [
        { product: { id: 'corona', sale_price: 5000 }, quantity: 20 },
        { product: { id: 'aguila', sale_price: 4500 }, quantity: 10 },
      ];

      const result = validateStock(items, [], stockMap, productNames);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });
});

// ==========================================
// DISTRIBUCIÓN DE COMBOS INTERCAMBIABLES
// ==========================================

describe('Distribución de Combos Intercambiables', () => {
  describe('validateSwappableDistribution', () => {
    it('valida cuando la suma es correcta', () => {
      // Combo de 3 cervezas: 2 Corona + 1 Aguila
      const distributions = [
        { productId: 'corona', quantity: 2 },
        { productId: 'aguila', quantity: 1 },
      ];
      const result = validateSwappableDistribution(distributions, 3);
      expect(result.valid).toBe(true);
      expect(result.currentTotal).toBe(3);
      expect(result.remaining).toBe(0);
    });

    it('detecta cuando faltan unidades', () => {
      // Solo 2 de 3 seleccionadas
      const distributions = [
        { productId: 'corona', quantity: 2 },
      ];
      const result = validateSwappableDistribution(distributions, 3);
      expect(result.valid).toBe(false);
      expect(result.currentTotal).toBe(2);
      expect(result.remaining).toBe(1);
    });

    it('detecta cuando hay demasiadas unidades', () => {
      const distributions = [
        { productId: 'corona', quantity: 3 },
        { productId: 'stella', quantity: 2 },
      ];
      const result = validateSwappableDistribution(distributions, 3);
      expect(result.valid).toBe(false);
      expect(result.currentTotal).toBe(5);
      expect(result.remaining).toBe(-2);
    });

    it('permite distribución variada', () => {
      // 3 cervezas diferentes
      const distributions = [
        { productId: 'corona', quantity: 1 },
        { productId: 'stella', quantity: 1 },
        { productId: 'aguila', quantity: 1 },
      ];
      const result = validateSwappableDistribution(distributions, 3);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateNoDuplicateProducts', () => {
    it('pasa cuando no hay duplicados', () => {
      const distributions = [
        { productId: 'corona', quantity: 2 },
        { productId: 'stella', quantity: 1 },
      ];
      const result = validateNoDuplicateProducts(distributions);
      expect(result.valid).toBe(true);
      expect(result.duplicates).toHaveLength(0);
    });

    it('detecta duplicados', () => {
      const distributions = [
        { productId: 'corona', quantity: 1 },
        { productId: 'stella', quantity: 1 },
        { productId: 'corona', quantity: 1 }, // Duplicado
      ];
      const result = validateNoDuplicateProducts(distributions);
      expect(result.valid).toBe(false);
      expect(result.duplicates).toContain('corona');
    });
  });
});

// ==========================================
// PREPARACIÓN DE SALE ITEMS
// ==========================================

describe('Preparación de Sale Items', () => {
  describe('prepareSaleItems', () => {
    it('prepara items individuales correctamente', () => {
      const items = [
        { product_id: 'corona', quantity: 2, unit_price: 5000, is_michelada: false },
        { product_id: 'stella', quantity: 1, unit_price: 12000, is_michelada: true },
      ];

      const result = prepareSaleItems('sale-123', items);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        sale_id: 'sale-123',
        product_id: 'corona',
        quantity: 2,
        unit_price: 5000,
        subtotal: 10000,
        is_michelada: false,
        combo_id: null,
        combo_price_override: null,
      });
      expect(result[1].subtotal).toBe(12000); // 12000 * 1
    });
  });

  describe('prepareComboSaleItems', () => {
    it('prepara items de combo con precio distribuido', () => {
      const combos = [
        {
          combo_id: 'combo-1',
          final_price: 12000,
          items: [
            { product_id: 'corona', quantity: 2, is_michelada: true },
          ],
        },
      ];

      const result = prepareComboSaleItems('sale-123', combos);

      expect(result).toHaveLength(1);
      expect(result[0].combo_id).toBe('combo-1');
      expect(result[0].combo_price_override).toBe(12000); // Primer item tiene el override
      expect(result[0].unit_price).toBe(6000); // 12000 / 2
      expect(result[0].subtotal).toBe(12000); // 6000 * 2
    });

    it('solo el primer item tiene combo_price_override', () => {
      const combos = [
        {
          combo_id: 'combo-2',
          final_price: 65000,
          items: [
            { product_id: 'aguardiente', quantity: 1, is_michelada: false },
            { product_id: 'corona', quantity: 2, is_michelada: false },
            { product_id: 'stella', quantity: 1, is_michelada: false },
          ],
        },
      ];

      const result = prepareComboSaleItems('sale-123', combos);

      expect(result).toHaveLength(3);
      expect(result[0].combo_price_override).toBe(65000); // Primer item
      expect(result[1].combo_price_override).toBeNull();
      expect(result[2].combo_price_override).toBeNull();

      // Precio distribuido: 65000 / 4 items = 16250 por item
      expect(result[0].unit_price).toBe(16250);
      expect(result[1].unit_price).toBe(16250);
    });
  });

  describe('calculateNewSaleTotal', () => {
    it('suma total actual más items nuevos', () => {
      const currentTotal = 50000;
      const items = [
        { product_id: 'corona', quantity: 2, unit_price: 5000, is_michelada: false },
      ];
      const combos = [
        {
          combo_id: 'c1',
          final_price: 12000,
          items: [],
        },
      ];

      const result = calculateNewSaleTotal(currentTotal, items, combos);
      expect(result).toBe(50000 + 10000 + 12000); // 72000
    });

    it('funciona con total inicial de 0', () => {
      const items = [
        { product_id: 'stella', quantity: 1, unit_price: 8000, is_michelada: false },
      ];
      const result = calculateNewSaleTotal(0, items, []);
      expect(result).toBe(8000);
    });
  });
});

// ==========================================
// CASOS DE USO REALES
// ==========================================

describe('Casos de Uso Reales', () => {
  it('Caso: 2 Coronitas Micheladas (combo fijo $12,000)', () => {
    const combo: CartComboForCalc = {
      finalPrice: 12000,
      items: [
        { product: { id: 'corona', sale_price: 5000 }, quantity: 2, isMichelada: true },
      ],
    };

    expect(calculateCartTotal([], [combo])).toBe(12000);
  });

  it('Caso: Botella + 3 cervezas con precio ajustado a $85,000', () => {
    const combo: CartComboForCalc = {
      finalPrice: 85000, // Rebajado de 95000
      items: [
        { product: { id: 'botella', sale_price: 80000 }, quantity: 1 },
        { product: { id: 'corona', sale_price: 5000 }, quantity: 2 },
        { product: { id: 'aguila', sale_price: 4500 }, quantity: 1 },
      ],
    };

    expect(calculateCartTotal([], [combo])).toBe(85000);
  });

  it('Caso: Corona normal + Corona michelada (mismo producto, diferente precio)', () => {
    const items: CartItemForCalc[] = [
      { product: { id: 'corona', sale_price: 5000 }, quantity: 1, isMichelada: false },
      { product: { id: 'corona', sale_price: 5000 }, quantity: 1, isMichelada: true },
    ];

    expect(calculateItemsTotal(items)).toBe(5000 + 9000); // 14000
  });

  it('Caso: Validar stock para combo de 3 cervezas distribuidas', () => {
    const stockMap: StockMap = {
      corona: 2,
      aguila: 3,
      stella: 1,
    };

    // Combo con 2 Corona + 1 Aguila (válido)
    const combosValid: CartComboForCalc[] = [
      {
        finalPrice: 65000,
        items: [
          { product: { id: 'corona', sale_price: 5000 }, quantity: 2 },
          { product: { id: 'aguila', sale_price: 4500 }, quantity: 1 },
        ],
      },
    ];

    expect(validateStock([], combosValid, stockMap).valid).toBe(true);

    // Combo con 3 Corona (inválido, solo hay 2)
    const combosInvalid: CartComboForCalc[] = [
      {
        finalPrice: 65000,
        items: [
          { product: { id: 'corona', sale_price: 5000 }, quantity: 3 },
        ],
      },
    ];

    const result = validateStock([], combosInvalid, stockMap);
    expect(result.valid).toBe(false);
    expect(result.errors[0].required).toBe(3);
    expect(result.errors[0].available).toBe(2);
  });
});
