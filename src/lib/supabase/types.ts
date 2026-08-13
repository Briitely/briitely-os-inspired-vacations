export type AppRole = "super_admin" | "admin" | "staff";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  role: AppRole;
  is_active: boolean;
  ghl_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  external_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface IntegrationLogEntry {
  id: string;
  provider: string;
  operation: string;
  entity_type: string | null;
  external_id: string | null;
  status: string;
  error_code: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  completed_at: string | null;
}

export interface InvoiceCommission {
  id: string;
  invoice_id: string;
  invoice_number: string | null;
  contact_id: string;
  customer_name: string | null;
  assigned_user_id: string | null;
  commission_sale: boolean;
  commission_paid: boolean;
  commission_paid_at: string | null;
  commission_paid_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientSetting {
  id: string;
  setting_key: string;
  setting_value: Record<string, unknown>;
  description: string | null;
  updated_at: string;
}
