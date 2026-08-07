import { describe, it, expect } from 'vitest';
import { buildMonthCyclePayload } from './day-of-month';

describe('buildMonthCyclePayload', () => {
  it('siempre devuelve 31 días y 4 semanas, aunque no haya datos', () => {
    const result = buildMonthCyclePayload([], [], [], []);

    expect(result.by_day).toHaveLength(31);
    expect(result.by_day.map((d) => d.dom)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
    expect(result.by_week).toHaveLength(4);
    expect(result.by_week.map((w) => w.week_bucket)).toEqual([1, 2, 3, 4]);
  });

  it('calcula avg_revenue por día del mes (Cover: 5407000 / 5 = 1081400)', () => {
    const domRows = [{ dom: 15, sales_count: 218, revenue: 5407000 }];
    const domOccurrences = [{ dom: 15, day_count: 5 }];

    const result = buildMonthCyclePayload(domRows, domOccurrences, [], []);
    const day15 = result.by_day.find((d) => d.dom === 15)!;

    expect(day15.sales_count).toBe(218);
    expect(day15.avg_revenue).toBe(1081400);
    expect(day15.avg_sales_count).toBe(43.6); // 218 / 5 = 43.6
  });

  it('convierte revenue string (numeric de Postgres) a número sin explotar', () => {
    const domRows = [{ dom: 30, sales_count: 10, revenue: '250000.00' as unknown as number }];
    const domOccurrences = [{ dom: 30, day_count: 2 }];

    const result = buildMonthCyclePayload(domRows, domOccurrences, [], []);
    const day30 = result.by_day.find((d) => d.dom === 30)!;

    expect(day30.revenue).toBe(250000);
    expect(day30.avg_revenue).toBe(125000);
  });

  it('no explota al dividir entre 0 ocurrencias para un día sin histórico', () => {
    const result = buildMonthCyclePayload([], [], [], []);
    const day1 = result.by_day.find((d) => d.dom === 1)!;

    expect(day1.occurrences).toBe(0);
    expect(day1.avg_sales_count).toBe(0);
    expect(day1.avg_revenue).toBe(0);
  });

  it('calcula avg_revenue por semana del mes con su propia etiqueta', () => {
    const weekRows = [{ week_bucket: 3, sales_count: 912, revenue: 25098300 }];
    const weekOccurrences = [{ week_bucket: 3, month_count: 6 }];

    const result = buildMonthCyclePayload([], [], weekRows, weekOccurrences);
    const week3 = result.by_week.find((w) => w.week_bucket === 3)!;

    expect(week3.label).toBe('Semana 3 (15–21)');
    expect(week3.avg_revenue).toBe(4183050); // 25098300 / 6 = 4183050
  });

  it('la semana 4 absorbe la cola del mes (días 22-31) y su etiqueta lo refleja', () => {
    const weekRows = [{ week_bucket: 4, sales_count: 888, revenue: 21375401 }];
    const weekOccurrences = [{ week_bucket: 4, month_count: 6 }];

    const result = buildMonthCyclePayload([], [], weekRows, weekOccurrences);
    const week4 = result.by_week.find((w) => w.week_bucket === 4)!;

    expect(week4.label).toBe('Semana 4 (22–31)');
    expect(week4.avg_revenue).toBe(3562567); // 21375401 / 6 = 3562566.8... -> redondeado
  });
});
