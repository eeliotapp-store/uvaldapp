/**
 * Lógica pura del reporte "Por empleada" en Estadísticas (ranking y detalle por turno).
 * Sin dependencias externas (nada de Supabase/Next.js) — fácil de testear.
 */

export interface EmployeeShiftRow {
  id: string;
  type: 'day' | 'night';
  start_time: string;
  employee_id: string;
  employees: { id: string; name: string } | { id: string; name: string }[] | null;
}

export interface EmployeeSaleRow {
  id: string;
  total: number;
  payment_method: string | null;
  cash_amount: number | null;
  transfer_amount: number | null;
  shift_id: string;
}

export interface EmployeeSaleItemRow {
  sale_id: string;
  quantity: number;
  unit_price: number;
  products: { name: string } | { name: string }[] | null;
}

export interface EmployeeShiftEntry {
  shift_id: string;
  date: string;
  type: string;
  total: number;
  cash: number;
  transfer: number;
  transactions: number;
  products: { product_name: string; quantity: number; total: number }[];
}

export interface EmployeeReportEntry {
  employee_id: string;
  employee_name: string;
  shifts_count: number;
  total_sales: number;
  cash_sales: number;
  transfer_sales: number;
  transactions_count: number;
  total_units: number;
  shifts: EmployeeShiftEntry[];
  products: { product_name: string; quantity: number; total: number }[];
}

export function buildEmployeeReport(
  shifts: EmployeeShiftRow[],
  sales: EmployeeSaleRow[],
  saleItems: EmployeeSaleItemRow[]
): EmployeeReportEntry[] {
  const employeeMap = new Map<
    string,
    {
      employee_id: string;
      employee_name: string;
      shifts_count: number;
      total_sales: number;
      cash_sales: number;
      transfer_sales: number;
      transactions_count: number;
      shifts: EmployeeShiftEntry[];
      products: Map<string, { product_name: string; quantity: number; total: number }>;
    }
  >();

  for (const shift of shifts) {
    const empId = shift.employee_id;
    const emp_data = Array.isArray(shift.employees) ? shift.employees[0] : shift.employees;
    const empName = emp_data?.name || 'Sin nombre';

    if (!employeeMap.has(empId)) {
      employeeMap.set(empId, {
        employee_id: empId,
        employee_name: empName,
        shifts_count: 0,
        total_sales: 0,
        cash_sales: 0,
        transfer_sales: 0,
        transactions_count: 0,
        shifts: [],
        products: new Map(),
      });
    }

    const emp = employeeMap.get(empId)!;
    const shiftSales = sales.filter((s) => s.shift_id === shift.id);

    const shiftTotal = shiftSales.reduce((sum, s) => sum + (s.total || 0), 0);
    const shiftCash = shiftSales.reduce((sum, s) => sum + (s.cash_amount || 0), 0);
    const shiftTransfer = shiftSales.reduce((sum, s) => sum + (s.transfer_amount || 0), 0);

    emp.shifts_count++;
    emp.total_sales += shiftTotal;
    emp.cash_sales += shiftCash;
    emp.transfer_sales += shiftTransfer;
    emp.transactions_count += shiftSales.length;

    // Productos por turno y por empleada
    const shiftProducts = new Map<string, { product_name: string; quantity: number; total: number }>();
    for (const sale of shiftSales) {
      const items = saleItems.filter((i) => i.sale_id === sale.id);
      for (const item of items) {
        const productInfo = Array.isArray(item.products) ? item.products[0] : item.products;
        const productName = productInfo?.name || 'Producto sin nombre';
        const itemTotal = item.quantity * (item.unit_price || 0);

        if (!emp.products.has(productName)) {
          emp.products.set(productName, { product_name: productName, quantity: 0, total: 0 });
        }
        const empProd = emp.products.get(productName)!;
        empProd.quantity += item.quantity;
        empProd.total += itemTotal;

        if (!shiftProducts.has(productName)) {
          shiftProducts.set(productName, { product_name: productName, quantity: 0, total: 0 });
        }
        const shiftProd = shiftProducts.get(productName)!;
        shiftProd.quantity += item.quantity;
        shiftProd.total += itemTotal;
      }
    }

    emp.shifts.push({
      shift_id: shift.id,
      date: shift.start_time.split('T')[0],
      type: shift.type,
      total: shiftTotal,
      cash: shiftCash,
      transfer: shiftTransfer,
      transactions: shiftSales.length,
      products: [...shiftProducts.values()].sort((a, b) => b.quantity - a.quantity),
    });
  }

  return [...employeeMap.values()]
    .map((emp) => ({
      employee_id: emp.employee_id,
      employee_name: emp.employee_name,
      shifts_count: emp.shifts_count,
      total_sales: emp.total_sales,
      cash_sales: emp.cash_sales,
      transfer_sales: emp.transfer_sales,
      transactions_count: emp.transactions_count,
      total_units: [...emp.products.values()].reduce((sum, p) => sum + p.quantity, 0),
      shifts: emp.shifts,
      products: [...emp.products.values()].sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.total_sales - a.total_sales);
}
