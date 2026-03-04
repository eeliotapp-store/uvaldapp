import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Filtros opcionales
    const entity_type = searchParams.get('entity_type');
    const entity_id = searchParams.get('entity_id');
    const employee_id = searchParams.get('employee_id');
    const action = searchParams.get('action');
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Construir query
    let query = supabaseAdmin
      .from('audit_logs')
      .select(`
        *,
        employees!audit_logs_employee_id_fkey (
          id,
          name
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Aplicar filtros
    if (entity_type) {
      query = query.eq('entity_type', entity_type);
    }

    if (entity_id) {
      query = query.eq('entity_id', entity_id);
    }

    if (employee_id) {
      query = query.eq('employee_id', employee_id);
    }

    if (action) {
      query = query.eq('action', action);
    }

    if (start_date) {
      query = query.gte('created_at', `${start_date}T00:00:00`);
    }

    if (end_date) {
      query = query.lte('created_at', `${end_date}T23:59:59`);
    }

    const { data: logs, error } = await query;

    if (error) {
      console.error('Error fetching audit logs:', error);
      return NextResponse.json({ error: 'Error al obtener logs' }, { status: 500 });
    }

    // Formatear respuesta
    const formattedLogs = logs?.map(log => ({
      id: log.id,
      action: log.action,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      employee_id: log.employee_id,
      employee_name: log.employees?.name || 'Desconocido',
      old_values: log.old_values,
      new_values: log.new_values,
      metadata: log.metadata,
      description: log.description,
      created_at: log.created_at,
    })) || [];

    return NextResponse.json({
      logs: formattedLogs,
      count: formattedLogs.length,
      offset,
      limit,
    });
  } catch (error) {
    console.error('Audit API error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
