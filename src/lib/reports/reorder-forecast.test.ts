import { describe, it, expect } from 'vitest';
import { buildReorderForecast, LOOKBACK_DAYS, TARGET_COVERAGE_DAYS, type StockRow } from './reorder-forecast';

describe('buildReorderForecast', () => {
  it('calcula velocidad diaria, días restantes y cantidad sugerida (caso Club: 106 unidades/30 días, stock 0)', () => {
    const stock: StockRow[] = [
      { product_id: 'club', product_name: 'Club', category: 'beer_nacional', current_stock: 0, min_stock: 24 },
    ];
    const units = new Map([['club', 106]]);

    const result = buildReorderForecast(stock, units);

    expect(result.products).toHaveLength(1);
    const club = result.products[0];
    expect(club.daily_velocity).toBe(3.53); // 106/30 = 3.5333... -> 3.53
    expect(club.days_remaining).toBe(0); // 0 stock / velocidad > 0 = 0 días
    expect(club.suggested_reorder).toBe(50); // ceil(14 * 3.5333 - 0) = ceil(49.47) = 50
  });

  it('nunca sugiere una cantidad negativa cuando ya hay más stock del colchón objetivo', () => {
    const stock: StockRow[] = [
      { product_id: 'p1', product_name: 'Sobrado', category: 'other', current_stock: 1000, min_stock: 10 },
    ];
    const units = new Map([['p1', 10]]); // velocidad baja: 10/30 ≈ 0.33/día

    const result = buildReorderForecast(stock, units);

    expect(result.products[0].suggested_reorder).toBe(0);
  });

  it('clasifica productos con stock pero sin ventas en 30 días como "sin movimiento"', () => {
    const stock: StockRow[] = [
      { product_id: 'p1', product_name: 'Estancado', category: 'other', current_stock: 15, min_stock: 5 },
    ];

    const result = buildReorderForecast(stock, new Map());

    expect(result.products).toHaveLength(0);
    expect(result.products_without_recent_sales).toHaveLength(1);
    expect(result.products_without_recent_sales[0].product_name).toBe('Estancado');
  });

  it('NO incluye en "sin movimiento" productos con 0 stock y 0 ventas (no hay nada que reordenar ni revisar)', () => {
    const stock: StockRow[] = [
      { product_id: 'p1', product_name: 'Descontinuado', category: 'other', current_stock: 0, min_stock: 5 },
    ];

    const result = buildReorderForecast(stock, new Map());

    expect(result.products).toHaveLength(0);
    expect(result.products_without_recent_sales).toHaveLength(0);
  });

  it('ordena los productos con movimiento por días restantes ascendente (más urgente primero)', () => {
    const stock: StockRow[] = [
      { product_id: 'lento', product_name: 'Se acaba en 20 días', category: 'other', current_stock: 20, min_stock: 5 },
      { product_id: 'urgente', product_name: 'Se acaba mañana', category: 'other', current_stock: 1, min_stock: 5 },
    ];
    const units = new Map([
      ['lento', 30], // 1/día -> 20 días restantes
      ['urgente', 30], // 1/día -> 1 día restante
    ]);

    const result = buildReorderForecast(stock, units);

    expect(result.products.map((p) => p.product_name)).toEqual(['Se acaba mañana', 'Se acaba en 20 días']);
  });

  it('ordena "sin movimiento" alfabéticamente', () => {
    const stock: StockRow[] = [
      { product_id: 'b', product_name: 'Zeta', category: 'other', current_stock: 5, min_stock: 1 },
      { product_id: 'a', product_name: 'Alfa', category: 'other', current_stock: 5, min_stock: 1 },
    ];

    const result = buildReorderForecast(stock, new Map());

    expect(result.products_without_recent_sales.map((p) => p.product_name)).toEqual(['Alfa', 'Zeta']);
  });

  it('expone las constantes de configuración en el payload', () => {
    const result = buildReorderForecast([], new Map());
    expect(result.lookback_days).toBe(LOOKBACK_DAYS);
    expect(result.target_coverage_days).toBe(TARGET_COVERAGE_DAYS);
    expect(LOOKBACK_DAYS).toBe(30);
    expect(TARGET_COVERAGE_DAYS).toBe(14);
  });
});
