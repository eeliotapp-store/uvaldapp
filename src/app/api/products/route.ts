import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

// GET: Listar productos con stock y proveedores
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select(`
        *,
        product_suppliers (
          id,
          supplier_id,
          purchase_price,
          is_preferred,
          suppliers (id, name)
        )
      `)
      .order('name');

    if (error) throw error;

    // Obtener stock actual
    const { data: stockData } = await supabaseAdmin
      .from('v_current_stock')
      .select('product_id, current_stock');

    const stockMap: Record<string, number> = {};
    stockData?.forEach((s) => {
      stockMap[s.product_id] = s.current_stock;
    });

    // Combinar datos
    const products = data?.map((p) => ({
      ...p,
      current_stock: stockMap[p.id] || 0,
    }));

    return NextResponse.json({ products });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Error al obtener productos' },
      { status: 500 }
    );
  }
}

// POST: Crear producto
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, category, sale_price, bomba_extra, min_stock, suppliers } = body;

    if (!name || !sale_price) {
      return NextResponse.json(
        { error: 'Nombre y precio de venta son requeridos' },
        { status: 400 }
      );
    }

    // Crear producto
    const { data: product, error } = await supabaseAdmin
      .from('products')
      .insert({
        name,
        category: category || 'beer_nacional',
        sale_price: parseFloat(sale_price),
        bomba_extra: bomba_extra ?? null,
        min_stock: parseInt(min_stock) || 10,
        active: true,
      })
      .select()
      .single();

    if (error) throw error;

    // Agregar proveedores si se proporcionaron
    if (suppliers && suppliers.length > 0) {
      const supplierLinks = suppliers.map((s: { supplier_id: string; purchase_price: number; is_preferred: boolean }) => ({
        product_id: product.id,
        supplier_id: s.supplier_id,
        purchase_price: s.purchase_price,
        is_preferred: s.is_preferred || false,
      }));

      await supabaseAdmin.from('product_suppliers').insert(supplierLinks);
    }

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error('Product creation error:', error);
    return NextResponse.json(
      { error: 'Error al crear producto' },
      { status: 500 }
    );
  }
}
