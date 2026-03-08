import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET: Ranking de productos más vendidos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'week'; // day, week, month, year, all
    const limit = parseInt(searchParams.get('limit') || '10');
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');

    let startDate: string;
    let endDate: string;

    // Determinar rango de fechas según período
    const now = new Date();

    if (start_date && end_date) {
      startDate = `${start_date}T00:00:00`;
      endDate = `${end_date}T23:59:59`;
    } else {
      endDate = now.toISOString();

      switch (period) {
        case 'day':
          startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
          break;
        case 'week':
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          startDate = weekAgo.toISOString();
          break;
        case 'month':
          const monthAgo = new Date();
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          startDate = monthAgo.toISOString();
          break;
        case 'year':
          const yearAgo = new Date();
          yearAgo.setFullYear(yearAgo.getFullYear() - 1);
          startDate = yearAgo.toISOString();
          break;
        case 'all':
        default:
          startDate = '2000-01-01T00:00:00';
          break;
      }
    }

    // Obtener productos vendidos
    const { data: productsSold } = await supabaseAdmin
      .from('sale_items')
      .select(`
        product_id,
        quantity,
        subtotal,
        is_michelada,
        products (id, name, category),
        sales!inner (id, created_at, voided, status)
      `)
      .gte('sales.created_at', startDate)
      .lte('sales.created_at', endDate)
      .eq('sales.voided', false);

    // Agrupar por producto
    const productRanking: Record<string, {
      product_id: string;
      product_name: string;
      category: string | null;
      quantity: number;
      total: number;
      is_michelada: boolean;
    }> = {};

    productsSold?.forEach((item) => {
      const product = item.products as unknown as { id: string; name: string; category: string | null } | null;
      const key = item.is_michelada
        ? `${item.product_id}-michelada`
        : item.product_id;

      if (!productRanking[key]) {
        productRanking[key] = {
          product_id: item.product_id,
          product_name: (product?.name || 'Producto') + (item.is_michelada ? ' (Michelada)' : ''),
          category: product?.category || null,
          quantity: 0,
          total: 0,
          is_michelada: item.is_michelada,
        };
      }
      productRanking[key].quantity += item.quantity;
      productRanking[key].total += item.subtotal;
    });

    // Ordenar por cantidad vendida y aplicar límite
    const ranking = Object.values(productRanking)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit)
      .map((item, index) => ({
        ...item,
        rank: index + 1,
      }));

    // Calcular totales
    const totalQuantity = Object.values(productRanking).reduce((sum, p) => sum + p.quantity, 0);
    const totalRevenue = Object.values(productRanking).reduce((sum, p) => sum + p.total, 0);

    // Agrupar por categoría
    const byCategory: Record<string, {
      category: string;
      quantity: number;
      total: number;
      products: number;
    }> = {};

    Object.values(productRanking).forEach((product) => {
      const cat = product.category || 'Sin categoría';
      if (!byCategory[cat]) {
        byCategory[cat] = {
          category: cat,
          quantity: 0,
          total: 0,
          products: 0,
        };
      }
      byCategory[cat].quantity += product.quantity;
      byCategory[cat].total += product.total;
      byCategory[cat].products++;
    });

    return NextResponse.json({
      period: start_date && end_date ? 'custom' : period,
      start_date: startDate.split('T')[0],
      end_date: endDate.split('T')[0],
      ranking,
      summary: {
        total_products: Object.keys(productRanking).length,
        total_quantity: totalQuantity,
        total_revenue: totalRevenue,
      },
      by_category: Object.values(byCategory)
        .sort((a, b) => b.quantity - a.quantity),
    });
  } catch (error) {
    console.error('Ranking error:', error);
    return NextResponse.json(
      { error: 'Error al generar ranking' },
      { status: 500 }
    );
  }
}
