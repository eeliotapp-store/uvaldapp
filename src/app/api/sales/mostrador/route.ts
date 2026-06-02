import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET: Devuelve la tab mostrador abierta, creándola si no existe.
// Se llama al cargar la página para garantizar que siempre esté disponible.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const employee_id = searchParams.get('employee_id');
  const shift_id = searchParams.get('shift_id');

  const { data: existing } = await supabaseAdmin
    .from('sales')
    .select('id, total')
    .eq('table_number', 'mostrador')
    .eq('status', 'open')
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ sale_id: existing.id, created: false });
  }

  // No existe → crearla si tenemos turno activo
  if (!employee_id || !shift_id) {
    return NextResponse.json({ sale_id: null, created: false });
  }

  const { data: newSale, error } = await supabaseAdmin
    .from('sales')
    .insert({
      employee_id,
      shift_id,
      table_number: 'mostrador',
      status: 'open',
      subtotal: 0,
      total: 0,
      opened_by_employee_id: employee_id,
    })
    .select('id')
    .single();

  if (error || !newSale) {
    return NextResponse.json({ sale_id: null, created: false });
  }

  return NextResponse.json({ sale_id: newSale.id, created: true });
}

interface MostradorItem {
  product_id: string;
  quantity: number;
  unit_price: number;
}

interface MostradorRequest {
  employee_id: string;
  shift_id: string;
  items: MostradorItem[];
  payment_method?: 'cash' | 'transfer';
}

// POST: Crea una venta de mostrador con todos los items y la cierra inmediatamente como efectivo.
export async function POST(request: NextRequest) {
  try {
    const body: MostradorRequest = await request.json();
    const { employee_id, shift_id, items, payment_method = 'cash' } = body;

    if (!employee_id || !shift_id || !items?.length) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    // Validar stock para todos los productos
    for (const item of items) {
      const { data: stockData } = await supabaseAdmin
        .from('v_current_stock')
        .select('current_stock, product_name')
        .eq('product_id', item.product_id)
        .single();

      if (!stockData) {
        return NextResponse.json({ error: 'Producto no encontrado' }, { status: 400 });
      }
      if (stockData.current_stock < item.quantity) {
        return NextResponse.json(
          { error: `Stock insuficiente para ${stockData.product_name}` },
          { status: 400 }
        );
      }
    }

    const total = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);

    // Crear la venta ya cerrada como efectivo
    const { data: newSale, error: createError } = await supabaseAdmin
      .from('sales')
      .insert({
        employee_id,
        shift_id,
        table_number: 'mostrador',
        status: 'closed',
        payment_method,
        subtotal: total,
        total,
        cash_amount: payment_method === 'cash' ? total : 0,
        transfer_amount: payment_method === 'transfer' ? total : 0,
        opened_by_employee_id: employee_id,
        closed_by_employee_id: employee_id,
      })
      .select('id')
      .single();

    if (createError || !newSale) {
      console.error('Error creating mostrador sale:', createError);
      return NextResponse.json({ error: 'Error al crear venta mostrador' }, { status: 500 });
    }

    // Insertar todos los items
    const saleItems = items.map((item) => ({
      sale_id: newSale.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.quantity * item.unit_price,
      is_michelada: false,
      is_bomba: false,
      combo_id: null,
      combo_price_override: null,
      added_by_employee_id: employee_id,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('sale_items')
      .insert(saleItems);

    if (itemsError) {
      console.error('Error inserting mostrador items:', itemsError);
      return NextResponse.json({ error: 'Error al agregar productos' }, { status: 500 });
    }

    return NextResponse.json({ success: true, sale_id: newSale.id });
  } catch (error) {
    console.error('Mostrador error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
