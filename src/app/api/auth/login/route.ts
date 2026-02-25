import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { validatePassword, generateToken } from '@/lib/auth';
import type { Employee } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Usuario y contraseña son requeridos' },
        { status: 400 }
      );
    }

    // Buscar empleado por username
    const { data: employee, error } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('username', username.toLowerCase().trim())
      .eq('active', true)
      .single();

    if (error || !employee) {
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      );
    }

    // Validar contraseña
    const isValid = await validatePassword(password, employee.password_hash);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      );
    }

    // Generar JWT
    const token = await generateToken(employee as Employee);

    // Crear respuesta con cookie
    const response = NextResponse.json({
      success: true,
      employee: {
        id: employee.id,
        username: employee.username,
        name: employee.name,
        role: employee.role,
      },
    });

    // Establecer cookie HttpOnly
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 12, // 12 horas
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
