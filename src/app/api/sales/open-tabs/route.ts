import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET: Obtener todas las cuentas abiertas
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('v_open_tabs')
      .select('*');

    if (error) {
      console.error('Error fetching open tabs:', error);
      return NextResponse.json(
        { error: 'Error al obtener cuentas abiertas' },
        { status: 500 }
      );
    }

    return NextResponse.json({ tabs: data || [] });
  } catch (error) {
    console.error('Open tabs error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
