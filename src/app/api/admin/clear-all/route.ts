import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth';

// POST: Vaciar TODO el sistema (owner y superadmin)
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || (payload.role !== 'superadmin' && payload.role !== 'owner')) {
      return NextResponse.json(
        { error: 'Solo owner o superadmin puede realizar esta acción' },
        { status: 403 }
      );
    }

    const { confirm } = await request.json();
    if (confirm !== 'VACIAR_TODO_EL_SISTEMA') {
      return NextResponse.json(
        { error: 'Confirmación requerida: enviar { "confirm": "VACIAR_TODO_EL_SISTEMA" }' },
        { status: 400 }
      );
    }

    const errors: string[] = [];

    // 1. Vaciar sale_items (depende de sales y products)
    const { error: saleItemsError } = await supabaseAdmin
      .from('sale_items')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (saleItemsError) errors.push('sale_items: ' + saleItemsError.message);

    // 2. Vaciar sales (depende de shifts y employees)
    const { error: salesError } = await supabaseAdmin
      .from('sales')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (salesError) errors.push('sales: ' + salesError.message);

    // 3. Vaciar inventory (depende de products)
    const { error: inventoryError } = await supabaseAdmin
      .from('inventory')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (inventoryError) errors.push('inventory: ' + inventoryError.message);

    // 4. Vaciar shifts (depende de employees)
    const { error: shiftsError } = await supabaseAdmin
      .from('shifts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (shiftsError) errors.push('shifts: ' + shiftsError.message);

    // 5. Vaciar products (depende de suppliers)
    const { error: productsError } = await supabaseAdmin
      .from('products')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (productsError) errors.push('products: ' + productsError.message);

    // 6. Vaciar suppliers
    const { error: suppliersError } = await supabaseAdmin
      .from('suppliers')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (suppliersError) errors.push('suppliers: ' + suppliersError.message);

    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        message: 'Algunos datos no pudieron ser eliminados',
        errors,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Sistema vaciado completamente. Listo para datos reales.',
    });
  } catch (error) {
    console.error('Clear all error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
