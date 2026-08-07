import { describe, it, expect } from 'vitest';
import { buildDayOfWeekPayload, DAY_NAMES, TOP_PRODUCTS_PER_DAY } from './day-of-week';

describe('buildDayOfWeekPayload', () => {
  it('ordena el resumen general de lunes a domingo, no de domingo(0) a sábado(6)', () => {
    const overall = [0, 1, 2, 3, 4, 5, 6].map((dow) => ({ dow, sales_count: dow + 1, revenue: 0 }));
    const occurrences = [0, 1, 2, 3, 4, 5, 6].map((dow) => ({ dow, day_count: 1 }));

    const result = buildDayOfWeekPayload(overall, [], occurrences);

    expect(result.overall.map((d) => d.dow)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(result.overall.map((d) => d.day_name)).toEqual([
      'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo',
    ]);
  });

  it('calcula el promedio por ocurrencia correctamente (Cover: 135 unidades / 19 sábados = 7.1)', () => {
    const overall = [{ dow: 6, sales_count: 100, revenue: 0 }];
    const occurrences = [{ dow: 6, day_count: 19 }];

    const result = buildDayOfWeekPayload(overall, [], occurrences);
    const saturday = result.overall.find((d) => d.dow === 6)!;

    expect(saturday.avg_sales_count).toBe(5.3); // 100 / 19 = 5.263... -> 5.3
  });

  it('calcula avg_revenue (plata promedio por ocurrencia) y no explota al dividir entre 0', () => {
    const overall = [{ dow: 6, sales_count: 100, revenue: 1350000 }];
    const occurrences = [{ dow: 6, day_count: 19 }];

    const result = buildDayOfWeekPayload(overall, [], occurrences);
    const saturday = result.overall.find((d) => d.dow === 6)!;

    expect(saturday.revenue).toBe(1350000);
    expect(saturday.avg_revenue).toBe(71053); // 1350000 / 19 = 71052.6... -> redondeado

    const withoutOccurrences = buildDayOfWeekPayload(overall, [], []);
    expect(withoutOccurrences.overall.find((d) => d.dow === 6)!.avg_revenue).toBe(0);
  });

  it('devuelve 0 ocurrencias y 0 promedio para un día sin datos históricos', () => {
    const result = buildDayOfWeekPayload([], [], []);
    const monday = result.overall.find((d) => d.dow === 1)!;

    expect(monday.occurrences).toBe(0);
    expect(monday.sales_count).toBe(0);
    expect(monday.avg_sales_count).toBe(0);
    expect(monday.avg_revenue).toBe(0);
  });

  it('calcula avg_units por producto y no explota al dividir entre 0 ocurrencias', () => {
    const products = [
      { product_name: 'Corona Extra', dow: 5, day_units: 46, day_revenue: 414000, pct_of_total: 42.2, total_units: 109 },
    ];

    const withOccurrences = buildDayOfWeekPayload([], products, [{ dow: 5, day_count: 17 }]);
    expect(withOccurrences.products_by_day[5][0].avg_units).toBe(2.7); // 46 / 17 = 2.70...

    const withoutOccurrences = buildDayOfWeekPayload([], products, []);
    expect(withoutOccurrences.products_by_day[5][0].avg_units).toBe(0);
  });

  it('selecciona los productos de cada día por pct_of_total descendente (sin ocurrencias, avg_units empata en 0 y no reordena)', () => {
    const products = [
      { product_name: 'Bajo', dow: 5, day_units: 1, day_revenue: 1000, pct_of_total: 10, total_units: 10 },
      { product_name: 'Alto', dow: 5, day_units: 5, day_revenue: 5000, pct_of_total: 42.2, total_units: 20 },
      { product_name: 'Medio', dow: 5, day_units: 3, day_revenue: 3000, pct_of_total: 25, total_units: 15 },
    ];

    const result = buildDayOfWeekPayload([], products, []);

    expect(result.products_by_day[5].map((p) => p.product_name)).toEqual(['Alto', 'Medio', 'Bajo']);
  });

  it('despliega los productos de cada día por avg_units descendente (no por pct_of_total)', () => {
    const products = [
      // "Bajo %" tiene menor pct_of_total pero, por tener más ocurrencias, termina con mayor promedio.
      { product_name: 'Alto %, bajo promedio', dow: 5, day_units: 10, day_revenue: 10000, pct_of_total: 50, total_units: 20 },
      { product_name: 'Bajo %, alto promedio', dow: 5, day_units: 90, day_revenue: 90000, pct_of_total: 20, total_units: 450 },
    ];
    const occurrences = [{ dow: 5, day_count: 10 }];

    const result = buildDayOfWeekPayload([], products, occurrences);

    // Selección: por pct_of_total, "Alto %..." queda primero en el arreglo intermedio.
    // Pero el orden final de despliegue debe ser por avg_units: 90/10=9 > 10/10=1.
    expect(result.products_by_day[5].map((p) => p.product_name)).toEqual([
      'Bajo %, alto promedio',
      'Alto %, bajo promedio',
    ]);
    expect(result.products_by_day[5][0].avg_units).toBe(9);
    expect(result.products_by_day[5][1].avg_units).toBe(1);
  });

  it('recorta a TOP_PRODUCTS_PER_DAY productos por día', () => {
    const products = Array.from({ length: TOP_PRODUCTS_PER_DAY + 10 }, (_, i) => ({
      product_name: `Producto ${i}`,
      dow: 6,
      day_units: i + 1,
      day_revenue: (i + 1) * 1000,
      pct_of_total: i + 1, // el más grande queda de último en el input, pero se reordena
      total_units: (i + 1) * 5,
    }));

    const result = buildDayOfWeekPayload([], products, []);

    expect(result.products_by_day[6]).toHaveLength(TOP_PRODUCTS_PER_DAY);
    // El de mayor pct_of_total (el último generado) debe quedar primero tras ordenar
    expect(result.products_by_day[6][0].product_name).toBe(`Producto ${TOP_PRODUCTS_PER_DAY + 9}`);
  });

  it('separa productos por día correctamente (uno no contamina el arreglo de otro día)', () => {
    const products = [
      { product_name: 'Solo viernes', dow: 5, day_units: 10, day_revenue: 10000, pct_of_total: 30, total_units: 30 },
      { product_name: 'Solo sábado', dow: 6, day_units: 20, day_revenue: 20000, pct_of_total: 40, total_units: 40 },
    ];

    const result = buildDayOfWeekPayload([], products, []);

    expect(result.products_by_day[5]).toHaveLength(1);
    expect(result.products_by_day[6]).toHaveLength(1);
    expect(result.products_by_day[0]).toHaveLength(0);
    expect(DAY_NAMES[5]).toBe('Viernes');
  });

  it('siempre incluye las 7 llaves de día en products_by_day, aunque no haya datos', () => {
    const result = buildDayOfWeekPayload([], [], []);
    expect(Object.keys(result.products_by_day).map(Number).sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});
