import { describe, it, expect } from 'vitest';
import { buildEmployeeReport, type EmployeeShiftRow, type EmployeeSaleRow, type EmployeeSaleItemRow } from './employees';

describe('buildEmployeeReport', () => {
  it('agrega turnos, ventas y unidades correctamente para una sola empleada (caso real: Natalia)', () => {
    const shifts: EmployeeShiftRow[] = [
      { id: 'sh1', type: 'day', start_time: '2026-07-18T17:02:56+00:00', employee_id: 'natalia', employees: { id: 'natalia', name: 'Natalia' } },
      { id: 'sh2', type: 'night', start_time: '2026-07-19T01:00:00+00:00', employee_id: 'natalia', employees: { id: 'natalia', name: 'Natalia' } },
    ];
    const sales: EmployeeSaleRow[] = [
      { id: 'v1', total: 538100, payment_method: 'mixed', cash_amount: 312500, transfer_amount: 225600, shift_id: 'sh1' },
    ];
    const saleItems: EmployeeSaleItemRow[] = [
      { sale_id: 'v1', quantity: 50, unit_price: 4000, products: { name: 'Aguila' } },
    ];

    const result = buildEmployeeReport(shifts, sales, saleItems);

    expect(result).toHaveLength(1);
    const natalia = result[0];
    expect(natalia.employee_name).toBe('Natalia');
    expect(natalia.shifts_count).toBe(2); // ambos turnos cuentan, aunque sh2 no tuvo ventas
    expect(natalia.transactions_count).toBe(1);
    expect(natalia.total_sales).toBe(538100);
    expect(natalia.total_units).toBe(50);
  });

  it('anida los productos dentro del turno correspondiente, no mezclados entre turnos', () => {
    const shifts: EmployeeShiftRow[] = [
      { id: 'sh1', type: 'day', start_time: '2026-07-01T12:00:00+00:00', employee_id: 'e1', employees: { id: 'e1', name: 'Ana' } },
      { id: 'sh2', type: 'night', start_time: '2026-07-02T20:00:00+00:00', employee_id: 'e1', employees: { id: 'e1', name: 'Ana' } },
    ];
    const sales: EmployeeSaleRow[] = [
      { id: 'v1', total: 5000, payment_method: 'cash', cash_amount: 5000, transfer_amount: 0, shift_id: 'sh1' },
      { id: 'v2', total: 9000, payment_method: 'cash', cash_amount: 9000, transfer_amount: 0, shift_id: 'sh2' },
    ];
    const saleItems: EmployeeSaleItemRow[] = [
      { sale_id: 'v1', quantity: 1, unit_price: 5000, products: { name: 'Corona' } },
      { sale_id: 'v2', quantity: 1, unit_price: 9000, products: { name: 'Stella' } },
    ];

    const result = buildEmployeeReport(shifts, sales, saleItems);
    const ana = result[0];

    const shift1 = ana.shifts.find((s) => s.shift_id === 'sh1')!;
    const shift2 = ana.shifts.find((s) => s.shift_id === 'sh2')!;

    expect(shift1.products.map((p) => p.product_name)).toEqual(['Corona']);
    expect(shift2.products.map((p) => p.product_name)).toEqual(['Stella']);
    // Y el total de la empleada sí junta ambos
    expect(ana.products.map((p) => p.product_name).sort()).toEqual(['Corona', 'Stella']);
  });

  it('separa correctamente varias empleadas y ordena por total_sales descendente', () => {
    const shifts: EmployeeShiftRow[] = [
      { id: 'sh1', type: 'day', start_time: '2026-07-01T12:00:00+00:00', employee_id: 'e1', employees: { id: 'e1', name: 'Poco Vende' } },
      { id: 'sh2', type: 'day', start_time: '2026-07-01T12:00:00+00:00', employee_id: 'e2', employees: { id: 'e2', name: 'Mucho Vende' } },
    ];
    const sales: EmployeeSaleRow[] = [
      { id: 'v1', total: 10000, payment_method: 'cash', cash_amount: 10000, transfer_amount: 0, shift_id: 'sh1' },
      { id: 'v2', total: 90000, payment_method: 'cash', cash_amount: 90000, transfer_amount: 0, shift_id: 'sh2' },
    ];

    const result = buildEmployeeReport(shifts, sales, []);

    expect(result.map((e) => e.employee_name)).toEqual(['Mucho Vende', 'Poco Vende']);
  });

  it('usa "Sin nombre" cuando employees es null y "Producto sin nombre" cuando products es null', () => {
    const shifts: EmployeeShiftRow[] = [
      { id: 'sh1', type: 'day', start_time: '2026-07-01T12:00:00+00:00', employee_id: 'e1', employees: null },
    ];
    const sales: EmployeeSaleRow[] = [
      { id: 'v1', total: 5000, payment_method: 'cash', cash_amount: 5000, transfer_amount: 0, shift_id: 'sh1' },
    ];
    const saleItems: EmployeeSaleItemRow[] = [
      { sale_id: 'v1', quantity: 1, unit_price: 5000, products: null },
    ];

    const result = buildEmployeeReport(shifts, sales, saleItems);

    expect(result[0].employee_name).toBe('Sin nombre');
    expect(result[0].products[0].product_name).toBe('Producto sin nombre');
  });

  it('trata cash_amount/transfer_amount/total/unit_price nulos como 0 (columnas nullable en la BD)', () => {
    const shifts: EmployeeShiftRow[] = [
      { id: 'sh1', type: 'day', start_time: '2026-07-01T12:00:00+00:00', employee_id: 'e1', employees: { id: 'e1', name: 'Ana' } },
    ];
    const sales: EmployeeSaleRow[] = [
      // venta con total nulo (no debería ocurrir en la práctica, pero la columna lo permite)
      { id: 'v1', total: null as unknown as number, payment_method: 'transfer', cash_amount: null, transfer_amount: null, shift_id: 'sh1' },
    ];
    const saleItems: EmployeeSaleItemRow[] = [
      { sale_id: 'v1', quantity: 3, unit_price: null as unknown as number, products: { name: 'Corona' } },
    ];

    const result = buildEmployeeReport(shifts, sales, saleItems);

    expect(result[0].total_sales).toBe(0);
    expect(result[0].cash_sales).toBe(0);
    expect(result[0].transfer_sales).toBe(0);
    expect(result[0].products[0].total).toBe(0);
    expect(result[0].products[0].quantity).toBe(3); // la cantidad sí se cuenta aunque el precio sea nulo
  });

  it('maneja employees/products como array (forma en que a veces lo infiere Supabase)', () => {
    const shifts: EmployeeShiftRow[] = [
      { id: 'sh1', type: 'day', start_time: '2026-07-01T12:00:00+00:00', employee_id: 'e1', employees: [{ id: 'e1', name: 'Desde Array' }] },
    ];

    const result = buildEmployeeReport(shifts, [], []);
    expect(result[0].employee_name).toBe('Desde Array');
  });

  it('un turno sin ventas registra shifts_count pero no rompe nada (total 0)', () => {
    const shifts: EmployeeShiftRow[] = [
      { id: 'sh1', type: 'day', start_time: '2026-07-01T12:00:00+00:00', employee_id: 'e1', employees: { id: 'e1', name: 'Sin Ventas' } },
    ];

    const result = buildEmployeeReport(shifts, [], []);

    expect(result[0].shifts_count).toBe(1);
    expect(result[0].total_sales).toBe(0);
    expect(result[0].shifts[0].products).toEqual([]);
  });

  it('devuelve arreglo vacío cuando no hay turnos', () => {
    expect(buildEmployeeReport([], [], [])).toEqual([]);
  });

  it('ordena los productos de un turno por cantidad descendente cuando hay varios', () => {
    const shifts: EmployeeShiftRow[] = [
      { id: 'sh1', type: 'day', start_time: '2026-07-01T12:00:00+00:00', employee_id: 'e1', employees: { id: 'e1', name: 'Ana' } },
    ];
    const sales: EmployeeSaleRow[] = [
      { id: 'v1', total: 30000, payment_method: 'cash', cash_amount: 30000, transfer_amount: 0, shift_id: 'sh1' },
    ];
    const saleItems: EmployeeSaleItemRow[] = [
      { sale_id: 'v1', quantity: 2, unit_price: 5000, products: { name: 'Poco' } },
      { sale_id: 'v1', quantity: 10, unit_price: 4000, products: { name: 'Mucho' } },
      { sale_id: 'v1', quantity: 5, unit_price: 3000, products: { name: 'Medio' } },
    ];

    const result = buildEmployeeReport(shifts, sales, saleItems);

    expect(result[0].shifts[0].products.map((p) => p.product_name)).toEqual(['Mucho', 'Medio', 'Poco']);
  });
});
