import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET: Reporte de turnos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date'); // Fecha específica
    const shift_id = searchParams.get('shift_id'); // Turno específico
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');

    // Si se pide un turno específico
    if (shift_id) {
      return await getShiftReport(shift_id);
    }

    // Si se pide una fecha específica (reporte diario con ambos turnos)
    if (date) {
      return await getDailyReport(date);
    }

    // Si se pide un rango de fechas
    if (start_date && end_date) {
      return await getDateRangeReport(start_date, end_date);
    }

    // Por defecto, obtener turnos de hoy
    const today = new Date().toISOString().split('T')[0];
    return await getDailyReport(today);
  } catch (error) {
    console.error('Report error:', error);
    return NextResponse.json(
      { error: 'Error al generar reporte' },
      { status: 500 }
    );
  }
}

// Reporte de un turno específico
async function getShiftReport(shiftId: string) {
  // Obtener datos del turno
  const { data: shift, error: shiftError } = await supabaseAdmin
    .from('shifts')
    .select(`
      *,
      employees (id, name)
    `)
    .eq('id', shiftId)
    .single();

  if (shiftError || !shift) {
    return NextResponse.json({ error: 'Turno no encontrado' }, { status: 404 });
  }

  // Obtener resumen del turno
  const { data: summary } = await supabaseAdmin
    .from('v_shift_summary')
    .select('*')
    .eq('shift_id', shiftId)
    .single();

  // Obtener ventas del turno
  const { data: sales } = await supabaseAdmin
    .from('sales')
    .select(`
      id,
      total,
      payment_method,
      voided,
      created_at,
      table_number,
      fiado_customer_name,
      fiado_amount,
      employees (name)
    `)
    .eq('shift_id', shiftId)
    .or('status.eq.closed,status.is.null')
    .order('created_at', { ascending: true });

  // Obtener productos vendidos en el turno (agrupados)
  const { data: productsSold } = await supabaseAdmin
    .from('sale_items')
    .select(`
      product_id,
      quantity,
      unit_price,
      subtotal,
      is_michelada,
      combo_id,
      products (id, name),
      combos (id, name),
      sales!inner (shift_id, voided, status)
    `)
    .eq('sales.shift_id', shiftId)
    .eq('sales.voided', false);

  // Agrupar productos vendidos
  const productSummary: Record<string, {
    product_id: string;
    product_name: string;
    quantity: number;
    total: number;
    is_combo: boolean;
    combo_name?: string;
  }> = {};

  productsSold?.forEach((item) => {
    const key = item.is_michelada
      ? `${item.product_id}-michelada`
      : item.combo_id
        ? `${item.product_id}-combo-${item.combo_id}`
        : item.product_id;

    // Cast de tipos para relaciones de Supabase (relaciones 1:1)
    const product = item.products as unknown as { id: string; name: string } | null;
    const combo = item.combos as unknown as { id: string; name: string } | null;

    if (!productSummary[key]) {
      productSummary[key] = {
        product_id: item.product_id,
        product_name: (product?.name || 'Producto') + (item.is_michelada ? ' (Michelada)' : ''),
        quantity: 0,
        total: 0,
        is_combo: !!item.combo_id,
        combo_name: combo?.name,
      };
    }
    productSummary[key].quantity += item.quantity;
    productSummary[key].total += item.subtotal;
  });

  // Calcular totales por método de pago
  const paymentTotals = {
    cash: 0,
    transfer: 0,
    mixed_cash: 0,
    mixed_transfer: 0,
    fiado: 0,
    fiado_abonos: 0,
  };

  sales?.forEach((sale) => {
    if (!sale.voided) {
      if (sale.payment_method === 'cash') {
        paymentTotals.cash += sale.total;
      } else if (sale.payment_method === 'transfer') {
        paymentTotals.transfer += sale.total;
      } else if (sale.payment_method === 'mixed') {
        // Para mixed, necesitamos los campos cash_amount y transfer_amount
        // Por ahora usamos el total
        paymentTotals.mixed_cash += sale.total * 0.5; // Aproximación
        paymentTotals.mixed_transfer += sale.total * 0.5;
      } else if (sale.payment_method === 'fiado') {
        paymentTotals.fiado += sale.fiado_amount || sale.total;
      }
    }
  });

  // Obtener observaciones del turno
  const { data: observations } = await supabaseAdmin
    .from('observations')
    .select(`
      id,
      content,
      created_at,
      employees (id, name)
    `)
    .eq('shift_id', shiftId)
    .order('created_at', { ascending: true });

  return NextResponse.json({
    shift: {
      id: shift.id,
      type: shift.type,
      employee_name: shift.employees?.name,
      start_time: shift.start_time,
      end_time: shift.end_time,
      cash_start: shift.cash_start,
      cash_end: shift.cash_end,
      notes: shift.notes,
      is_active: shift.is_active,
    },
    summary: summary || {
      total_sales: 0,
      cash_sales: 0,
      transfer_sales: 0,
      transactions_count: 0,
    },
    sales: sales || [],
    products: Object.values(productSummary).sort((a, b) => b.quantity - a.quantity),
    payment_totals: paymentTotals,
    observations: observations?.map(obs => ({
      id: obs.id,
      content: obs.content,
      created_at: obs.created_at,
      employee_name: (obs.employees as unknown as { name: string } | null)?.name || 'Desconocido',
    })) || [],
  });
}

