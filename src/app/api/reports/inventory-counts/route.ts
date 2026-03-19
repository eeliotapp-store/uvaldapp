import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';

// GET: Obtener historial de conteos de inventario con filtros de fecha
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

    // Solo owner y superadmin pueden ver este reporte
    if (payload.role !== 'owner' && payload.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Solo el owner o superadmin puede ver este reporte' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Construir query base
    let query = supabaseAdmin
      .from('inventory_counts')
      .select(`
        id,
        product_id,
        shift_id,
        employee_id,
        system_stock,
        real_stock,
        difference,
        notes,
        created_at,
        products (id, name),
        employees (id, name),
        shifts (id, type, start_time)
      `)
      .order('created_at', { ascending: false });

    // Aplicar filtros de fecha
    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00`);
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59`);
    }

    const { data: counts, error } = await query;

    if (error) {
      console.error('Error fetching inventory counts:', error);
      throw error;
    }

    // Calcular estadísticas
    const summary = {
      total_counts: counts?.length || 0,
      counts_with_difference: counts?.filter(c => c.difference !== 0).length || 0,
      total_positive_diff: counts?.reduce((sum, c) => c.difference > 0 ? sum + c.difference : sum, 0) || 0,
      total_negative_diff: counts?.reduce((sum, c) => c.difference < 0 ? sum + Math.abs(c.difference) : sum, 0) || 0,
      products_counted: new Set(counts?.map(c => c.product_id)).size,
      employees_involved: new Set(counts?.map(c => c.employee_id)).size,
    };

    // Agrupar por producto para ver totales
    const byProduct: Record<string, {
      product_id: string;
      product_name: string;
      count_times: number;
      total_positive_diff: number;
      total_negative_diff: number;
    }> = {};

    counts?.forEach(c => {
      const productName = (c.products as { name: string })?.name || 'Producto desconocido';
      if (!byProduct[c.product_id]) {
        byProduct[c.product_id] = {
          product_id: c.product_id,
          product_name: productName,
          count_times: 0,
          total_positive_diff: 0,
          total_negative_diff: 0,
        };
      }
      byProduct[c.product_id].count_times++;
      if (c.difference > 0) {
        byProduct[c.product_id].total_positive_diff += c.difference;
      } else if (c.difference < 0) {
        byProduct[c.product_id].total_negative_diff += Math.abs(c.difference);
      }
    });

    // Ordenar productos por diferencias negativas (faltantes)
    const productSummary = Object.values(byProduct).sort(
      (a, b) => b.total_negative_diff - a.total_negative_diff
    );

    return NextResponse.json({
      counts,
      summary,
      by_product: productSummary,
      start_date: startDate || null,
      end_date: endDate || null,
    });
  } catch (error) {
    console.error('Error fetching inventory counts report:', error);
    return NextResponse.json(
      { error: 'Error al obtener reporte de conteos' },
      { status: 500 }
    );
  }
}
