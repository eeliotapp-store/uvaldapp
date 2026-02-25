import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET: Obtener proveedor con historial de compras
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('suppliers')
      .select(`
        *,
        product_suppliers (
          id,
          purchase_price,
          is_preferred,
          products (id, name, sale_price, category)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    // Obtener historial de compras (inventario ingresado de este proveedor)
    const { data: purchaseHistory } = await supabaseAdmin
      .from('inventory')
      .select(`
        *,
        products (name)
      `)
      .eq('supplier_id', id)
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({
      supplier: data,
      purchase_history: purchaseHistory || []
    });
  } catch (error) {
    console.error('Error fetching supplier:', error);
    return NextResponse.json(
      { error: 'Error al obtener proveedor' },
      { status: 500 }
    );
  }
}

// PUT: Actualizar proveedor
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, phone, contact_person, email, address, active } = body;

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (contact_person !== undefined) updates.contact_person = contact_person;
    if (email !== undefined) updates.email = email;
    if (address !== undefined) updates.address = address;
    if (active !== undefined) updates.active = active;

    const { data, error } = await supabaseAdmin
      .from('suppliers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, supplier: data });
  } catch (error) {
    console.error('Supplier update error:', error);
    return NextResponse.json(
      { error: 'Error al actualizar proveedor' },
      { status: 500 }
    );
  }
}

// DELETE: Desactivar proveedor
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await supabaseAdmin
      .from('suppliers')
      .update({ active: false })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Supplier deletion error:', error);
    return NextResponse.json(
      { error: 'Error al eliminar proveedor' },
      { status: 500 }
    );
  }
}
