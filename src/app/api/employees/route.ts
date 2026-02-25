import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { hashPassword } from '@/lib/auth';
import type { EmployeeRole } from '@/types/database';

// GET: Listar empleados
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('id, username, name, role, active, created_at')
      .order('name');

    if (error) throw error;

    return NextResponse.json({ employees: data });
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json(
      { error: 'Error al obtener empleados' },
      { status: 500 }
    );
  }
}

// POST: Crear empleado
export async function POST(request: NextRequest) {
  try {
    const { name, username, password, role } = await request.json();

    // Validaciones
    if (!name || !username || !password) {
      return NextResponse.json(
        { error: 'Nombre, usuario y contraseña son requeridos' },
        { status: 400 }
      );
    }

    if (username.length < 3) {
      return NextResponse.json(
        { error: 'El usuario debe tener al menos 3 caracteres' },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 4 caracteres' },
        { status: 400 }
      );
    }

    // Verificar que el username no exista
    const { data: existing } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq('username', username.toLowerCase().trim())
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Este nombre de usuario ya está en uso' },
        { status: 400 }
      );
    }

    // Hashear la contraseña
    const passwordHash = await hashPassword(password);

    // Crear empleado
    const { data, error } = await supabaseAdmin
      .from('employees')
      .insert({
        name,
        username: username.toLowerCase().trim(),
        password_hash: passwordHash,
        role: (role as EmployeeRole) || 'employee',
        active: true,
      })
      .select('id, username, name, role, active, created_at')
      .single();

    if (error) {
      console.error('Error creating employee:', error);
      return NextResponse.json(
        { error: 'Error al crear empleado' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, employee: data });
  } catch (error) {
    console.error('Employee creation error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
