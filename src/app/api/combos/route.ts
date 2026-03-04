import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';

// GET: Listar todos los combos activos con sus items
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const url = new URL(request.url);
    const includeInactive = url.searchParams.get('includeInactive') === 'true';

    let query = supabaseAdmin
      .from('combos')
      .select(`
        *,
        combo_items (
          id,
          product_id,
          quantity,
          is_swappable,
          is_michelada,
          products (
            id,
            name,
            category,
            sale_price,
            active
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching combos:', error);
      return NextResponse.json({ error: 'Error al obtener combos' }, { status: 500 });
    }

    return NextResponse.json({ combos: data || [] });
  } catch (error) {
    console.error('Get combos error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST: Crear un nuevo combo
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Solo owner y superadmin pueden crear combos
    if (payload.role !== 'owner' && payload.role !== 'superadmin') {
      return NextResponse.json({ error: 'No tienes permisos para crear combos' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, base_price, is_price_editable, items } = body;

    // Validaciones
    if (!name || !base_price) {
      return NextResponse.json({ error: 'Nombre y precio base son requeridos' }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Debe incluir al menos un producto' }, { status: 400 });
    }

    // Crear el combo
    const { data: combo, error: comboError } = await supabaseAdmin
      .from('combos')
      .insert({
        name,
        description: description || null,
        base_price: parseFloat(base_price),
        is_price_editable: is_price_editable || false,
        is_active: true,
      })
      .select()
      .single();

    if (comboError) {
      console.error('Error creating combo:', comboError);
      return NextResponse.json({ error: 'Error al crear combo' }, { status: 500 });
    }

    // Crear los items del combo
    const comboItems = items.map((item: {
      product_id: string;
      quantity: number;
      is_swappable?: boolean;
      is_michelada?: boolean;
    }) => ({
      combo_id: combo.id,
      product_id: item.product_id,
      quantity: item.quantity || 1,
      is_swappable: item.is_swappable || false,
      is_michelada: item.is_michelada || false,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('combo_items')
      .insert(comboItems);

    if (itemsError) {
      console.error('Error creating combo items:', itemsError);
      // Intentar eliminar el combo creado
      await supabaseAdmin.from('combos').delete().eq('id', combo.id);
      return NextResponse.json({ error: 'Error al crear items del combo' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Combo creado correctamente',
      combo,
    });
  } catch (error) {
    console.error('Create combo error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
