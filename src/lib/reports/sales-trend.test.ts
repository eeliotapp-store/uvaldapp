import { describe, it, expect } from 'vitest';
import { computeTrend, buildSalesTrendPayload, MIN_UNITS_THRESHOLD } from './sales-trend';

describe('computeTrend', () => {
  it('marca "up" cuando sube más de 5% (Smirnoff 1 -> 6 = +500%)', () => {
    const trend = computeTrend(6, 1);
    expect(trend.status).toBe('up');
    expect(trend.pct_change).toBe(500);
  });

  it('marca "down" cuando baja más de 5%', () => {
    const trend = computeTrend(50, 100);
    expect(trend.status).toBe('down');
    expect(trend.pct_change).toBe(-50);
  });

  it('marca "flat" cuando el cambio está dentro de ±5%', () => {
    const trend = computeTrend(102, 100);
    expect(trend.status).toBe('flat');
    expect(trend.pct_change).toBe(2);
  });

  it('marca "flat" en el límite exacto de 5% (no es ni up ni down)', () => {
    const trend = computeTrend(105, 100);
    expect(trend.status).toBe('flat');
    expect(trend.pct_change).toBe(5);
  });

  it('marca "new" cuando no había nada antes y ahora sí (previous=0, current>0)', () => {
    const trend = computeTrend(10, 0);
    expect(trend.status).toBe('new');
    expect(trend.pct_change).toBeNull();
  });

  it('marca "stopped" cuando dejó de venderse (previous>0, current=0)', () => {
    const trend = computeTrend(0, 25);
    expect(trend.status).toBe('stopped');
    expect(trend.pct_change).toBe(-100);
  });

  it('marca "flat" con pct_change null cuando ambos son 0 (sin actividad en ningún período)', () => {
    const trend = computeTrend(0, 0);
    expect(trend.status).toBe('flat');
    expect(trend.pct_change).toBeNull();
  });

  it('redondea a un decimal (Club 12 -> 43 = +258.3%)', () => {
    const trend = computeTrend(43, 12);
    expect(trend.pct_change).toBe(258.3);
  });
});

