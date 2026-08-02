import { describe, it, expect } from 'vitest';
import { buildBucket, type ConcentrationSaleItemRow } from './revenue-concentration';

function item(overrides: Partial<ConcentrationSaleItemRow>): ConcentrationSaleItemRow {
  return {
    sale_id: 's1',
    product_id: 'p1',
    quantity: 1,
    subtotal: 0,
    combo_id: null,
    combo_price_override: null,
    is_michelada: false,
    is_bomba: false,
    products: { name: 'Producto' },
    combos: null,
    ...overrides,
  };
}

describe('buildBucket', () => {
  it('calcula % del total y % acumulado correctamente (caso real: Aguila 27.7%, Coronita 17.3% -> acum 45.1%)', () => {
    const items = [
      item({ product_id: 'aguila', subtotal: 6008000, products: { name: 'Aguila' } }),
      item({ product_id: 'coronita', subtotal: 3755000, products: { name: 'Coronita' } }),
      item({ product_id: 'otros', subtotal: 12000000, products: { name: 'Otros' } }),
    ];

    const bucket = buildBucket(items);

    expect(bucket.total_revenue).toBe(21763000);
    expect(bucket.items[0].product_name).toBe('Otros'); // el de mayor ingreso va primero
    const aguila = bucket.items.find((i) => i.product_name === 'Aguila')!;
    expect(aguila.pct_of_total).toBe(27.6); // 6008000/21763000*100 = 27.6...
  });

  it('un combo suma su propio precio (combo_price_override), no el subtotal de sus componentes sueltos', () => {
    const items = [
      // Combo de 2 items: solo el primero trae el combo_price_override (igual que prepareComboSaleItems)
      item({ product_id: 'corona', combo_id: 'combo-1', combo_price_override: 12000, subtotal: 6000, products: { name: 'Corona' }, combos: { name: 'Combo Michelada x2' } }),
      item({ product_id: 'corona', combo_id: 'combo-1', combo_price_override: null, subtotal: 6000, products: { name: 'Corona' }, combos: { name: 'Combo Michelada x2' } }),
    ];

    const bucket = buildBucket(items);

    expect(bucket.items).toHaveLength(1);
    expect(bucket.items[0].product_name).toBe('Combo Michelada x2');
    expect(bucket.items[0].revenue).toBe(12000); // no 12000 + 6000 + 6000
  });

  it('agrupa michelada y bomba como variantes separadas del mismo producto', () => {
    const items = [
      item({ product_id: 'corona', subtotal: 5000, is_michelada: false, products: { name: 'Corona' } }),
      item({ product_id: 'corona', subtotal: 9000, is_michelada: true, products: { name: 'Corona' } }),
    ];

    const bucket = buildBucket(items);

    expect(bucket.items).toHaveLength(2);
    expect(bucket.items.map((i) => i.product_name).sort()).toEqual(['Corona', 'Corona (Michelada)']);
  });

  it('agrupa la variante "Bomba" por separado, igual que Michelada', () => {
    const items = [
      item({ product_id: 'aguila', subtotal: 4000, is_bomba: false, products: { name: 'Aguila' } }),
      item({ product_id: 'aguila', subtotal: 6000, is_bomba: true, products: { name: 'Aguila' } }),
    ];

    const bucket = buildBucket(items);

    expect(bucket.items.map((i) => i.product_name).sort()).toEqual(['Aguila', 'Aguila (Bomba)']);
  });

  it('calcula products_for_50pct: cuenta cuántos productos, en orden, hacen falta para llegar a 50%', () => {
    const items = [
      item({ product_id: 'a', subtotal: 500, products: { name: 'A' } }), // 50%
      item({ product_id: 'b', subtotal: 300, products: { name: 'B' } }), // 30%
      item({ product_id: 'c', subtotal: 200, products: { name: 'C' } }), // 20%
    ];

    const bucket = buildBucket(items);

    // A solo ya llega exactamente a 50% -> 1 producto
    expect(bucket.products_for_50pct).toBe(1);
    // A + B = 80% -> 2 productos
    expect(bucket.products_for_80pct).toBe(2);
  });

  it('si nunca se cruza el umbral (todo con revenue 0 o vacío), products_for_Npct cae al total de items', () => {
    const bucket = buildBucket([]);
    expect(bucket.products_for_50pct).toBe(0);
    expect(bucket.products_for_80pct).toBe(0);
    expect(bucket.total_revenue).toBe(0);
    expect(bucket.items).toHaveLength(0);
  });

  it('excluye productos con revenue 0 o negativo del listado (no aportan ingreso real)', () => {
    const items = [
      item({ product_id: 'valido', subtotal: 1000, products: { name: 'Valido' } }),
      item({ product_id: 'gratis', subtotal: 0, products: { name: 'Gratis' } }),
    ];

    const bucket = buildBucket(items);

    expect(bucket.items).toHaveLength(1);
    expect(bucket.items[0].product_name).toBe('Valido');
  });

  it('maneja products/combos como array (forma en que a veces lo infiere Supabase)', () => {
    const items = [
      item({ product_id: 'p1', subtotal: 1000, products: [{ name: 'Desde Array' }] }),
    ];

    const bucket = buildBucket(items);
    expect(bucket.items[0].product_name).toBe('Desde Array');
  });

  it('usa "Producto" o "Combo" como nombre por defecto cuando falta la relación', () => {
    const items = [
      item({ product_id: 'sin-nombre', subtotal: 1000, products: null }),
      item({ product_id: 'combo-sin-nombre', combo_id: 'c1', combo_price_override: 5000, combos: null }),
    ];

    const bucket = buildBucket(items);
    const names = bucket.items.map((i) => i.product_name);
    expect(names).toContain('Producto');
    expect(names).toContain('Combo');
  });
});
