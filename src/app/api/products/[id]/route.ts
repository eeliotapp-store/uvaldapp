import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET: Obtener producto con detalles
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('products')
      .select(`
        *,
        product_suppliers (
          id,
          supplier_id,
          purchase_price,
          is_preferred,
          created_at,
          suppliers (id, name, phone)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    // Obtener historial de inventario
    const { data: inventoryHistory } = await supabaseAdmin
      .from('inventory')
      .select(`
        *,
        suppliers (name)
      `)
      .eq('product_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      product: data,
      inventory_history: inventoryHistory || []
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Error al obtener producto' },
      { status: 500 }
    );
  }
}

// PUT: Actualizar producto
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, category, sale_price, min_stock, active, suppliers } = body;

    // Actualizar producto
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category;
    if (sale_price !== undefined) updates.sale_price = parseFloat(sale_price);
    if (min_stock !== undefined) updates.min_stock = parseInt(min_stock);
    if (active !== undefined) updates.active = active;

    const { data: product, error } = await supabaseAdmin
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Actualizar proveedores si se proporcionaron
    if (suppliers !== undefined) {
      // Eliminar relaciones existentes
      await supabaseAdmin
        .from('product_suppliers')
        .delete()
        .eq('product_id', id);

      // Agregar nuevas relaciones
      if (suppliers.length > 0) {
        const supplierLinks = suppliers.map((s: { supplier_id: string; purchase_price: number; is_preferred: boolean }) => ({
          product_id: id,
          supplier_id: s.supplier_id,
          purchase_price: s.purchase_price,
          is_preferred: s.is_preferred || false,
        }));

        await supabaseAdmin.from('product_suppliers').insert(supplierLinks);
      }
    }

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error('Product update error:', error);
    return NextResponse.json(
      { error: 'Error al actualizar producto' },
      { status: 500 }
    );
  }
}

// DELETE: Desactivar producto (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await supabaseAdmin
      .from('products')
      .update({ active: false })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Product deletion error:', error);
    return NextResponse.json(
      { error: 'Error al eliminar producto' },
      { status: 500 }
    );
  }
}