describe('buildSalesTrendPayload', () => {
  const NOW = new Date('2026-07-31T12:00:00Z').getTime();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const daysAgo = (n: number) => new Date(NOW - n * DAY_MS).toISOString();

  it('clasifica ventas en semana actual (0-7 días) y semana anterior (8-14 días)', () => {
    const sales = [
      { id: 's1', created_at: daysAgo(2), total: 1000 }, // semana actual
      { id: 's2', created_at: daysAgo(10), total: 500 }, // semana anterior
      { id: 's3', created_at: daysAgo(50), total: 999 }, // fuera de ambas ventanas de semana
    ];

    const payload = buildSalesTrendPayload(sales, [], NOW);

    expect(payload.overall.week.current).toBe(1000);
    expect(payload.overall.week.previous).toBe(500);
  });

  it('clasifica ventas en mes actual (0-30 días) y mes anterior (31-60 días)', () => {
    const sales = [
      { id: 's1', created_at: daysAgo(15), total: 2000 }, // mes actual
      { id: 's2', created_at: daysAgo(45), total: 1500 }, // mes anterior
    ];

    const payload = buildSalesTrendPayload(sales, [], NOW);

    expect(payload.overall.month.current).toBe(2000);
    expect(payload.overall.month.previous).toBe(1500);
  });

  it('ignora ventas de más de 60 días — no entran ni al mes actual ni al anterior', () => {
    const sales = [
      { id: 's1', created_at: daysAgo(15), total: 2000 }, // mes actual
      { id: 's2', created_at: daysAgo(90), total: 777 }, // muy vieja, fuera de rango
    ];

    const payload = buildSalesTrendPayload(sales, [], NOW);

    expect(payload.overall.month.current).toBe(2000);
    expect(payload.overall.month.previous).toBe(0);
  });

  it('excluye del cálculo por producto los items sin venta asociada conocida', () => {
    const saleItems = [
      { sale_id: 'inexistente', product_id: 'p1', quantity: 5, products: { name: 'Fantasma' } },
    ];

    const payload = buildSalesTrendPayload([], saleItems, NOW);

    expect(payload.products.week).toHaveLength(0);
    expect(payload.products.month).toHaveLength(0);
  });

  it('filtra productos por debajo del umbral mínimo de unidades combinadas', () => {
    const sales = [
      { id: 's1', created_at: daysAgo(2), total: 100 },
      { id: 's2', created_at: daysAgo(10), total: 100 },
    ];
    const saleItems = [
      // 1 unidad ahora + 1 antes = 2 total, por debajo de MIN_UNITS_THRESHOLD (5)
      { sale_id: 's1', product_id: 'poco-vendido', quantity: 1, products: { name: 'Poco Vendido' } },
      { sale_id: 's2', product_id: 'poco-vendido', quantity: 1, products: { name: 'Poco Vendido' } },
    ];

    const payload = buildSalesTrendPayload(sales, saleItems, NOW);

    expect(MIN_UNITS_THRESHOLD).toBe(5);
    expect(payload.products.week.find((p) => p.product_name === 'Poco Vendido')).toBeUndefined();
  });

  it('agrega correctamente un producto que sí supera el umbral y calcula su tendencia', () => {
    const sales = [
      { id: 's1', created_at: daysAgo(2), total: 100 },
      { id: 's2', created_at: daysAgo(10), total: 100 },
    ];
    const saleItems = [
      { sale_id: 's1', product_id: 'club', quantity: 43, products: { name: 'Club' } },
      { sale_id: 's2', product_id: 'club', quantity: 12, products: { name: 'Club' } },
    ];

    const payload = buildSalesTrendPayload(sales, saleItems, NOW);
    const club = payload.products.week.find((p) => p.product_name === 'Club');

    expect(club).toBeDefined();
    expect(club!.current_units).toBe(43);
    expect(club!.previous_units).toBe(12);
    expect(club!.status).toBe('up');
  });

  it('maneja products como array (forma en que a veces lo infiere Supabase) igual que objeto', () => {
    const sales = [{ id: 's1', created_at: daysAgo(2), total: 100 }];
    const saleItems = [
      { sale_id: 's1', product_id: 'p1', quantity: 10, products: [{ name: 'Desde Array' }] },
    ];

    const payload = buildSalesTrendPayload(sales, saleItems, NOW);
    // 10 unidades ahora, 0 antes -> "new", no filtrado porque 10+0 >= 5
    expect(payload.products.week[0].product_name).toBe('Desde Array');
    expect(payload.products.week[0].status).toBe('new');
  });

  it('usa "Producto sin nombre" cuando products es null', () => {
    const sales = [{ id: 's1', created_at: daysAgo(2), total: 100 }];
    const saleItems = [{ sale_id: 's1', product_id: 'p1', quantity: 10, products: null }];

    const payload = buildSalesTrendPayload(sales, saleItems, NOW);
    expect(payload.products.week[0].product_name).toBe('Producto sin nombre');
  });

  it('ordena productos con pct_change null (nuevos) antes de los ordenados por porcentaje, salvo cuando se filtra explícitamente', () => {
    const sales = [
      { id: 's1', created_at: daysAgo(2), total: 100 },
      { id: 's2', created_at: daysAgo(10), total: 100 },
    ];
    const saleItems = [
      { sale_id: 's1', product_id: 'subiendo', quantity: 20, products: { name: 'Subiendo Poco' } },
      { sale_id: 's2', product_id: 'subiendo', quantity: 15, products: { name: 'Subiendo Poco' } },
      { sale_id: 's1', product_id: 'nuevo', quantity: 10, products: { name: 'Nuevo' } },
    ];

    const payload = buildSalesTrendPayload(sales, saleItems, NOW);
    // "Nuevo" tiene pct_change null (tratado como 999 al ordenar) -> va primero
    expect(payload.products.week[0].product_name).toBe('Nuevo');
  });
});
