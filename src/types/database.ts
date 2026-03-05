// Tipos generados para la base de datos

export type EmployeeRole = 'employee' | 'owner' | 'superadmin';
export type ShiftType = 'day' | 'night';
export type PaymentMethod = 'cash' | 'transfer' | 'mixed' | 'fiado';
export type SaleStatus = 'open' | 'closed' | 'voided';
export type ProductCategory = 'beer_nacional' | 'beer_importada' | 'beer_artesanal' | 'other';

export interface Employee {
  id: string;
  username: string;
  name: string;
  password_hash: string;
  role: EmployeeRole;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Shift {
  id: string;
  employee_id: string;
  type: ShiftType;
  start_time: string;
  end_time: string | null;
  cash_start: number;
  transfer_start: number;
  cash_end: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  contact_person: string | null;
  email: string | null;
  address: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  sale_price: number;
  min_stock: number;
  image_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductSupplier {
  id: string;
  product_id: string;
  supplier_id: string;
  purchase_price: number;
  is_preferred: boolean;
  created_at: string;
}

export interface Inventory {
  id: string;
  product_id: string;
  supplier_id: string;
  quantity: number;
  initial_quantity: number;
  purchase_price: number;
  batch_date: string;
  created_at: string;
  created_by: string | null;
}

export interface Sale {
  id: string;
  employee_id: string;
  shift_id: string;
  subtotal: number;
  total: number;
  status: SaleStatus;
  table_number: string | null;
  payment_method: PaymentMethod | null;
  cash_received: number | null;
  cash_change: number | null;
  transfer_amount: number | null;
  cash_amount: number | null;
  voided: boolean;
  voided_reason: string | null;
  // Tracking de traspaso
  opened_by_employee_id: string | null;
  taken_over_by_employee_id: string | null;
  taken_over_at: string | null;
  closed_by_employee_id: string | null;
  // Fiado
  fiado_customer_name: string | null;
  fiado_amount: number | null;
  fiado_abono: number | null;
  fiado_paid: boolean;
  fiado_paid_at: string | null;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  combo_id?: string | null;
  is_michelada?: boolean;
  combo_price_override?: number | null;
}

// Combos/Promociones
export interface Combo {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  is_price_editable: boolean;
  is_active: boolean;
  created_at: string;
}

export interface ComboItem {
  id: string;
  combo_id: string;
  product_id: string;
  quantity: number;
  is_swappable: boolean;
  is_michelada: boolean;
}

export interface ComboWithItems extends Combo {
  combo_items: (ComboItem & {
    products: Product;
  })[];
}

// Vistas
export interface CurrentStock {
  product_id: string;
  product_name: string;
  category: ProductCategory;
  sale_price: number;
  min_stock: number;
  current_stock: number;
  is_low_stock: boolean;
  active: boolean;
}

export interface DailySale {
  id: string;
  created_at: string;
  employee_name: string;
  shift_type: ShiftType;
  total: number;
  payment_method: PaymentMethod;
  voided: boolean;
}

export interface ShiftSummary {
  shift_id: string;
  start_time: string;
  end_time: string | null;
  type: ShiftType;
  employee_name: string;
  cash_start: number;
  transfer_start: number;
  cash_end: number | null;
  cash_sales: number;
  transfer_sales: number;
  mixed_cash: number;
  mixed_transfer: number;
  total_sales: number;
  total_change: number;
  transactions_count: number;
  open_tabs_count: number;
  is_active: boolean;
}

// Tipos para el carrito
export interface CartItem {
  product: Product;
  quantity: number;
  isMichelada?: boolean;
}

// Combo en el carrito
export interface CartCombo {
  combo: Combo;
  items: {
    product: Product;
    quantity: number;
    isMichelada?: boolean;
  }[];
  finalPrice: number;
}

// Constante para precio de michelada
export const MICHELADA_PRICE = 4000;

// Cuenta abierta (tab)
export interface OpenTab {
  id: string;
  table_number: string | null;
  created_at: string;
  total: number;
  employee_id: string;
  employee_name: string;
  shift_id: string;
  // Tracking de traspaso
  opened_by_employee_id: string | null;
  opened_by_name: string | null;
  taken_over_by_employee_id: string | null;
  taken_over_by_name: string | null;
  taken_over_at: string | null;
  items: {
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    is_michelada?: boolean;
    combo_id?: string | null;
    combo_name?: string | null;
  }[];
}

// Estadísticas diarias
export interface DailyStats {
  date: string;
  total_sales: number;
  total_revenue: number;
  cash_revenue: number;
  transfer_revenue: number;
  employees_worked: number;
  shifts_count: number;
}

// Estadísticas semanales
export interface WeeklyStats {
  week_start: string;
  week_end: string;
  total_sales: number;
  total_revenue: number;
  cash_revenue: number;
  transfer_revenue: number;
  employees_worked: number;
  days_worked: number;
}

// ============================================
// AUDITORÍA
// ============================================

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'VOID'
  | 'CLOSE'
  | 'TAKEOVER'
  | 'ADD_ITEMS'
  | 'PRICE_CHANGE';

export type AuditEntity =
  | 'SALE'
  | 'SALE_ITEM'
  | 'INVENTORY'
  | 'PRODUCT'
  | 'COMBO';

export interface AuditLog {
  id: string;
  action: AuditAction;
  entity_type: AuditEntity;
  entity_id: string;
  employee_id: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  description: string | null;
  created_at: string;
}

// Vista de auditoría con info del empleado
export interface AuditLogWithEmployee extends AuditLog {
  employee_name: string;
  sale_id: string | null;
}

// Para crear un registro de auditoría
export interface CreateAuditLog {
  action: AuditAction;
  entity_type: AuditEntity;
  entity_id: string;
  employee_id: string;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  description?: string;
}
