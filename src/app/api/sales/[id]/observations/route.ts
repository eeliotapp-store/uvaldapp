import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { text, employee_id } = await request.json();

    if (!text?.trim()) {
      return NextResponse.json({ error: 'La observación no puede estar vacía' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('tab_observations')
      .insert({ sale_id: id, text: text.trim(), employee_id })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ observation: data });
  } catch (error) {
    console.error('Error adding observation:', error);
    return NextResponse.json({ error: 'Error al agregar observación' }, { status: 500 });
  }
}
