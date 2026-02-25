import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET: Historial de movimientos de inventario
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const product_id = searchParams.get('product_id');
    const supplier_id = searchParams.get('supplier_id');
    const limit = parseInt(searchParams.get('limit') || '100');

    let query = supabaseAdmin
      .from('inventory')
      .select(`
        *,
        products (id, name, sale_price),
        suppliers (id, name),
        employees:created_by (name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (product_id) {
      query = query.eq('product_id', product_id);
    }

    if (supplier_id) {
      query = query.eq('supplier_id', supplier_id);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ inventory: data });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json(
      { error: 'Error al obtener inventario' },
      { status: 500 }
    );
  }
}

// POST: Agregar entrada de inventario
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { product_id, supplier_id, quantity, purchase_price, batch_date, created_by } = body;

    if (!product_id || !supplier_id || !quantity || !purchase_price) {
      return NextResponse.json(
        { error: 'Producto, proveedor, cantidad y precio son requeridos' },
        { status: 400 }
      );
    }

    // Insertar entrada de inventario
    const { data, error } = await supabaseAdmin
      .from('inventory')
      .insert({
        product_id,
        supplier_id,
        quantity: parseInt(quantity),
        initial_quantity: parseInt(quantity),
        purchase_price: parseFloat(purchase_price),
        batch_date: batch_date || new Date().toISOString().split('T')[0],
        created_by: created_by || null,
      })
      .select(`
        *,
        products (name),
        suppliers (name)
      `)
      .single();

    if (error) throw error;

    // Actualizar el precio de compra en product_suppliers si existe
    await supabaseAdmin
      .from('product_suppliers')
      .upsert({
        product_id,
        supplier_id,
        purchase_price: parseFloat(purchase_price),
        is_preferred: false,
      }, {
        onConflict: 'product_id,supplier_id',
      });

    return NextResponse.json({ success: true, inventory: data });
  } catch (error) {
    console.error('Inventory creation error:', error);
    return NextResponse.json(
      { error: 'Error al agregar inventario' },
      { status: 500 }
    );
  }
}
