import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET: Listar observaciones
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');
    const employee_id = searchParams.get('employee_id');
    const shift_id = searchParams.get('shift_id');
    const limit = parseInt(searchParams.get('limit') || '100');

    let query = supabaseAdmin
      .from('observations')
      .select(`
        *,
        employees (id, name),
        shifts (id, type, start_time, end_time)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (start_date) {
      query = query.gte('created_at', `${start_date}T00:00:00`);
    }

    if (end_date) {
      query = query.lte('created_at', `${end_date}T23:59:59`);
    }

    if (employee_id) {
      query = query.eq('employee_id', employee_id);
    }

    if (shift_id) {
      query = query.eq('shift_id', shift_id);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ observations: data });
  } catch (error) {
    console.error('Error fetching observations:', error);
    return NextResponse.json(
      { error: 'Error al obtener observaciones' },
      { status: 500 }
    );
  }
}

// POST: Crear observación
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employee_id, shift_id, content } = body;

    if (!employee_id || !shift_id || !content) {
      return NextResponse.json(
        { error: 'Datos incompletos' },
        { status: 400 }
      );
    }

    if (content.trim().length === 0) {
      return NextResponse.json(
        { error: 'La observación no puede estar vacía' },
        { status: 400 }
      );
    }

    // Verificar que el turno existe y está activo
    const { data: shift, error: shiftError } = await supabaseAdmin
      .from('shifts')
      .select('id, is_active')
      .eq('id', shift_id)
      .single();

    if (shiftError || !shift) {
      return NextResponse.json(
        { error: 'Turno no encontrado' },
        { status: 404 }
      );
    }

    // Crear la observación
    const { data, error } = await supabaseAdmin
      .from('observations')
      .insert({
        employee_id,
        shift_id,
        content: content.trim(),
      })
      .select(`
        *,
        employees (id, name),
        shifts (id, type)
      `)
      .single();

    if (error) {
      console.error('Error creating observation:', error);
      return NextResponse.json(
        { error: 'Error al crear observación' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      observation: data,
    });
  } catch (error) {
    console.error('Observation creation error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
