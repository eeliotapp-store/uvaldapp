/**
 * Sistema de Auditoría
 * Registra todas las acciones del sistema para trazabilidad
 */

import { supabaseAdmin } from '@/lib/supabase/server';
import type { AuditAction, AuditEntity, CreateAuditLog } from '@/types/database';

/**
 * Registra una acción en el log de auditoría
 */
export async function logAudit(data: CreateAuditLog): Promise<string | null> {
  try {
    const { data: result, error } = await supabaseAdmin
      .from('audit_logs')
      .insert({
        action: data.action,
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        employee_id: data.employee_id,
        old_values: data.old_values || null,
        new_values: data.new_values || null,
        metadata: data.metadata || {},
        description: data.description || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error logging audit:', error);
      return null;
    }

    return result.id;
  } catch (err) {
    console.error('Audit log error:', err);
    return null;
  }
}

/**
 * Registra creación de venta
 */
export async function logSaleCreated(
  saleId: string,
  employeeId: string,
  saleData: Record<string, unknown>,
  items: Array<{ product_name: string; quantity: number; unit_price: number }>
) {
  const itemsSummary = items.map(i => `${i.quantity}x ${i.product_name}`).join(', ');

  return logAudit({
    action: 'CREATE',
    entity_type: 'SALE',
    entity_id: saleId,
    employee_id: employeeId,
    new_values: saleData,
    metadata: { items_count: items.length },
    description: `Venta creada: ${itemsSummary}`,
  });
}

/**
 * Registra cierre de venta
 */
export async function logSaleClosed(
  saleId: string,
  employeeId: string,
  total: number,
  paymentMethod: string
) {
  return logAudit({
    action: 'CLOSE',
    entity_type: 'SALE',
    entity_id: saleId,
    employee_id: employeeId,
    new_values: { total, payment_method: paymentMethod, status: 'closed' },
    description: `Venta cerrada: $${total.toLocaleString()} (${paymentMethod})`,
  });
}

/**
 * Registra anulación de venta
 */
export async function logSaleVoided(
  saleId: string,
  employeeId: string,
  reason: string,
  originalTotal: number
) {
  return logAudit({
    action: 'VOID',
    entity_type: 'SALE',
    entity_id: saleId,
    employee_id: employeeId,
    old_values: { total: originalTotal, voided: false },
    new_values: { voided: true, voided_reason: reason },
    description: `Venta anulada: "${reason}" (Total: $${originalTotal.toLocaleString()})`,
  });
}

/**
 * Registra edición de item de venta
 */
export async function logSaleItemUpdated(
  saleItemId: string,
  saleId: string,
  employeeId: string,
  oldValues: { quantity: number; unit_price: number; product_name: string },
  newValues: { quantity: number; unit_price: number }
) {
  const changes: string[] = [];

  if (oldValues.quantity !== newValues.quantity) {
    changes.push(`cantidad: ${oldValues.quantity} → ${newValues.quantity}`);
  }
  if (oldValues.unit_price !== newValues.unit_price) {
    changes.push(`precio: $${oldValues.unit_price.toLocaleString()} → $${newValues.unit_price.toLocaleString()}`);
  }

  return logAudit({
    action: 'UPDATE',
    entity_type: 'SALE_ITEM',
    entity_id: saleItemId,
    employee_id: employeeId,
    old_values: oldValues,
    new_values: newValues,
    metadata: { sale_id: saleId },
    description: `${oldValues.product_name}: ${changes.join(', ')}`,
  });
}

/**
 * Registra eliminación de item de venta
 */
export async function logSaleItemDeleted(
  saleItemId: string,
  saleId: string,
  employeeId: string,
  itemData: { product_name: string; quantity: number; unit_price: number }
) {
  return logAudit({
    action: 'DELETE',
    entity_type: 'SALE_ITEM',
    entity_id: saleItemId,
    employee_id: employeeId,
    old_values: itemData,
    metadata: { sale_id: saleId },
    description: `Eliminado: ${itemData.quantity}x ${itemData.product_name}`,
  });
}

/**
 * Registra items agregados a cuenta abierta
 */
export async function logSaleItemsAdded(
  saleId: string,
  employeeId: string,
  items: Array<{ product_name: string; quantity: number; unit_price: number }>
) {
  const itemsSummary = items.map(i => `${i.quantity}x ${i.product_name}`).join(', ');

  return logAudit({
    action: 'ADD_ITEMS',
    entity_type: 'SALE',
    entity_id: saleId,
    employee_id: employeeId,
    new_values: { items },
    metadata: { items_count: items.length },
    description: `Items agregados: ${itemsSummary}`,
  });
}

/**
 * Registra toma de relevo de cuenta
 */
export async function logSaleTakeover(
  saleId: string,
  newEmployeeId: string,
  oldEmployeeName: string,
  newEmployeeName: string
) {
  return logAudit({
    action: 'TAKEOVER',
    entity_type: 'SALE',
    entity_id: saleId,
    employee_id: newEmployeeId,
    old_values: { employee_name: oldEmployeeName },
    new_values: { employee_name: newEmployeeName },
    description: `Relevo: ${oldEmployeeName} → ${newEmployeeName}`,
  });
}

/**
 * Registra cambio de precio en item
 */
export async function logPriceChange(
  saleItemId: string,
  saleId: string,
  employeeId: string,
  productName: string,
  oldPrice: number,
  newPrice: number
) {
  return logAudit({
    action: 'PRICE_CHANGE',
    entity_type: 'SALE_ITEM',
    entity_id: saleItemId,
    employee_id: employeeId,
    old_values: { unit_price: oldPrice },
    new_values: { unit_price: newPrice },
    metadata: { sale_id: saleId, product_name: productName },
    description: `${productName}: $${oldPrice.toLocaleString()} → $${newPrice.toLocaleString()}`,
  });
}

/**
 * Registra ingreso de inventario
 */
export async function logInventoryEntry(
  inventoryId: string,
  employeeId: string,
  productName: string,
  quantity: number,
  purchasePrice: number
) {
  return logAudit({
    action: 'CREATE',
    entity_type: 'INVENTORY',
    entity_id: inventoryId,
    employee_id: employeeId,
    new_values: { quantity, purchase_price: purchasePrice },
    description: `Ingreso: ${quantity}x ${productName} @ $${purchasePrice.toLocaleString()}`,
  });
}

/**
 * Registra modificación de inventario
 */
export async function logInventoryUpdated(
  inventoryId: string,
  employeeId: string,
  productName: string,
  oldValues: { quantity: number },
  newValues: { quantity: number },
  reason?: string
) {
  return logAudit({
    action: 'UPDATE',
    entity_type: 'INVENTORY',
    entity_id: inventoryId,
    employee_id: employeeId,
    old_values: oldValues,
    new_values: newValues,
    metadata: { reason },
    description: `${productName}: ${oldValues.quantity} → ${newValues.quantity}${reason ? ` (${reason})` : ''}`,
  });
}
