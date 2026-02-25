import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET: Listar proveedores con productos
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('suppliers')
      .select(`
        *,
        product_suppliers (
          id,
          purchase_price,
          is_preferred,
          products (id, name, sale_price)
        )
      `)
      .order('name');

    if (error) throw error;

    return NextResponse.json({ suppliers: data });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json(
      { error: 'Error al obtener proveedores' },
      { status: 500 }
    );
  }
}

// POST: Crear proveedor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, contact_person, email, address } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Nombre es requerido' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('suppliers')
      .insert({
        name,
        phone: phone || null,
        contact_person: contact_person || null,
        email: email || null,
        address: address || null,
        active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, supplier: data });
  } catch (error) {
    console.error('Supplier creation error:', error);
    return NextResponse.json(
      { error: 'Error al crear proveedor' },
      { status: 500 }
    );
  }
}
