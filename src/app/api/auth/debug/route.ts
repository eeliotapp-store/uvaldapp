import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { compare, hash } from 'bcrypt-ts';

export async function GET() {
  try {
    // 1. Obtener empleados de la BD
    const { data: employees, error } = await supabaseAdmin
      .from('employees')
      .select('id, name, role, pin_hash, active')
      .eq('active', true);

    if (error) {
      return NextResponse.json({
        error: 'Error conectando a Supabase',
        details: error.message,
      }, { status: 500 });
    }

    // 2. Generar hash correcto para 1234
    const correctHash = await hash('1234', 10);

    // 3. Probar cada empleado
    const results = await Promise.all(
      (employees || []).map(async (emp) => {
        const testResult = await compare('1234', emp.pin_hash);
        return {
          id: emp.id,
          name: emp.name,
          role: emp.role,
          hash_actual: emp.pin_hash,
          hash_length: emp.pin_hash?.length,
          test_1234: testResult,
        };
      })
    );

    return NextResponse.json({
      message: 'Debug de autenticación',
      empleados_activos: employees?.length || 0,
      hash_correcto_para_1234: correctHash,
      sql_para_actualizar: `UPDATE employees SET pin_hash = '${correctHash}' WHERE active = true;`,
      resultados: results,
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Error general',
      details: String(error),
    }, { status: 500 });
  }
}
