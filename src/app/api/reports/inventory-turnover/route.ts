import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// Supabase/PostgREST tiene un límite por defecto de filas por respuesta (1000) que trunca
// silenciosamente sin lanzar error — hay que paginar la SALIDA con .range().
async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

const BATCH = 200; // límite de longitud de URL de Supabase para .in()

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'start_date y end_date son requeridos' }, { status: 400 });
  }

  const startOfRange = `${startDate}T00:00:00`;
  const endOfRange = `${endDate}T23:59:59`;

  try {
    // 1. Costo de compra más reciente por producto (product_suppliers)
    type SupplierRow = { product_id: string; purchase_price: number; created_at: string };
    const supplierRows = await fetchAllRows<SupplierRow>((from, to) =>
      supabaseAdmin
        .from('product_suppliers')
        .select('product_id, purchase_price, created_at')
        .order('created_at', { ascending: false })
        .range(from, to)
    );
    const costByProduct = new Map<string, number>();
    for (const row of supplierRows) {
      if (!costByProduct.has(row.product_id)) {
        costByProduct.set(row.product_id, row.purchase_price);
      }
    }

    // 2. Stock actual, valorizado a costo
    type StockRow = { product_id: string; product_name: string; current_stock: number };
    const stock = await fetchAllRows<StockRow>((from, to) =>
      supabaseAdmin.from('v_current_stock').select('product_id, product_name, current_stock').range(from, to)
    );

    let inventoryValueAtCost = 0;
    const productsWithoutCost = new Set<string>();
    for (const row of stock) {
      const cost = costByProduct.get(row.product_id);
      if (cost === undefined) {
        productsWithoutCost.add(row.product_name);
        continue;
      }
      inventoryValueAtCost += row.current_stock * cost;
    }

    // 3. Ventas del rango
    type SaleRow = { id: string };
    const sales = await fetchAllRows<SaleRow>((from, to) =>
      supabaseAdmin
        .from('sales')
        .select('id')
        .gte('created_at', startOfRange)
        .lte('created_at', endOfRange)
        .eq('voided', false)
        .eq('status', 'closed')
        .order('id', { ascending: true })
        .range(from, to)
    );

    // 4. Items vendidos en el rango (para calcular costo de lo vendido)
    type SaleItemRow = { product_id: string; quantity: number };
    const saleIds = sales.map((s) => s.id);
    const saleItems: SaleItemRow[] = [];
    for (let i = 0; i < saleIds.length; i += BATCH) {
      const idsBatch = saleIds.slice(i, i + BATCH);
      const batchItems = await fetchAllRows<SaleItemRow>((from, to) =>
        supabaseAdmin
          .from('sale_items')
          .select('product_id, quantity')
          .in('sale_id', idsBatch)
          .order('id', { ascending: true })
          .range(from, to)
      );
      saleItems.push(...batchItems);
    }

    // 5. Costo de lo vendido (COGS) — solo productos con costo conocido
    let cogs = 0;
    let excludedUnits = 0;
    const productNameById = new Map(stock.map((s) => [s.product_id, s.product_name]));
    for (const item of saleItems) {
      const cost = costByProduct.get(item.product_id);
      if (cost === undefined) {
        excludedUnits += item.quantity;
        const name = productNameById.get(item.product_id);
        if (name) productsWithoutCost.add(name);
        continue;
      }
      cogs += item.quantity * cost;
    }

    const turnover = inventoryValueAtCost > 0 ? cogs / inventoryValueAtCost : null;

    return NextResponse.json({
      start_date: startDate,
      end_date: endDate,
      cogs,
      inventory_value_at_cost: inventoryValueAtCost,
      turnover,
      excluded_units_sold: excludedUnits,
      products_without_cost: [...productsWithoutCost].sort(),
    });
  } catch (error) {
    console.error('Error en reporte de rotación de inventario:', error);
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
