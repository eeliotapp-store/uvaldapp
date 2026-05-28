import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('v_current_stock')
      .select('*')
      .order('product_name');

    if (error) throw error;

    return NextResponse.json({ stock: data });
  } catch (error) {
    console.error('Error fetching stock:', error);
    return NextResponse.json(
      { error: 'Error al obtener stock' },
      { status: 500 }
    );
  }
}
