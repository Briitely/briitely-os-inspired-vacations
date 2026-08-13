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

export interface UpsertInvoiceCommissionInput {
  invoiceId: string;
  invoiceNumber?: string | number | null;
  contactId: string;
  customerName?: string | null;
  assignedUserId?: string | null;
  commissionSale: boolean;
}