// Reporte diario (ambos turnos)
async function getDailyReport(date: string) {
  const startOfDay = `${date}T00:00:00`;
  const endOfDay = `${date}T23:59:59`;

  // Obtener turnos del día
  const { data: shifts } = await supabaseAdmin
    .from('shifts')
    .select(`
      *,
      employees (id, name)
    `)
    .gte('start_time', startOfDay)
    .lte('start_time', endOfDay)
    .order('start_time', { ascending: true });

  // Obtener resúmenes de turnos
  const shiftIds = shifts?.map(s => s.id) || [];

  let summaries: Record<string, unknown>[] = [];
  if (shiftIds.length > 0) {
    const { data } = await supabaseAdmin
      .from('v_shift_summary')
      .select('*')
      .in('shift_id', shiftIds);
    summaries = data || [];
  }

  // Obtener todas las ventas del día con info del turno
  const { data: sales } = await supabaseAdmin
    .from('sales')
    .select(`
      id,
      shift_id,
      total,
      payment_method,
      cash_amount,
      transfer_amount,
      voided,
      created_at,
      fiado_customer_name,
      fiado_amount,
      fiado_abono,
      shifts!inner (type)
    `)
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay)
    .or('status.eq.closed,status.is.null');

  // Obtener pagos parciales para incluir en desglose por método de pago
  const nonVoidedSaleIds = sales?.filter(s => !s.voided).map(s => s.id) || [];
  let partialCash = 0;
  let partialTransfer = 0;
  if (nonVoidedSaleIds.length > 0) {
    const { data: partialPayments } = await supabaseAdmin
      .from('partial_payments')
      .select('cash_amount, transfer_amount')
      .in('sale_id', nonVoidedSaleIds);
    partialPayments?.forEach(pp => {
      partialCash += pp.cash_amount || 0;
      partialTransfer += pp.transfer_amount || 0;
    });
  }

  // Obtener productos vendidos con info del empleado que vendió
  const { data: productsSold } = await supabaseAdmin
    .from('sale_items')
    .select(`
      product_id,
      quantity,
      unit_price,
      subtotal,
      is_michelada,
      combo_id,
      added_by_employee_id,
      products (id, name),
      combos (id, name),
      sales!inner (id, shift_id, created_at, voided, status, shifts!inner (type))
    `)
    .gte('sales.created_at', startOfDay)
    .lte('sales.created_at', endOfDay)
    .eq('sales.voided', false);

  // Obtener nombres de empleados que vendieron
  const employeeIds = new Set<string>();
  productsSold?.forEach(item => {
    if (item.added_by_employee_id) {
      employeeIds.add(item.added_by_employee_id);
    }
  });

  let employeeMap: Record<string, string> = {};
  if (employeeIds.size > 0) {
    const { data: employees } = await supabaseAdmin
      .from('employees')
      .select('id, name')
      .in('id', Array.from(employeeIds));
    if (employees) {
      employeeMap = Object.fromEntries(employees.map(e => [e.id, e.name]));
    }
  }

  // Agrupar productos por tipo de turno y empleada
  interface ProductByEmployee {
    employee_id: string;
    employee_name: string;
    products: Record<string, {
      product_id: string;
      product_name: string;
      quantity: number;
      total: number;
    }>;
    total: number;
  }

  interface ShiftTypeData {
    employees: Record<string, ProductByEmployee>;
    total: number;
    products: Record<string, {
      product_id: string;
      product_name: string;
      quantity: number;
      total: number;
    }>;
  }

  const byShiftType: Record<string, ShiftTypeData> = {
    day: { employees: {}, total: 0, products: {} },
    night: { employees: {}, total: 0, products: {} },
  };

  productsSold?.forEach((item) => {
    const shiftType = (item.sales as { shifts?: { type?: string } })?.shifts?.type || 'day';
    const employeeId = item.added_by_employee_id || 'unknown';
    const employeeName = employeeId === 'unknown' ? 'Sin asignar' : (employeeMap[employeeId] || 'Desconocido');

    const productKey = item.is_michelada
      ? `${item.product_id}-michelada`
      : item.product_id;
    // Cast de tipos para relaciones de Supabase (relaciones 1:1)
    const product = item.products as unknown as { id: string; name: string } | null;
    const productName = (product?.name || 'Producto') + (item.is_michelada ? ' (Michelada)' : '');

    // Asegurar que existe la estructura para el tipo de turno
    if (!byShiftType[shiftType]) {
      byShiftType[shiftType] = { employees: {}, total: 0, products: {} };
    }

    // Agregar al resumen por empleada
    if (!byShiftType[shiftType].employees[employeeId]) {
      byShiftType[shiftType].employees[employeeId] = {
        employee_id: employeeId,
        employee_name: employeeName,
        products: {},
        total: 0,
      };
    }

    const employeeData = byShiftType[shiftType].employees[employeeId];
    if (!employeeData.products[productKey]) {
      employeeData.products[productKey] = {
        product_id: item.product_id,
        product_name: productName,
        quantity: 0,
        total: 0,
      };
    }
    employeeData.products[productKey].quantity += item.quantity;
    employeeData.products[productKey].total += item.subtotal;
    employeeData.total += item.subtotal;

    // Agregar al total del turno
    byShiftType[shiftType].total += item.subtotal;
    if (!byShiftType[shiftType].products[productKey]) {
      byShiftType[shiftType].products[productKey] = {
        product_id: item.product_id,
        product_name: productName,
        quantity: 0,
        total: 0,
      };
    }
    byShiftType[shiftType].products[productKey].quantity += item.quantity;
    byShiftType[shiftType].products[productKey].total += item.subtotal;
  });

  // Convertir a arrays ordenados
  const shiftTypeSummary = {
    day: {
      total: byShiftType.day.total,
      employees: Object.values(byShiftType.day.employees)
        .map(emp => ({
          ...emp,
          products: Object.values(emp.products).sort((a, b) => b.quantity - a.quantity),
        }))
        .sort((a, b) => b.total - a.total),
      products: Object.values(byShiftType.day.products).sort((a, b) => b.quantity - a.quantity),
    },
    night: {
      total: byShiftType.night.total,
      employees: Object.values(byShiftType.night.employees)
        .map(emp => ({
          ...emp,
          products: Object.values(emp.products).sort((a, b) => b.quantity - a.quantity),
        }))
        .sort((a, b) => b.total - a.total),
      products: Object.values(byShiftType.night.products).sort((a, b) => b.quantity - a.quantity),
    },
  };

  // Agrupar productos general (para mantener compatibilidad)
  const productSummary: Record<string, {
    product_id: string;
    product_name: string;
    quantity: number;
    total: number;
  }> = {};

  productsSold?.forEach((item) => {
    const key = item.is_michelada
      ? `${item.product_id}-michelada`
      : item.product_id;

    // Cast de tipos para relaciones de Supabase (relaciones 1:1)
    const product = item.products as unknown as { id: string; name: string } | null;

    if (!productSummary[key]) {
      productSummary[key] = {
        product_id: item.product_id,
        product_name: (product?.name || 'Producto') + (item.is_michelada ? ' (Michelada)' : ''),
        quantity: 0,
        total: 0,
      };
    }
    productSummary[key].quantity += item.quantity;
    productSummary[key].total += item.subtotal;
  });

  // Calcular totales del día
  const dayTotals = {
    total_sales: 0,
    cash_sales: 0,
    transfer_sales: 0,
    transactions: 0,
    voided_count: 0,
    fiado_total: 0,
    fiado_abonos: 0,
  };

  sales?.forEach((sale) => {
    if (!sale.voided) {
      dayTotals.total_sales += sale.total;
      dayTotals.transactions++;

      if (sale.payment_method === 'cash') {
        dayTotals.cash_sales += sale.total;
      } else if (sale.payment_method === 'transfer') {
        dayTotals.transfer_sales += sale.total;
      } else if (sale.payment_method === 'mixed') {
        dayTotals.cash_sales += sale.cash_amount || 0;
        dayTotals.transfer_sales += sale.transfer_amount || 0;
      } else if (sale.payment_method === 'fiado') {
        dayTotals.fiado_total += sale.fiado_amount || 0;
        dayTotals.fiado_abonos += sale.fiado_abono || 0;
        dayTotals.cash_sales += sale.fiado_abono || 0;
      }
    } else {
      dayTotals.voided_count++;
    }
  });

  // Incluir pagos parciales en el desglose por método de pago
  dayTotals.cash_sales += partialCash;
  dayTotals.transfer_sales += partialTransfer;

  // Obtener observaciones del día
  const { data: observations } = await supabaseAdmin
    .from('observations')
    .select(`
      id,
      content,
      created_at,
      shift_id,
      employees (id, name),
      shifts (id, type)
    `)
    .gte('created_at', startOfDay)
    .lte('created_at', endOfDay)
    .order('created_at', { ascending: true });

  // Construir reporte por turno (individual de cada empleada)
  const shiftReports = shifts?.map(shift => {
    const shiftSummary = summaries.find((s: { shift_id?: string }) => s.shift_id === shift.id);
    const shiftSales = sales?.filter(s => s.shift_id === shift.id) || [];
    const shiftObservations = observations?.filter(o => o.shift_id === shift.id) || [];

    return {
      id: shift.id,
      type: shift.type,
      employee_id: shift.employees?.id,
      employee_name: shift.employees?.name,
      start_time: shift.start_time,
      end_time: shift.end_time,
      cash_start: shift.cash_start,
      cash_end: shift.cash_end,
      notes: shift.notes,
      is_active: shift.is_active,
      summary: shiftSummary || null,
      sales_count: shiftSales.filter(s => !s.voided).length,
      total: shiftSales.filter(s => !s.voided).reduce((sum, s) => sum + s.total, 0),
      observations: shiftObservations.map(obs => ({
        id: obs.id,
        content: obs.content,
        created_at: obs.created_at,
        employee_name: (obs.employees as unknown as { name: string } | null)?.name || 'Desconocido',
      })),
    };
  }) || [];

  return NextResponse.json({
    date,
    shifts: shiftReports,
    day_totals: dayTotals,
    products: Object.values(productSummary).sort((a, b) => b.quantity - a.quantity),
    by_shift_type: shiftTypeSummary,
    observations: observations?.map(obs => ({
      id: obs.id,
      content: obs.content,
      created_at: obs.created_at,
      employee_name: (obs.employees as unknown as { name: string } | null)?.name || 'Desconocido',
      shift_type: (obs.shifts as unknown as { type: string } | null)?.type || 'unknown',
    })) || [],
  });
}

