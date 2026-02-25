// Tipos generados para la base de datos

export type EmployeeRole = 'employee' | 'owner';
export type ShiftType = 'day' | 'night';
export type PaymentMethod = 'cash' | 'transfer' | 'mixed';
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
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
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
  cash_end: number | null;
  cash_sales: number;
  card_sales: number;
  total_sales: number;
  transactions_count: number;
  is_active: boolean;
}

// Tipos para el carrito
export interface CartItem {
  product: Product;
  quantity: number;
}

// Cuenta abierta (tab)
export interface OpenTab {
  id: string;
  table_number: string | null;
  created_at: string;
  total: number;
  employee_id: string;
  employee_name: string;
  shift_id: string;
  items: {
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[];
}
