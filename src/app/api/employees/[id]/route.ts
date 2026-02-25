import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { hashPassword } from '@/lib/auth';

// PUT: Actualizar empleado
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, password, role, active } = await request.json();

    const updates: Record<string, unknown> = {};

    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;
    if (active !== undefined) updates.active = active;

    // Si se proporciona una nueva contraseña, hashearla
    if (password) {
      if (password.length < 4) {
        return NextResponse.json(
          { error: 'La contraseña debe tener al menos 4 caracteres' },
          { status: 400 }
        );
      }
      updates.password_hash = await hashPassword(password);
    }

    const { data, error } = await supabaseAdmin
      .from('employees')
      .update(updates)
      .eq('id', id)
      .select('id, username, name, role, active, created_at')
      .single();

    if (error) {
      console.error('Error updating employee:', error);
      return NextResponse.json(
        { error: 'Error al actualizar empleado' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, employee: data });
  } catch (error) {
    console.error('Employee update error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE: Desactivar empleado (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await supabaseAdmin
      .from('employees')
      .update({ active: false })
      .eq('id', id);

    if (error) {
      console.error('Error deactivating employee:', error);
      return NextResponse.json(
        { error: 'Error al desactivar empleado' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Employee deletion error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