// Reporte de rango de fechas
async function getDateRangeReport(startDate: string, endDate: string) {
  const start = `${startDate}T00:00:00`;
  const end = `${endDate}T23:59:59`;

  // Obtener turnos en el rango
  const { data: shifts } = await supabaseAdmin
    .from('shifts')
    .select(`
      id,
      type,
      start_time,
      end_time,
      notes,
      cash_start,
      cash_end,
      employees (id, name)
    `)
    .gte('start_time', start)
    .lte('start_time', end)
    .order('start_time', { ascending: true });

  // Obtener ventas en el rango
  const { data: sales } = await supabaseAdmin
    .from('sales')
    .select(`
      id,
      total,
      payment_method,
      cash_amount,
      transfer_amount,
      voided,
      created_at,
      fiado_amount,
      fiado_abono
    `)
    .gte('created_at', start)
    .lte('created_at', end)
    .or('status.eq.closed,status.is.null');

  // Obtener pagos parciales para desglose correcto por método de pago
  const nonVoidedSaleIds = sales?.filter(s => !s.voided).map(s => s.id) || [];
  const saleIdToDay: Record<string, string> = {};
  sales?.filter(s => !s.voided).forEach(s => {
    saleIdToDay[s.id] = s.created_at.split('T')[0];
  });
  let partialCash = 0;
  let partialTransfer = 0;
  const partialByDay: Record<string, { cash: number; transfer: number }> = {};
  if (nonVoidedSaleIds.length > 0) {
    const { data: partialPayments } = await supabaseAdmin
      .from('partial_payments')
      .select('sale_id, cash_amount, transfer_amount')
      .in('sale_id', nonVoidedSaleIds);
    partialPayments?.forEach(pp => {
      partialCash += pp.cash_amount || 0;
      partialTransfer += pp.transfer_amount || 0;
      const day = saleIdToDay[pp.sale_id];
      if (day) {
        if (!partialByDay[day]) partialByDay[day] = { cash: 0, transfer: 0 };
        partialByDay[day].cash += pp.cash_amount || 0;
        partialByDay[day].transfer += pp.transfer_amount || 0;
      }
    });
  }

  // Obtener productos vendidos en el rango
  const { data: productsSold } = await supabaseAdmin
    .from('sale_items')
    .select(`
      product_id,
      quantity,
      unit_price,
      subtotal,
      is_michelada,
      combo_id,
      added_by_employee_id,
      products (id, name),
      combos (id, name),
      sales!inner (id, created_at, voided, status)
    `)
    .gte('sales.created_at', start)
    .lte('sales.created_at', end)
    .eq('sales.voided', false);

  // Obtener nombres de empleados
  const employeeIds = new Set<string>();
  productsSold?.forEach(item => {
    if (item.added_by_employee_id) {
      employeeIds.add(item.added_by_employee_id);
    }
  });

  let employeeMap: Record<string, string> = {};
  if (employeeIds.size > 0) {
    const { data: employees } = await supabaseAdmin
      .from('employees')
      .select('id, name')
      .in('id', Array.from(employeeIds));
    if (employees) {
      employeeMap = Object.fromEntries(employees.map(e => [e.id, e.name]));
    }
  }

  // Agrupar productos
  const productSummary: Record<string, {
    product_id: string;
    product_name: string;
    quantity: number;
    total: number;
  }> = {};

  // Agrupar por empleada
  const byEmployee: Record<string, {
    employee_id: string;
    employee_name: string;
    products: Record<string, {
      product_id: string;
      product_name: string;
      quantity: number;
      total: number;
    }>;
    total: number;
  }> = {};

  productsSold?.forEach((item) => {
    const product = item.products as unknown as { id: string; name: string } | null;
    const key = item.is_michelada
      ? `${item.product_id}-michelada`
      : item.product_id;
    const productName = (product?.name || 'Producto') + (item.is_michelada ? ' (Michelada)' : '');

    // Agregar al resumen general
    if (!productSummary[key]) {
      productSummary[key] = {
        product_id: item.product_id,
        product_name: productName,
        quantity: 0,
        total: 0,
      };
    }
    productSummary[key].quantity += item.quantity;
    productSummary[key].total += item.subtotal;

    // Agregar por empleada
    const employeeId = item.added_by_employee_id || 'unknown';
    const employeeName = employeeId === 'unknown' ? 'Sin asignar' : (employeeMap[employeeId] || 'Desconocido');

    if (!byEmployee[employeeId]) {
      byEmployee[employeeId] = {
        employee_id: employeeId,
        employee_name: employeeName,
        products: {},
        total: 0,
      };
    }
    if (!byEmployee[employeeId].products[key]) {
      byEmployee[employeeId].products[key] = {
        product_id: item.product_id,
        product_name: productName,
        quantity: 0,
        total: 0,
      };
    }
    byEmployee[employeeId].products[key].quantity += item.quantity;
    byEmployee[employeeId].products[key].total += item.subtotal;
    byEmployee[employeeId].total += item.subtotal;
  });

  // Calcular totales
  const totals = {
    total_sales: 0,
    cash_sales: 0,
    transfer_sales: 0,
    transactions: 0,
    voided_count: 0,
    shifts_count: shifts?.length || 0,
    fiado_total: 0,
    fiado_abonos: 0,
  };

  sales?.forEach((sale) => {
    if (!sale.voided) {
      totals.total_sales += sale.total;
      totals.transactions++;

      if (sale.payment_method === 'cash') {
        totals.cash_sales += sale.total;
      } else if (sale.payment_method === 'transfer') {
        totals.transfer_sales += sale.total;
      } else if (sale.payment_method === 'mixed') {
        totals.cash_sales += sale.cash_amount || 0;
        totals.transfer_sales += sale.transfer_amount || 0;
      } else if (sale.payment_method === 'fiado') {
        totals.fiado_total += sale.fiado_amount || 0;
        totals.fiado_abonos += sale.fiado_abono || 0;
        totals.cash_sales += sale.fiado_abono || 0;
      }
    } else {
      totals.voided_count++;
    }
  });

  // Incluir pagos parciales en el desglose por método de pago
  totals.cash_sales += partialCash;
  totals.transfer_sales += partialTransfer;

  // Agrupar ventas por día
  const salesByDay: Record<string, {
    date: string;
    total: number;
    transactions: number;
    cash: number;
    transfer: number;
  }> = {};

  sales?.forEach((sale) => {
    if (!sale.voided) {
      const day = sale.created_at.split('T')[0];
      if (!salesByDay[day]) {
        salesByDay[day] = {
          date: day,
          total: 0,
          transactions: 0,
          cash: 0,
          transfer: 0,
        };
      }
      salesByDay[day].total += sale.total;
      salesByDay[day].transactions++;

      if (sale.payment_method === 'cash') {
        salesByDay[day].cash += sale.total;
      } else if (sale.payment_method === 'transfer') {
        salesByDay[day].transfer += sale.total;
      } else if (sale.payment_method === 'mixed') {
        salesByDay[day].cash += sale.cash_amount || 0;
        salesByDay[day].transfer += sale.transfer_amount || 0;
      } else if (sale.payment_method === 'fiado') {
        salesByDay[day].cash += sale.fiado_abono || 0;
      }
    }
  });

  // Incluir pagos parciales en el desglose diario
  Object.entries(partialByDay).forEach(([day, amounts]) => {
    if (salesByDay[day]) {
      salesByDay[day].cash += amounts.cash;
      salesByDay[day].transfer += amounts.transfer;
    }
  });

  // Obtener observaciones del rango
  const { data: observations } = await supabaseAdmin
    .from('observations')
    .select(`
      id,
      content,
      created_at,
      employees (id, name),
      shifts (id, type)
    `)
    .gte('created_at', start)
    .lte('created_at', end)
    .order('created_at', { ascending: true });

  return NextResponse.json({
    start_date: startDate,
    end_date: endDate,
    shifts: shifts?.map(s => ({
      ...s,
      employee_name: (s.employees as unknown as { name: string } | null)?.name,
    })) || [],
    totals,
    products: Object.values(productSummary).sort((a, b) => b.quantity - a.quantity),
    by_employee: Object.values(byEmployee)
      .map(emp => ({
        ...emp,
        products: Object.values(emp.products).sort((a, b) => b.quantity - a.quantity),
      }))
      .sort((a, b) => b.total - a.total),
    daily_breakdown: Object.values(salesByDay).sort((a, b) => a.date.localeCompare(b.date)),
    observations: observations?.map(obs => ({
      id: obs.id,
      content: obs.content,
      created_at: obs.created_at,
      employee_name: (obs.employees as unknown as { name: string } | null)?.name || 'Desconocido',
      shift_type: (obs.shifts as unknown as { type: string } | null)?.type || 'unknown',
    })) || [],
  });
}
